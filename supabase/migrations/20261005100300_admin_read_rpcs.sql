-- Migration M4: read functions of the admin panel (spec V-1, V-2, V-3, V-4; BR-20..BR-22).
--
-- Four read-only SECURITY DEFINER functions, one per screen, so the screens get a stable shape
-- and never read members or auth.users directly:
--   admin_list_members   V-2  list, search, filters, sort, pagination (with a total count)
--   admin_get_member     V-3  one member's file; register fields only for a former member
--   admin_stats          V-1  the stat cards
--   admin_list_activity  V-4  the audit log feed (also V-1 "Activitat recent" and the V-3
--                             history and activity cards, through its filters)
--
-- Who may call them: board, superadmin and the legacy admin (has_role('board'), which also
-- requires an active membership). EXECUTE for authenticated only; anon and service_role have
-- none (has_role() needs a session anyway). Opening a list or a file is not audited (spec §5.1).
--
-- What they never return: DNI or phone values or their ciphertext (only whether they exist,
-- has_dni / has_phone), and nothing about accounts whose e-mail was never confirmed (BR-22) or
-- purged stubs (spec V-2, §4.5). A former member's file holds only the register fields (BR-20,
-- BR-21): postal code, gaming usernames, newsletter and phone come back NULL.
--
-- Errors (the message starts with a stable prefix the app maps to a translated text):
--   admin:forbidden         42501  caller is not an active board member or higher
--   admin:invalid_argument  22023  unknown state, role, sort or actor kind
--
-- Safe to apply to production before the code that uses it: nothing calls these functions yet.
-- get_all_members_for_admin() stays as it is (the current CSV export uses it until T27).

-- 1. Internal helpers --------------------------------------------------------------------------
--    Called only from the functions below (owner privileges); no API role can execute them.

--    Raises admin:forbidden unless the caller is an active board member or higher.
CREATE OR REPLACE FUNCTION public.admin_assert_board()
  RETURNS void
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
AS $$
BEGIN
  IF NOT public.has_role('board') THEN
    RAISE EXCEPTION 'admin:forbidden: board role required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_assert_board() FROM PUBLIC, anon, authenticated, service_role;

--    Search key: lower case, Catalan/Spanish accents folded, the middle dot of "l·l" dropped, so
--    "angel" finds "Àngel" and "gal·la" finds "Gal·la". Pure, so it does not depend on the
--    database collation or the unaccent extension. The last character of the source list (·)
--    has no counterpart, so translate() deletes it.
CREATE OR REPLACE FUNCTION public.admin_search_fold(p_value text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  SELECT pg_catalog.lower(pg_catalog.translate(
    p_value,
    'ÀÁÂÄÃÈÉÊËÌÍÎÏÒÓÔÖÕÙÚÛÜÇÑàáâäãèéêëìíîïòóôöõùúûüçñ·',
    'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucn'
  ));
$$;

REVOKE EXECUTE ON FUNCTION public.admin_search_fold(text) FROM PUBLIC, anon, authenticated, service_role;

-- 2. admin_list_members (V-2) ------------------------------------------------------------------
--    p_state   'active' (default, also for NULL) | 'former' | 'all'
--    p_role    NULL or 'all' (any) | 'member' | 'board' (includes the legacy 'admin') | 'superadmin'
--    p_q       free text, at most 100 characters used; matches, accent- and case-insensitively,
--              "first last", member number, login e-mail, Ludoya and BGG usernames. % and _
--              are literal characters.
--    p_sort    'number_asc' (default, also for NULL) | 'number_desc' | 'name_asc' | 'name_desc'
--              | 'joined_asc' | 'joined_desc' (alta actual) | 'left_asc' | 'left_desc' (data de
--              baixa, active members last). Ties always fall back to the member number.
--    p_limit   default 50, clamped to 1..200;  p_offset  default 0.
--    total_count is the number of rows matching the filters (the same in every row); a page past
--    the end returns no rows.
--    The e-mail comes from auth.users with a LEFT JOIN: a former member whose login account was
--    deleted (anonymisation, S-3) is still listed, with email NULL and has_login false.
CREATE OR REPLACE FUNCTION public.admin_list_members(
  p_state text DEFAULT 'active',
  p_role text DEFAULT NULL,
  p_q text DEFAULT NULL,
  p_sort text DEFAULT 'number_asc',
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
  RETURNS TABLE (
    id uuid,
    member_number text,
    first_name text,
    last_name text,
    email text,
    has_login boolean,
    state text,
    role text,
    membership_start_date date,
    current_joined_on date,
    left_on date,
    total_count integer
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
AS $$
#variable_conflict use_column
DECLARE
  v_state text := COALESCE(p_state, 'active');
  v_role text := NULLIF(p_role, 'all');
  v_sort text := COALESCE(p_sort, 'number_asc');
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  v_offset integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_pattern text;
BEGIN
  PERFORM public.admin_assert_board();

  IF v_state NOT IN ('active', 'former', 'all') THEN
    RAISE EXCEPTION 'admin:invalid_argument: unknown state %', v_state
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_role IS NOT NULL AND v_role NOT IN ('member', 'board', 'superadmin') THEN
    RAISE EXCEPTION 'admin:invalid_argument: unknown role %', v_role
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_sort NOT IN (
    'number_asc', 'number_desc', 'name_asc', 'name_desc',
    'joined_asc', 'joined_desc', 'left_asc', 'left_desc'
  ) THEN
    RAISE EXCEPTION 'admin:invalid_argument: unknown sort'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- LIKE pattern with the wildcards and the escape character escaped
  IF NULLIF(pg_catalog.btrim(p_q), '') IS NOT NULL THEN
    v_pattern := '%' || pg_catalog.replace(pg_catalog.replace(pg_catalog.replace(
      public.admin_search_fold(pg_catalog.left(pg_catalog.btrim(p_q), 100)),
      '\', '\\'), '%', '\%'), '_', '\_') || '%';
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      m.id,
      m.member_number,
      m.first_name,
      m.last_name,
      u.email::text AS email,
      (u.id IS NOT NULL AND u.deleted_at IS NULL) AS has_login,
      CASE WHEN m.left_on IS NULL THEN 'active' ELSE 'former' END AS state,
      m.role,
      m.membership_start_date,
      m.current_joined_on,
      m.left_on,
      -- numeric order of '000-NNN' (also past 999, where the text order breaks)
      pg_catalog.lpad(pg_catalog.regexp_replace(m.member_number, '[^0-9]', '', 'g'), 20, '0') AS number_key,
      public.admin_search_fold(m.first_name || ' ' || m.last_name) AS name_key
    FROM public.members AS m
    LEFT JOIN auth.users AS u ON u.id = m.id
    WHERE m.purged_at IS NULL
      AND (u.id IS NULL OR u.email_confirmed_at IS NOT NULL)          -- BR-22
      AND (
        v_state = 'all'
        OR (v_state = 'active' AND m.left_on IS NULL)
        OR (v_state = 'former' AND m.left_on IS NOT NULL)
      )
      AND (
        v_role IS NULL
        OR (v_role = 'board' AND m.role IN ('board', 'admin'))
        OR m.role = v_role
      )
      AND (
        v_pattern IS NULL
        OR public.admin_search_fold(m.first_name || ' ' || m.last_name) LIKE v_pattern ESCAPE '\'
        OR m.member_number LIKE v_pattern ESCAPE '\'
        OR public.admin_search_fold(u.email::text) LIKE v_pattern ESCAPE '\'
        OR public.admin_search_fold(m.ludoya_username) LIKE v_pattern ESCAPE '\'
        OR public.admin_search_fold(m.bgg_username) LIKE v_pattern ESCAPE '\'
      )
  )
  SELECT
    f.id, f.member_number, f.first_name, f.last_name, f.email, f.has_login, f.state, f.role,
    f.membership_start_date, f.current_joined_on, f.left_on,
    (count(*) OVER ())::integer AS total_count
  FROM filtered AS f
  ORDER BY
    CASE WHEN v_sort = 'number_asc' THEN f.number_key END ASC,
    CASE WHEN v_sort = 'number_desc' THEN f.number_key END DESC,
    CASE WHEN v_sort = 'name_asc' THEN f.name_key END ASC,
    CASE WHEN v_sort = 'name_desc' THEN f.name_key END DESC,
    CASE WHEN v_sort = 'joined_asc' THEN f.current_joined_on END ASC,
    CASE WHEN v_sort = 'joined_desc' THEN f.current_joined_on END DESC,
    CASE WHEN v_sort = 'left_asc' THEN f.left_on END ASC NULLS LAST,
    CASE WHEN v_sort = 'left_desc' THEN f.left_on END DESC NULLS LAST,
    f.number_key ASC
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_members(text, text, text, text, integer, integer)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_members(text, text, text, text, integer, integer)
  TO authenticated;

-- 3. admin_get_member (V-3) --------------------------------------------------------------------
--    One row for a listed member (same rules as admin_list_members), no rows for an unknown
--    number, a purged stub or an unconfirmed sign-up: the screen shows "not found".
--    Active member: name, e-mail, postal code, usernames, newsletter, has_dni / has_phone.
--    Former member (blocked register, BR-20/BR-21): name, e-mail, has_dni, dates, left_by,
--    reason and badges; postal_code, ludoya_username, bgg_username, newsletter_accepted and
--    has_phone are NULL whatever the row still holds. purge_on = left_on + 3 years (spec §4.5).
--    card_valid follows BR-4 (active membership). badges is a JSON array, oldest first, of
--    {badge_key, awarded_at, awarded_by, awarded_by_name}; "Membre {year}" is derived by the app
--    from membership_start_date (BR-6) and is not in it. Earlier leave/rejoin cycles and the
--    member's activity come from admin_list_activity(p_target => id).
CREATE OR REPLACE FUNCTION public.admin_get_member(p_member_number text)
  RETURNS TABLE (
    id uuid,
    member_number text,
    state text,
    first_name text,
    last_name text,
    email text,
    has_login boolean,
    role text,
    role_since timestamptz,
    postal_code text,
    ludoya_username text,
    bgg_username text,
    newsletter_accepted boolean,
    has_dni boolean,
    has_phone boolean,
    membership_start_date date,
    current_joined_on date,
    left_on date,
    left_by text,
    leave_reason text,
    purge_on date,
    anonymised_at timestamptz,
    card_valid boolean,
    card_issued_at timestamptz,
    created_at timestamptz,
    badges jsonb
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.admin_assert_board();

  RETURN QUERY
  SELECT
    m.id,
    m.member_number,
    CASE WHEN m.left_on IS NULL THEN 'active' ELSE 'former' END,
    m.first_name,
    m.last_name,
    u.email::text,
    (u.id IS NOT NULL AND u.deleted_at IS NULL),
    m.role,
    m.role_since,
    CASE WHEN m.left_on IS NULL THEN m.postal_code END,
    CASE WHEN m.left_on IS NULL THEN m.ludoya_username END,
    CASE WHEN m.left_on IS NULL THEN m.bgg_username END,
    CASE WHEN m.left_on IS NULL THEN m.newsletter_accepted END,
    (m.dni_nie_encrypted IS NOT NULL),
    CASE WHEN m.left_on IS NULL THEN (m.phone_encrypted IS NOT NULL) END,
    m.membership_start_date,
    m.current_joined_on,
    m.left_on,
    m.left_by,
    m.leave_reason,
    (m.left_on + interval '3 years')::date,
    m.anonymised_at,
    (m.left_on IS NULL),
    m.card_issued_at,
    m.created_at,
    COALESCE(
      (
        SELECT pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'badge_key', b.badge_key,
            'awarded_at', b.awarded_at,
            'awarded_by', b.awarded_by,
            'awarded_by_name',
              CASE WHEN a.id IS NOT NULL AND a.purged_at IS NULL
                THEN pg_catalog.btrim(a.first_name || ' ' || a.last_name) END
          )
          ORDER BY b.awarded_at, b.badge_key
        )
        FROM public.member_badges AS b
        LEFT JOIN public.members AS a ON a.id = b.awarded_by
        WHERE b.member_id = m.id
      ),
      '[]'::jsonb
    )
  FROM public.members AS m
  LEFT JOIN auth.users AS u ON u.id = m.id
  WHERE m.member_number = p_member_number
    AND m.purged_at IS NULL
    AND (u.id IS NULL OR u.email_confirmed_at IS NOT NULL);          -- BR-22
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_member(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_member(text) TO authenticated;

-- 4. admin_stats (V-1) -------------------------------------------------------------------------
--    One row. Unconfirmed sign-ups never count (BR-22).
--      active_members        no data de baixa
--      former_members        data de baixa, not purged (the V-2 header "N exsocis")
--      joined_this_month     primera alta (membership_start_date) in the month, whatever the
--                            state now; purged stubs keep their dates and still count (§4.5)
--      left_this_month       data de baixa in the month, and split by baixa per:
--      left_this_month_self / left_this_month_board
--      rejoined_this_year    membership.rejoin audit entries written in the year (each return
--                            counts, also two by the same person)
--      newsletter_members    active members who accept the newsletter
--      board_members         active members with a board role (board, legacy admin, superadmin)
--      superadmins           of which superadmins
--    "This month/year" is the Europe/Madrid calendar period of p_reference_date (default today
--    in Madrid). The parameter moves only those period counters, never the current counts.
--    Not here yet: the last cache refresh results (ops_job_runs, T13).
CREATE OR REPLACE FUNCTION public.admin_stats(p_reference_date date DEFAULT NULL)
  RETURNS TABLE (
    active_members integer,
    former_members integer,
    joined_this_month integer,
    left_this_month integer,
    left_this_month_self integer,
    left_this_month_board integer,
    rejoined_this_year integer,
    newsletter_members integer,
    board_members integer,
    superadmins integer
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
AS $$
#variable_conflict use_column
DECLARE
  v_today date := COALESCE(p_reference_date, (now() AT TIME ZONE 'Europe/Madrid')::date);
  v_month_start date := pg_catalog.date_trunc('month', v_today::timestamp)::date;
  v_month_end date := (pg_catalog.date_trunc('month', v_today::timestamp) + interval '1 month')::date;
  -- Madrid midnight of 1 January, as an instant (audit entries are timestamptz)
  v_year_start timestamptz := pg_catalog.date_trunc('year', v_today::timestamp) AT TIME ZONE 'Europe/Madrid';
  v_year_end timestamptz := (pg_catalog.date_trunc('year', v_today::timestamp) + interval '1 year')
                              AT TIME ZONE 'Europe/Madrid';
BEGIN
  PERFORM public.admin_assert_board();

  RETURN QUERY
  WITH listed AS (
    SELECT m.*
    FROM public.members AS m
    WHERE NOT EXISTS (                                                -- BR-22
      SELECT 1 FROM auth.users AS u WHERE u.id = m.id AND u.email_confirmed_at IS NULL
    )
  )
  SELECT
    (count(*) FILTER (WHERE l.left_on IS NULL))::integer,
    (count(*) FILTER (WHERE l.left_on IS NOT NULL AND l.purged_at IS NULL))::integer,
    (count(*) FILTER (
      WHERE l.membership_start_date >= v_month_start AND l.membership_start_date < v_month_end
    ))::integer,
    (count(*) FILTER (WHERE l.left_on >= v_month_start AND l.left_on < v_month_end))::integer,
    (count(*) FILTER (
      WHERE l.left_on >= v_month_start AND l.left_on < v_month_end AND l.left_by = 'self'
    ))::integer,
    (count(*) FILTER (
      WHERE l.left_on >= v_month_start AND l.left_on < v_month_end AND l.left_by = 'board'
    ))::integer,
    (
      SELECT count(*)
      FROM public.audit_log AS a
      WHERE a.action = 'membership.rejoin'
        AND a.created_at >= v_year_start
        AND a.created_at < v_year_end
    )::integer,
    (count(*) FILTER (WHERE l.left_on IS NULL AND l.newsletter_accepted))::integer,
    (count(*) FILTER (
      WHERE l.left_on IS NULL AND l.role IN ('board', 'admin', 'superadmin')
    ))::integer,
    (count(*) FILTER (WHERE l.left_on IS NULL AND l.role = 'superadmin'))::integer
  FROM listed AS l;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_stats(date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_stats(date) TO authenticated;

-- 5. admin_list_activity (V-4) -----------------------------------------------------------------
--    Newest first, keyset pagination on (created_at DESC, id DESC): pass the id of the last row
--    of a page as p_before_id to get the next one (an id that no longer exists gives no rows).
--    Filters, all optional and combined with AND:
--      p_action         an action key ('badge.award') or a group written 'badge.*' (V-4 groups
--                       award/revoke and grant/revoke); anything else matches nothing
--      p_actor          entries by that user
--      p_actor_kind     'system' (no actor: retention job) | 'self' (a member acting on their
--                       own row, e.g. leaving); NULL for any
--      p_target         entries about that member (V-3 history and activity)
--      p_target_number  entries about that member number (also once the target is purged)
--      p_from / p_to    created_at >= p_from and created_at < p_to
--    p_limit default 25, clamped to 1..200. total_count counts the entries matching the filters,
--    ignoring the cursor. actor_name / target_name are the current names (NULL once purged; the
--    target's also once anonymised, spec §5.3: it is then shown by member number only).
CREATE OR REPLACE FUNCTION public.admin_list_activity(
  p_action text DEFAULT NULL,
  p_actor uuid DEFAULT NULL,
  p_target uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_before_id bigint DEFAULT NULL,
  p_actor_kind text DEFAULT NULL,
  p_target_number text DEFAULT NULL
)
  RETURNS TABLE (
    id bigint,
    created_at timestamptz,
    actor_id uuid,
    actor_role text,
    actor_member_number text,
    actor_name text,
    action text,
    target_member_id uuid,
    target_member_number text,
    target_name text,
    details jsonb,
    reason text,
    total_count integer
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
AS $$
#variable_conflict use_column
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 200);
  v_group text;
  v_cursor_at timestamptz;
  v_cursor_id bigint;
BEGIN
  PERFORM public.admin_assert_board();

  IF p_actor_kind IS NOT NULL AND p_actor_kind NOT IN ('system', 'self') THEN
    RAISE EXCEPTION 'admin:invalid_argument: unknown actor kind %', p_actor_kind
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_action LIKE '%.*' THEN
    v_group := pg_catalog.left(p_action, -1);                     -- 'badge.*' -> 'badge.'
  END IF;

  IF p_before_id IS NOT NULL THEN
    SELECT a.created_at, a.id INTO v_cursor_at, v_cursor_id
    FROM public.audit_log AS a
    WHERE a.id = p_before_id;

    IF NOT FOUND THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT a.*
    FROM public.audit_log AS a
    WHERE (p_action IS NULL
           OR (v_group IS NULL AND a.action = p_action)
           OR (v_group IS NOT NULL
               AND pg_catalog.left(a.action, pg_catalog.length(v_group)) = v_group))
      AND (p_actor IS NULL OR a.actor_id = p_actor)
      AND (p_actor_kind IS NULL
           OR (p_actor_kind = 'system' AND a.actor_id IS NULL)
           OR (p_actor_kind = 'self' AND a.actor_id = a.target_member_id))
      AND (p_target IS NULL OR a.target_member_id = p_target)
      AND (p_target_number IS NULL OR a.target_member_number = p_target_number)
      AND (p_from IS NULL OR a.created_at >= p_from)
      AND (p_to IS NULL OR a.created_at < p_to)
  )
  SELECT
    f.id,
    f.created_at,
    f.actor_id,
    f.actor_role,
    f.actor_member_number,
    CASE WHEN act.id IS NOT NULL AND act.purged_at IS NULL
      THEN pg_catalog.btrim(act.first_name || ' ' || act.last_name) END,
    f.action,
    f.target_member_id,
    f.target_member_number,
    CASE WHEN tgt.id IS NOT NULL AND tgt.purged_at IS NULL AND tgt.anonymised_at IS NULL
      THEN pg_catalog.btrim(tgt.first_name || ' ' || tgt.last_name) END,
    f.details,
    f.reason,
    (SELECT count(*) FROM filtered)::integer
  FROM filtered AS f
  LEFT JOIN public.members AS act ON act.id = f.actor_id
  LEFT JOIN public.members AS tgt ON tgt.id = f.target_member_id
  WHERE v_cursor_id IS NULL OR (f.created_at, f.id) < (v_cursor_at, v_cursor_id)
  ORDER BY f.created_at DESC, f.id DESC
  LIMIT v_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_activity(text, uuid, uuid, timestamptz, timestamptz, integer, bigint, text, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_activity(text, uuid, uuid, timestamptz, timestamptz, integer, bigint, text, text)
  TO authenticated;

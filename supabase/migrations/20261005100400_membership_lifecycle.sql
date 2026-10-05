-- Migration M5: leaving and returning (admin panel spec §4.2–§4.4, A-6, A-7, M-1; BR-1..BR-8,
-- BR-12, BR-18, BR-20).
--
-- Three functions, each one transaction that changes the member row, blocks or unblocks the
-- login account and writes exactly one audit entry (audit_write(), M3):
--   admin_member_leave(p_member_id, p_reason, p_left_on)   A-6  board+ gives an active member baixa
--   member_leave_self(p_reason)                            M-1  the caller leaves
--   admin_member_rejoin(p_member_id, p_channel, p_note)    A-7  board+ reinstates a former member
-- E-mails (the baixa notice with the reason, BR-8; "Tornes a ser soci") are sent by the T10
-- server actions after the call succeeds; nothing here sends mail.
--
-- On a leave (both paths, internal membership_close()):
--   - left_on, left_by ('board' | 'self'), leave_reason;
--   - deleted at once (§4.2, BR-20): phone_encrypted, postal_code, ludoya_username, bgg_username;
--     newsletter_accepted = false (BR-5). Kept, blocked: number, names, DNI, dates, badges;
--   - a new card_token and card_issued_at, so no card printed before stays valid (BR-4; the
--     state check in verify_card_token already refuses it, the rotation makes it permanent);
--   - the login account is banned (auth.users.banned_until = now() + 100 years) and every
--     session and refresh token of that user is deleted (BR-18, §4.4). Auth refuses a banned
--     user for password login, OTP/magic/recovery links and refresh; an access token already
--     issued stays valid until it expires (default 1 h) but has_role(), members_update_own and
--     is_email_confirmed() all treat the person as former from this commit on.
-- On a return: left_on, left_by and leave_reason cleared, current_joined_on = today (Madrid),
-- membership_start_date untouched (primera alta, BR-6), same member number (BR-2), the ban
-- lifted (the old password works again, §4.3), a new card token, newsletter stays off.
--
-- Rules and their provisional constants (D-E, D-H in odd/tasks/admin-panel.md; each lives in
-- exactly one function below):
--   - board reason: at least membership_leave_reason_min_length() = 5 characters after trim,
--     at most 500 (members_leave_reason_length). A self leave takes an optional reason.
--   - board leave date: default today in Europe/Madrid; never in the future (A-6), never before
--     the current alta, and at most membership_leave_max_backdate_days() = 365 days back (a
--     typo cannot purge a record at once; the purge date is left_on + 3 years, D-H).
--   - nobody gives themselves a board baixa (they use M-1); BR-12: a member holding a role
--     (admin, board, superadmin) cannot leave by either path; the role is revoked first. This
--     also covers BR-10 (a superadmin always holds a role).
--   - rejoin: only a former member whose register is still blocked (not anonymised, not
--     purged) and whose login account still exists. The account is the identity: the spec keeps
--     the old password (§4.3) and members has no e-mail of its own, so a former member whose
--     account is gone cannot be matched to a new sign-up. Such a person signs up again (new
--     row and number) and the board resolves the duplicate (P-1 step 4). handle_new_user is
--     unchanged.
--   - request channel (A-7): 'form' | 'email' | 'in_person' | 'other' (formulari, correu, en
--     persona, altre). The optional note goes to the audit reason column, at most 500. The P-1
--     checklist is UI-only (D-E).
--   Audit details (BR-15: dates as 'YYYY-MM-DD' strings, field names never values):
--     membership.leave   {"left_by": "board"|"self", "left_on": "YYYY-MM-DD"}, reason = motiu
--     membership.rejoin  {"channel": "...", "previous_left_on": "YYYY-MM-DD",
--                         "previous_left_by": "board"|"self"}, reason = note
--
-- Errors (the message starts with a stable prefix the app maps to a translated text):
--   membership:forbidden         42501  caller is not an active board member or higher (A-6,
--                                       A-7), or has no member row (M-1)
--   membership:not_found         22023  unknown member, or a sign-up never confirmed (BR-22)
--   membership:self_target       22023  admin_member_leave on the caller (use M-1)
--   membership:not_active        22023  the member (or the M-1 caller) is already former
--   membership:role_held         23514  BR-12: the member holds a role; revoke it first
--   membership:reason_required   22023  board reason missing or shorter than 5 after trim
--   membership:reason_too_long   22023  reason longer than 500
--   membership:invalid_date      22023  leave date in the future, before the current alta or
--                                       more than 365 days back
--   membership:not_former        22023  rejoin of an active member
--   membership:register_closed   22023  rejoin of an anonymised (S-3) or purged record
--   membership:no_login          22023  rejoin of a former member whose login account is gone
--   membership:invalid_channel   22023  rejoin channel not in the list above
--   membership:note_too_long     22023  rejoin note longer than 500
-- anon and service_role have no EXECUTE (Postgres "permission denied", 42501): the functions
-- need the caller's JWT subject. Never REPEATABLE READ: the role guard's BR-10 count relies on
-- READ COMMITTED.
--
-- Also here (T5 verification follow-up): admin_list_members no longer matches a former
-- member's Ludoya/BGG username in p_q (BR-20/21: admin_get_member masks them, so search must
-- not confirm them either), and admin_search_fold folds ŀ/Ŀ (U+0140/U+013F) like "l".
--
-- Needs M1–M4. Safe to apply to production before the code that uses it: nothing calls these
-- functions yet, and the admin_list_members change only narrows the search.

-- 1. Constants and internal helpers -------------------------------------------------------------
--    No API role can execute them; the functions below call them with owner privileges.

--    D-E (provisional): minimum length of a board baixa reason, after trim.
CREATE OR REPLACE FUNCTION public.membership_leave_reason_min_length()
  RETURNS integer
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  SELECT 5;
$$;

--    D-H (provisional): how many days back a board baixa may be dated.
CREATE OR REPLACE FUNCTION public.membership_leave_max_backdate_days()
  RETURNS integer
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  SELECT 365;
$$;

--    Today in the association's time zone (the database runs in UTC, so CURRENT_DATE is
--    yesterday between 00:00 and 02:00 in Barcelona).
CREATE OR REPLACE FUNCTION public.membership_today()
  RETURNS date
  LANGUAGE sql
  STABLE
  SET search_path TO ''
AS $$
  SELECT (pg_catalog.now() AT TIME ZONE 'Europe/Madrid')::date;
$$;

--    The shared part of both leave paths: callers have already checked permissions, state, role,
--    reason and date, and hold the row lock. The role guard (M2) still fires on left_on as the
--    backstop for BR-10/BR-12. Returns the audit entry id.
CREATE OR REPLACE FUNCTION public.membership_close(
  p_member_id uuid,
  p_left_on date,
  p_left_by text,
  p_reason text
)
  RETURNS bigint
  LANGUAGE plpgsql
  SET search_path TO ''
AS $$
BEGIN
  UPDATE public.members
  SET left_on = p_left_on,
      left_by = p_left_by,
      leave_reason = p_reason,
      phone_encrypted = NULL,
      postal_code = NULL,
      ludoya_username = NULL,
      bgg_username = NULL,
      newsletter_accepted = false,
      card_token = public.generate_card_token(),
      card_issued_at = pg_catalog.now()
  WHERE id = p_member_id;

  -- BR-18: Auth's native ban, and every open session ends (refresh tokens cascade from
  -- sessions; the user_id delete also catches tokens without a session).
  UPDATE auth.users
  SET banned_until = pg_catalog.now() + interval '100 years',
      updated_at = pg_catalog.now()
  WHERE id = p_member_id;

  DELETE FROM auth.sessions WHERE user_id = p_member_id;
  DELETE FROM auth.refresh_tokens WHERE user_id = p_member_id::text;

  RETURN public.audit_write(
    'membership.leave',
    p_member_id,
    pg_catalog.jsonb_build_object(
      'left_by', p_left_by,
      'left_on', pg_catalog.to_char(p_left_on, 'YYYY-MM-DD')
    ),
    p_reason
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.membership_leave_reason_min_length() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.membership_leave_max_backdate_days() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.membership_today() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.membership_close(uuid, date, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- 2. admin_member_leave (A-6) -------------------------------------------------------------------
--    p_left_on NULL (the default) means today in Madrid. Returns what the T10 action needs for
--    the baixa e-mail (BR-8): number, login e-mail, first name and the date recorded.
CREATE OR REPLACE FUNCTION public.admin_member_leave(
  p_member_id uuid,
  p_reason text,
  p_left_on date DEFAULT NULL
)
  RETURNS TABLE (member_number text, email text, first_name text, left_on date)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
#variable_conflict use_column
DECLARE
  v_today date := public.membership_today();
  v_left_on date := COALESCE(p_left_on, public.membership_today());
  v_reason text := NULLIF(pg_catalog.btrim(p_reason), '');
  v_number text;
  v_first_name text;
  v_role text;
  v_current_left_on date;
  v_joined date;
  v_email text;
BEGIN
  IF NOT public.has_role('board') THEN
    RAISE EXCEPTION 'membership:forbidden: board role required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT m.member_number, m.first_name, m.role, m.left_on, m.current_joined_on, u.email::text
  INTO v_number, v_first_name, v_role, v_current_left_on, v_joined, v_email
  FROM public.members AS m
  JOIN auth.users AS u ON u.id = m.id
  WHERE m.id = p_member_id
    AND u.email_confirmed_at IS NOT NULL
  FOR UPDATE OF m;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'membership:not_found: unknown member'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_member_id = auth.uid() THEN
    RAISE EXCEPTION 'membership:self_target: use member_leave_self to leave yourself'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_current_left_on IS NOT NULL THEN
    RAISE EXCEPTION 'membership:not_active: the member has already left'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_role <> 'member' THEN
    RAISE EXCEPTION 'membership:role_held: a superadmin must revoke the role before the baixa'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_reason IS NULL OR pg_catalog.char_length(v_reason) < public.membership_leave_reason_min_length() THEN
    RAISE EXCEPTION 'membership:reason_required: a baixa given by the board needs a reason of at least % characters',
      public.membership_leave_reason_min_length()
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF pg_catalog.char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'membership:reason_too_long: at most 500 characters'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_left_on > v_today
     OR v_left_on < v_joined
     OR v_left_on < v_today - public.membership_leave_max_backdate_days() THEN
    RAISE EXCEPTION 'membership:invalid_date: the date cannot be in the future, before the current alta or more than % days back',
      public.membership_leave_max_backdate_days()
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM public.membership_close(p_member_id, v_left_on, 'board', v_reason);

  RETURN QUERY SELECT v_number, v_email, v_first_name, v_left_on;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_member_leave(uuid, text, date) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_member_leave(uuid, text, date) TO authenticated;

-- 3. member_leave_self (M-1) --------------------------------------------------------------------
--    The caller leaves today. The reason is optional. The T26 action signs the browser out
--    afterwards (the server-side sessions are already gone).
CREATE OR REPLACE FUNCTION public.member_leave_self(p_reason text DEFAULT NULL)
  RETURNS TABLE (member_number text, left_on date)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
#variable_conflict use_column
DECLARE
  v_caller uuid := auth.uid();
  v_today date := public.membership_today();
  v_reason text := NULLIF(pg_catalog.btrim(p_reason), '');
  v_number text;
  v_role text;
  v_current_left_on date;
BEGIN
  IF v_caller IS NOT NULL THEN
    SELECT m.member_number, m.role, m.left_on
    INTO v_number, v_role, v_current_left_on
    FROM public.members AS m
    WHERE m.id = v_caller
    FOR UPDATE;
  END IF;

  IF v_caller IS NULL OR v_number IS NULL THEN
    RAISE EXCEPTION 'membership:forbidden: a signed-in member is required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_current_left_on IS NOT NULL THEN
    RAISE EXCEPTION 'membership:not_active: you have already left'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_role <> 'member' THEN
    RAISE EXCEPTION 'membership:role_held: a superadmin must revoke your role before you leave'
      USING ERRCODE = 'check_violation';
  END IF;

  IF pg_catalog.char_length(v_reason) > 500 THEN
    RAISE EXCEPTION 'membership:reason_too_long: at most 500 characters'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM public.membership_close(v_caller, v_today, 'self', v_reason);

  RETURN QUERY SELECT v_number, v_today;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.member_leave_self(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.member_leave_self(text) TO authenticated;

-- 4. admin_member_rejoin (A-7) ------------------------------------------------------------------
--    Returns what the T10 action needs for the "Tornes a ser soci" e-mail.
CREATE OR REPLACE FUNCTION public.admin_member_rejoin(
  p_member_id uuid,
  p_channel text,
  p_note text DEFAULT NULL
)
  RETURNS TABLE (member_number text, email text, first_name text, current_joined_on date)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
#variable_conflict use_column
DECLARE
  v_today date := public.membership_today();
  v_note text := NULLIF(pg_catalog.btrim(p_note), '');
  v_number text;
  v_first_name text;
  v_left_on date;
  v_left_by text;
  v_anonymised_at timestamptz;
  v_purged_at timestamptz;
  v_has_login boolean;
  v_email text;
BEGIN
  IF NOT public.has_role('board') THEN
    RAISE EXCEPTION 'membership:forbidden: board role required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT m.member_number, m.first_name, m.left_on, m.left_by, m.anonymised_at, m.purged_at,
         (u.id IS NOT NULL AND u.deleted_at IS NULL), u.email::text
  INTO v_number, v_first_name, v_left_on, v_left_by, v_anonymised_at, v_purged_at,
       v_has_login, v_email
  FROM public.members AS m
  LEFT JOIN auth.users AS u ON u.id = m.id
  WHERE m.id = p_member_id
    AND (u.id IS NULL OR u.email_confirmed_at IS NOT NULL)            -- BR-22
  FOR UPDATE OF m;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'membership:not_found: unknown member'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_left_on IS NULL THEN
    RAISE EXCEPTION 'membership:not_former: the member is active'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_anonymised_at IS NOT NULL OR v_purged_at IS NOT NULL THEN
    RAISE EXCEPTION 'membership:register_closed: an anonymised or purged record cannot return; the person signs up again'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF NOT v_has_login THEN
    RAISE EXCEPTION 'membership:no_login: the login account no longer exists; the person signs up again'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_channel IS NULL OR p_channel NOT IN ('form', 'email', 'in_person', 'other') THEN
    RAISE EXCEPTION 'membership:invalid_channel: form, email, in_person or other'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF pg_catalog.char_length(v_note) > 500 THEN
    RAISE EXCEPTION 'membership:note_too_long: at most 500 characters'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.members
  SET left_on = NULL,
      left_by = NULL,
      leave_reason = NULL,
      current_joined_on = v_today,
      card_token = public.generate_card_token(),
      card_issued_at = pg_catalog.now()
  WHERE id = p_member_id;

  UPDATE auth.users
  SET banned_until = NULL,
      updated_at = pg_catalog.now()
  WHERE id = p_member_id;

  PERFORM public.audit_write(
    'membership.rejoin',
    p_member_id,
    pg_catalog.jsonb_build_object(
      'channel', p_channel,
      'previous_left_on', pg_catalog.to_char(v_left_on, 'YYYY-MM-DD'),
      'previous_left_by', v_left_by
    ),
    v_note
  );

  RETURN QUERY SELECT v_number, v_email, v_first_name, v_today;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_member_rejoin(uuid, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_member_rejoin(uuid, text, text) TO authenticated;

-- 5. Search fixes for admin_list_members (T5 follow-up) -----------------------------------------
--    Same as 20261005100300_admin_read_rpcs.sql plus ŀ/Ŀ folded to l/L (Catalan "l geminada"
--    written with the single code point). The middle dot stays last, without a counterpart, so
--    translate() still deletes it.
CREATE OR REPLACE FUNCTION public.admin_search_fold(p_value text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  SELECT pg_catalog.lower(pg_catalog.translate(
    p_value,
    'ÀÁÂÄÃÈÉÊËÌÍÎÏÒÓÔÖÕÙÚÛÜÇÑàáâäãèéêëìíîïòóôöõùúûüçñĿŀ·',
    'AAAAAEEEEIIIIOOOOOUUUUCNaaaaaeeeeiiiiooooouuuucnLl'
  ));
$$;

REVOKE EXECUTE ON FUNCTION public.admin_search_fold(text) FROM PUBLIC, anon, authenticated, service_role;

--    Same signature, grants and body as in 20261005100300_admin_read_rpcs.sql, except that the
--    Ludoya/BGG usernames are searched only on active rows: a former member's usernames are
--    deleted on leave and masked by admin_get_member (BR-20/21), so a leftover value must not
--    be confirmable through search either.
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
        OR (m.left_on IS NULL AND public.admin_search_fold(m.ludoya_username) LIKE v_pattern ESCAPE '\')
        OR (m.left_on IS NULL AND public.admin_search_fold(m.bgg_username) LIKE v_pattern ESCAPE '\')
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

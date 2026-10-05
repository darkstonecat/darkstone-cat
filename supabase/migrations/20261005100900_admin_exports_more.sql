-- Migration: the e-mail lists (A-16), the llibre de socis (S-4), and a written reason for
-- exporting a former member's data (A-11, BR-21)
--
-- Spec docs/admin-panel/spec.md: A-11, A-16, S-4, §5.1 (export.member_data, export.emails,
-- export.member_register), BR-15, BR-21, BR-22, BR-23. Decision D-B (2026-10-05): the llibre
-- includes the DNI (member number, names, DNI/NIE, first sign-up, current sign-up, leave date,
-- left by). Needs M1–M9 (20261005100800_admin_exports.sql and everything before it).
--
-- Same pattern as 20261005100800: SECURITY DEFINER, search_path '', EXECUTE for `authenticated`
-- only (anon and service_role get "permission denied"), the role checked inside with has_role()
-- and the actor taken from auth.uid(); the routes call them with the user's SESSION client. Each
-- function writes its audit entry with audit_write() in the same transaction as the read and
-- returns the rows only from that transaction: if the entry cannot be written, nothing is
-- served. log_admin_event() loses the last two export keys, so no export can be logged without
-- the read it describes.
--
-- 1. admin_export_member_data(p_member_id, p_reason): a former member's file holds the blocked
--    DNI, so exporting it needs the same written reason as revealing it (A-5, BR-21): at least
--    admin_reveal_reason_min_length() characters after trim, at most admin_reason_max_length().
--    The reason is stored in the entry's reason column. An active member's export takes an
--    optional reason (stored when given, like the reveal).
-- 2. admin_export_emails(p_list): board+. 'association' = every active, confirmed member;
--    'newsletter' = those of them who accepted the newsletter (BR-23). Never a former member, a
--    purged stub or an unconfirmed sign-up (BR-22). Only name and e-mail leave the database.
-- 3. admin_export_register(p_reason): superadmin only. One row per member, active or former
--    (blocked records included: BR-21's one exception), never a purged stub (spec S-4) or an
--    unconfirmed sign-up (BR-22, not a member). The DNI leaves as ciphertext bound to the row;
--    the route decrypts it with the row id. Reason required as in 1 (the file carries former
--    members' DNI; the dialog's "legal purpose" checkbox is not a reason the log can show).

-- 1. admin_export_member_data with a reason (A-11, BR-21) -----------------------------------------
--    The one-argument version is dropped: a second overload would keep the reasonless path open.
DROP FUNCTION IF EXISTS public.admin_export_member_data(uuid);

CREATE OR REPLACE FUNCTION public.admin_export_member_data(p_member_id uuid, p_reason text DEFAULT NULL)
  RETURNS TABLE (
    id uuid,
    member_number text,
    state text,
    email text,
    first_name text,
    last_name text,
    phone_encrypted text,
    dni_nie_encrypted text,
    postal_code text,
    ludoya_username text,
    bgg_username text,
    role text,
    newsletter_accepted boolean,
    membership_start_date date,
    current_joined_on date,
    left_on date,
    left_by text,
    leave_reason text,
    created_at timestamptz,
    badges jsonb
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
#variable_conflict use_column
DECLARE
  v_reason text := NULLIF(pg_catalog.btrim(p_reason), '');
  v_row public.members;
  v_state text;
BEGIN
  PERFORM public.admin_assert_board();
  PERFORM public.admin_assert_reason_length(v_reason);

  -- Confirmed and not purged, locked so a concurrent baixa cannot change the state between the
  -- check below and the read.
  v_row := public.admin_lock_member(p_member_id);
  v_state := CASE WHEN v_row.left_on IS NULL THEN 'active' ELSE 'former' END;

  IF v_state = 'former' THEN
    IF NOT public.has_role(public.admin_member_data_former_min_role()) THEN
      RAISE EXCEPTION 'admin:forbidden: only a superadmin can export a former member''s data'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF v_reason IS NULL OR pg_catalog.char_length(v_reason) < public.admin_reveal_reason_min_length() THEN
      RAISE EXCEPTION 'admin:reason_required: exporting a former member''s data needs a reason of at least % characters',
        public.admin_reveal_reason_min_length()
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;

  PERFORM public.audit_write(
    'export.member_data',
    p_member_id,
    pg_catalog.jsonb_build_object('state', v_state),
    v_reason
  );

  RETURN QUERY
  SELECT
    m.id,
    m.member_number,
    v_state,
    u.email::text,
    m.first_name,
    m.last_name,
    m.phone_encrypted,
    m.dni_nie_encrypted,
    m.postal_code,
    m.ludoya_username,
    m.bgg_username,
    m.role,
    m.newsletter_accepted,
    m.membership_start_date,
    m.current_joined_on,
    m.left_on,
    m.left_by,
    m.leave_reason,
    m.created_at,
    COALESCE(
      (
        SELECT pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object('key', b.badge_key, 'awarded_at', b.awarded_at)
          ORDER BY b.awarded_at, b.badge_key
        )
        FROM public.member_badges AS b
        WHERE b.member_id = m.id
      ),
      '[]'::jsonb
    )
  FROM public.members AS m
  LEFT JOIN auth.users AS u ON u.id = m.id
  WHERE m.id = p_member_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_export_member_data(uuid, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_export_member_data(uuid, text) TO authenticated;

-- 2. admin_export_emails (A-16) -------------------------------------------------------------------
--    Ordered by member number. Audit export.emails, no target, details
--    {"list":<list>,"rows":<n>} (n = addresses returned, a JSON number). total_rows lets the
--    route detect a response capped by PostgREST max_rows. Unknown list → admin:invalid_argument
--    (22023), no entry.
CREATE OR REPLACE FUNCTION public.admin_export_emails(p_list text)
  RETURNS TABLE (
    first_name text,
    last_name text,
    email text,
    total_rows integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
#variable_conflict use_column
DECLARE
  v_rows integer;
BEGIN
  PERFORM public.admin_assert_board();

  IF p_list IS NULL OR p_list NOT IN ('association', 'newsletter') THEN
    RAISE EXCEPTION 'admin:invalid_argument: the list is association or newsletter'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- The rows stay in this function's result until it returns: the entry below is written
  -- before anything reaches the caller, and a failure to write it fails the whole call.
  RETURN QUERY
  SELECT
    m.first_name,
    m.last_name,
    u.email::text,
    (pg_catalog.count(*) OVER ())::integer
  FROM public.members AS m
  JOIN auth.users AS u ON u.id = m.id
  WHERE m.left_on IS NULL                                            -- BR-23: never a former member
    AND m.purged_at IS NULL
    AND u.email_confirmed_at IS NOT NULL                             -- BR-22
    AND u.email IS NOT NULL
    AND (p_list = 'association' OR m.newsletter_accepted IS TRUE)   -- BR-23: consent
  ORDER BY m.member_number;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  PERFORM public.audit_write(
    'export.emails',
    NULL,
    pg_catalog.jsonb_build_object('list', p_list, 'rows', v_rows),
    NULL
  );

  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_export_emails(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_export_emails(text) TO authenticated;

-- 3. admin_export_register (S-4, D-B) -------------------------------------------------------------
--    Ordered by member number. A former member whose login account is gone (anonymised, S-3)
--    is still in the register until the purge. Audit export.member_register, no target, details
--    {"rows":<n>} (the row count, §5.1, a JSON number), the reason in the reason column.
--    The role check comes before the reason check, so a board member always gets
--    admin:forbidden.
CREATE OR REPLACE FUNCTION public.admin_export_register(p_reason text DEFAULT NULL)
  RETURNS TABLE (
    id uuid,
    member_number text,
    first_name text,
    last_name text,
    dni_nie_encrypted text,
    membership_start_date date,
    current_joined_on date,
    left_on date,
    left_by text,
    total_rows integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
#variable_conflict use_column
DECLARE
  v_reason text := NULLIF(pg_catalog.btrim(p_reason), '');
  v_rows integer;
BEGIN
  IF NOT public.has_role('superadmin') THEN
    RAISE EXCEPTION 'admin:forbidden: superadmin role required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM public.admin_assert_reason_length(v_reason);

  IF v_reason IS NULL OR pg_catalog.char_length(v_reason) < public.admin_reveal_reason_min_length() THEN
    RAISE EXCEPTION 'admin:reason_required: the llibre de socis needs a reason of at least % characters',
      public.admin_reveal_reason_min_length()
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- The rows stay in this function's result until it returns: the entry below is written
  -- before anything reaches the caller, and a failure to write it fails the whole call.
  RETURN QUERY
  SELECT
    m.id,
    m.member_number,
    m.first_name,
    m.last_name,
    m.dni_nie_encrypted,
    m.membership_start_date,
    m.current_joined_on,
    m.left_on,
    m.left_by,
    (pg_catalog.count(*) OVER ())::integer
  FROM public.members AS m
  LEFT JOIN auth.users AS u ON u.id = m.id
  WHERE m.purged_at IS NULL                                          -- S-4: purged stubs excluded
    AND (u.id IS NULL OR u.email_confirmed_at IS NOT NULL)            -- BR-22
  ORDER BY m.member_number;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  PERFORM public.audit_write(
    'export.member_register',
    NULL,
    pg_catalog.jsonb_build_object('rows', v_rows),
    v_reason
  );

  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_export_register(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_export_register(text) TO authenticated;

-- 4. log_admin_event without any export key -------------------------------------------------------
--    Same signature, grants and body as in 20261005100800_admin_exports.sql, minus
--    export.member_register and export.emails (the functions in §2 and §3 log them), and so
--    without the superadmin check that only export.member_register needed. Target rules now:
--      member.send_access_link  needs an active member that is not purged (A-15);
--      ops.cache_refresh  takes none.
CREATE OR REPLACE FUNCTION public.log_admin_event(
  p_action text,
  p_target uuid,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_reason text DEFAULT NULL
)
  RETURNS bigint
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  entry_details jsonb := COALESCE(p_details, '{}'::jsonb);
  target_left_on date;
BEGIN
  IF NOT public.has_role('board') THEN
    RAISE EXCEPTION 'audit:forbidden: board role required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_action IS NULL OR p_action NOT IN ('member.send_access_link', 'ops.cache_refresh') THEN
    RAISE EXCEPTION 'audit:action_not_allowed: % cannot be logged directly', COALESCE(p_action, 'NULL')
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF pg_catalog.jsonb_typeof(entry_details) <> 'object' THEN
    RAISE EXCEPTION 'audit:invalid_details: details must be a JSON object'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_action = 'member.send_access_link' THEN
    IF p_target IS NULL THEN
      RAISE EXCEPTION 'audit:invalid_target: % needs a target member', p_action
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    SELECT m.left_on INTO target_left_on
    FROM public.members AS m
    WHERE m.id = p_target
      AND m.purged_at IS NULL;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'audit:invalid_target: unknown or purged member'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF target_left_on IS NOT NULL THEN
      RAISE EXCEPTION 'audit:invalid_target: an access link goes to active members only'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
  ELSIF p_target IS NOT NULL THEN
    RAISE EXCEPTION 'audit:invalid_target: % takes no target member', p_action
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN public.audit_write(p_action, p_target, entry_details, p_reason);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_admin_event(text, uuid, jsonb, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.log_admin_event(text, uuid, jsonb, text) TO authenticated;

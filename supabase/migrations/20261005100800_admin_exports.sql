-- Migration: audited exports, the member CSV (A-10) and one member's data (A-11)
--
-- Spec docs/admin-panel/spec.md: A-10, A-11, §5.1 (export.members_csv, export.member_data),
-- BR-15, BR-21, BR-22. Needs M1–M8 (membership columns, has_role, audit_log, admin helpers, the
-- members_ciphertext_guard trigger and BR-15 detector v3 of 20261005100700).
--
-- Each function writes its audit entry with audit_write() in the same transaction as the read
-- and returns the rows only from that transaction: if the entry cannot be written, the call
-- fails and nothing is served (the T3 follow-up "log before serving, fail closed"). The app no
-- longer logs these two events itself, so they leave the log_admin_event() whitelist (§3).
--
-- EXECUTE model. Both functions return DNI/phone ciphertext (the routes decrypt it with the row
-- id, src/lib/encryption.ts). They are EXECUTE for `authenticated` only, check board+ inside
-- (has_role, so a former member or an unknown role is refused) and take the actor from
-- auth.uid(): the routes call them with the user's SESSION client after getAdminAccess().
--   - Why not service_role with an actor parameter: the audit actor would then be whatever the
--     server passes, not the authenticated user, and auth.uid() (needed by has_role and by
--     audit_write's actor snapshot) is NULL without a user JWT.
--   - Ciphertext reaching the route handler is fine: it runs on the server, and the plain value
--     exists only in the response body (never in logs, BR-15).
--   - A board session that calls the RPC straight from the browser gets only ciphertext bound
--     to each member (AES-GCM AAD "member:<uuid>", v2 format): without ENCRYPTION_KEY
--     (server-only) it cannot decrypt it, and members_ciphertext_guard refuses copying it into
--     its own row (the T7 finding), so /profile/edit cannot decrypt it either. That call is
--     audited exactly like a download. What leaks is the length of the ciphertext.
--   - anon and service_role get "permission denied".
--
-- Not in the whitelisted filters (A-10): search text and sort. The CSV is always active members
-- only (BR-21); the only filter is the V-2 role filter. PostgREST caps a response at
-- `max_rows` (1000 in supabase/config.toml): every row carries total_rows, so the route can
-- refuse to serve a truncated CSV.

-- 1. A-11 on a former member: who may export it (D-D, provisional) --------------------------------
--    The open decision D-D proposes superadmin only. This is the one place that sets it: change
--    'superadmin' to 'board' here to open it to the board.
CREATE OR REPLACE FUNCTION public.admin_member_data_former_min_role()
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  SELECT 'superadmin'::text
$$;

REVOKE EXECUTE ON FUNCTION public.admin_member_data_former_min_role() FROM PUBLIC, anon, authenticated, service_role;

-- 2. admin_export_members (A-10) ------------------------------------------------------------------
--    Active members only (no data de baixa), never a former member's blocked record (BR-21),
--    never an unconfirmed sign-up (BR-22), never a purged stub. p_role: NULL/'all' | member |
--    board (includes the legacy admin role) | superadmin, as admin_list_members. Ordered by
--    member number. Audit export.members_csv, no target, details
--    {"filter":{"state":"active","role":<filter>},"rows":<n>} (the count as a JSON number,
--    BR-15 safe). total_rows = rows returned by this call.
CREATE OR REPLACE FUNCTION public.admin_export_members(p_role text DEFAULT NULL)
  RETURNS TABLE (
    id uuid,
    member_number text,
    first_name text,
    last_name text,
    email text,
    phone_encrypted text,
    dni_nie_encrypted text,
    postal_code text,
    ludoya_username text,
    bgg_username text,
    role text,
    newsletter_accepted boolean,
    membership_start_date date,
    current_joined_on date,
    created_at timestamptz,
    total_rows integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
#variable_conflict use_column
DECLARE
  v_role text := NULLIF(p_role, 'all');
  v_rows integer;
BEGIN
  PERFORM public.admin_assert_board();

  IF v_role IS NOT NULL AND v_role NOT IN ('member', 'board', 'superadmin') THEN
    RAISE EXCEPTION 'admin:invalid_argument: unknown role filter'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- The rows stay in this function's result until it returns, so the entry below is written
  -- before anything reaches the caller, and a failure to write it fails the whole call.
  RETURN QUERY
  SELECT
    m.id,
    m.member_number,
    m.first_name,
    m.last_name,
    u.email::text,
    m.phone_encrypted,
    m.dni_nie_encrypted,
    m.postal_code,
    m.ludoya_username,
    m.bgg_username,
    m.role,
    m.newsletter_accepted,
    m.membership_start_date,
    m.current_joined_on,
    m.created_at,
    (pg_catalog.count(*) OVER ())::integer
  FROM public.members AS m
  LEFT JOIN auth.users AS u ON u.id = m.id
  WHERE m.left_on IS NULL                                            -- BR-21
    AND m.purged_at IS NULL
    AND (u.id IS NULL OR u.email_confirmed_at IS NOT NULL)            -- BR-22
    AND (
      v_role IS NULL
      OR (v_role = 'board' AND m.role IN ('board', 'admin'))
      OR m.role = v_role
    )
  ORDER BY m.member_number;

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  PERFORM public.audit_write(
    'export.members_csv',
    NULL,
    pg_catalog.jsonb_build_object(
      'filter', pg_catalog.jsonb_build_object('state', 'active', 'role', COALESCE(v_role, 'all')),
      'rows', v_rows
    ),
    NULL
  );

  RETURN;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_export_members(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_export_members(text) TO authenticated;

-- 3. admin_export_member_data (A-11) --------------------------------------------------------------
--    One row: the fields of the member's own JSON download (exportProfileData) as stored, plus
--    the membership fields the association holds (current_joined_on, left_on, left_by,
--    leave_reason) and the badges as [{key, awarded_at}]. "Whatever data the association still
--    holds": a former member's row is returned as it is (contact data is already gone after the
--    baixa, §4.2; an anonymised record has no e-mail once its login is deleted). Board+ for an
--    active member; a former member needs admin_member_data_former_min_role() (D-D). Unknown,
--    purged or unconfirmed (BR-22) → admin:not_found. Audit export.member_data, target the
--    member, details {"state":"active"|"former"}.
CREATE OR REPLACE FUNCTION public.admin_export_member_data(p_member_id uuid)
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
  v_row public.members;
  v_state text;
BEGIN
  PERFORM public.admin_assert_board();

  -- Confirmed and not purged, locked so a concurrent baixa cannot change the state between the
  -- check below and the read.
  v_row := public.admin_lock_member(p_member_id);
  v_state := CASE WHEN v_row.left_on IS NULL THEN 'active' ELSE 'former' END;

  IF v_state = 'former' AND NOT public.has_role(public.admin_member_data_former_min_role()) THEN
    RAISE EXCEPTION 'admin:forbidden: only a superadmin can export a former member''s data'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  PERFORM public.audit_write(
    'export.member_data',
    p_member_id,
    pg_catalog.jsonb_build_object('state', v_state),
    NULL
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

REVOKE EXECUTE ON FUNCTION public.admin_export_member_data(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_export_member_data(uuid) TO authenticated;

-- 4. log_admin_event without export.members_csv and export.member_data ----------------------------
--    Same signature, grants and body as in 20261005100500_member_admin_mutations.sql, minus the
--    two exports above (the functions in §2 and §3 log them). Target rules now:
--      member.send_access_link  needs an active member that is not purged (A-15);
--      export.member_register, export.emails, ops.cache_refresh  take none.
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

  IF p_action IS NULL OR p_action NOT IN (
    'export.member_register', 'export.emails', 'member.send_access_link', 'ops.cache_refresh'
  ) THEN
    RAISE EXCEPTION 'audit:action_not_allowed: % cannot be logged directly', COALESCE(p_action, 'NULL')
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_action = 'export.member_register' AND NOT public.has_role('superadmin') THEN
    RAISE EXCEPTION 'audit:forbidden: superadmin role required'
      USING ERRCODE = 'insufficient_privilege';
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

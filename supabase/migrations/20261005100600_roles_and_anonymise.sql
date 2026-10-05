-- Migration M7a: role management and anonymisation (admin panel spec S-1, S-2, S-3, §4.5; BR-9..
-- BR-12, BR-16), and the role guard on DELETE.
--
-- Functions, each one transaction that changes data and writes exactly one audit entry through
-- audit_write() (M3):
--   admin_set_role(p_member_id, p_role, p_reason)                       S-1/S-2  role.grant |
--                                                                                 role.revoke
--   admin_anonymise_member(p_member_id, p_confirm_number, p_reason)     S-3      member.anonymise
-- Server actions (T11b) call them with the user's SESSION client, never the service role: BR-11
-- keys on auth.uid(), which is empty without a JWT subject. Both are superadmin only.
--
-- admin_set_role:
--   p_role is 'member', 'board' or 'superadmin'; the legacy 'admin' is never assigned (M7 maps it
--   to board). The change is compared by RANK (role_rank()): up = role.grant, down = role.revoke,
--   same rank = admin:role_unchanged with no UPDATE and no entry (granting what the member holds
--   already, or admin → board, which the M7 contract migration does for everyone). Not a no-op
--   on purpose, like the badges of M6: a stale screen learns its state was out of date.
--   BR-10, BR-11 and BR-12 are NOT checked here: the UPDATE fires members_role_guard (M2), which
--   raises role_guard:last_superadmin / role_guard:self_role_change / role_guard:former_member_role
--   (23514), and the whole call rolls back with no entry. The app maps those prefixes.
--   Target: confirmed, not purged (admin_lock_member(), M6). The reason is optional (the S-1/S-2
--   dialogs ask for none), at most 500 characters, and goes to the audit reason column.
--   Details {"from": old role, "to": new role}. Returns (action, role, role_since).
--
-- admin_anonymise_member (S-3, spec §4.5 "Erasure requests" and the S-3 dialog):
--   Only a former member (an active member's erasure starts with the baixa, P-4 step 2), not
--   purged, confirmed by typing the member number (compared after trimming). Deletes now: the
--   badges (member_badges rows), and any contact/profile data a legacy row may still hold (phone,
--   postal code, usernames, newsletter consent; a leave already cleared them, BR-20). Rotates the
--   card token, so the token printed on an old card no longer links to the row. Keeps blocked
--   until the purge (left_on + 3 years): names, DNI ciphertext, member number, dates, baixa per
--   and motiu (the motiu is deleted by the purge, §4.5; the members_board_leave_has_reason CHECK
--   needs it until then). Sets anonymised_at. The LOGIN ACCOUNT and with it the e-mail are
--   deleted by the server action right after this call (auth.admin.deleteUser, T11b); the
--   on_auth_user_deleted trigger (M1) keeps the row because left_on is set.
--   Retry path: a second call on an anonymised record raises admin:already_anonymised and writes
--   nothing; the action treats it as success and retries the account deletion (a 404 from
--   deleteUser also means done).
--   Details {"badges_deleted": n, "purge_on": "YYYY-MM-DD"} (no personal data). Returns
--   (member_number, purge_on) for the reply to the person (P-4 step 4).
--
-- Role guard on DELETE (T2 follow-up; BR-10, BR-12, BR-16). members_role_delete_guard() fires
-- BEFORE DELETE on members. It also fires for the DELETE that on_auth_user_deleted runs when a
-- login account is deleted, so an exception rolls back the auth.users DELETE too (GoTrue's
-- auth.admin.deleteUser answers 500 "Database error deleting user"; the prefix only reaches a
-- direct DELETE). Former members and plain members pass (account deletion, prepareSignup, the
-- unconfirmed-account purge and the retention purge are unaffected). An ACTIVE row holding any
-- role (board, superadmin, legacy admin) is refused:
--   role_guard:last_superadmin  an active superadmin with fewer than two OTHER active
--                               superadmins (same rule, lock and message as a demotion)
--   role_guard:role_held        any other active role holder: the role is removed first (BR-12)
-- There is no bypass for the service role or the owner: to delete a role holder, remove the
-- role first (and for a superadmin, promote a replacement first).
--
-- Errors (stable prefixes; the app maps them):
--   admin:forbidden           42501  caller is not an active superadmin
--   admin:not_found           22023  unknown member, purged stub, sign-up never confirmed
--   admin:invalid_argument    22023  p_role outside member/board/superadmin
--   admin:role_unchanged      22023  the new role has the rank the member already holds
--   admin:reason_too_long     22023  reason over 500 characters
--   admin:not_former          22023  anonymising an active member
--   admin:confirm_mismatch    22023  the typed member number does not match
--   admin:already_anonymised  22023  anonymising an anonymised record (retry path)
--   admin:isolation           25000  called inside a REPEATABLE READ/SERIALIZABLE transaction:
--                                    BR-10 counts superadmins after waiting for a lock and needs
--                                    READ COMMITTED snapshots (PostgREST's default)
--   role_guard:*              23514  from members_role_guard / members_role_delete_guard
-- anon and service_role have no EXECUTE on either function (Postgres "permission denied", 42501).
--
-- Needs M1–M6. Safe to apply to production before the code that uses it: nothing in src/ calls
-- the new functions. The DELETE guard changes one shipped behaviour: deleteAccount
-- (src/lib/profile/actions.ts) of a member who holds board/superadmin/admin now fails with its
-- generic "failed" error instead of deleting the account (BR-12; T26 replaces it with
-- member_leave_self, which already refuses role holders).

-- 1. Role guard on DELETE -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.members_role_delete_guard()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  other_superadmins integer;
BEGIN
  IF OLD.left_on IS NOT NULL OR OLD.role = 'member' THEN
    RETURN OLD;
  END IF;

  -- BR-10, as in members_role_guard(): same lock, so a deletion and a demotion cannot both see
  -- the same count.
  IF OLD.role = 'superadmin' THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.members_role_guard'));

    SELECT count(*) INTO other_superadmins
    FROM public.members AS m
    WHERE m.role = 'superadmin'
      AND m.left_on IS NULL
      AND m.id <> OLD.id;

    IF other_superadmins < 2 THEN
      RAISE EXCEPTION 'role_guard:last_superadmin: there must always be at least two superadmins'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  -- BR-12: a role is removed (by a superadmin) before the membership ends in any way
  RAISE EXCEPTION 'role_guard:role_held: a member who holds a role must lose it before the account is deleted'
    USING ERRCODE = 'check_violation';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.members_role_delete_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER members_role_delete_guard
  BEFORE DELETE ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.members_role_delete_guard();

-- 2. Internal helpers ---------------------------------------------------------------------------
--    No API role can execute them; the functions below call them with owner privileges.
CREATE OR REPLACE FUNCTION public.admin_assert_superadmin()
  RETURNS void
  LANGUAGE plpgsql
  STABLE
  SET search_path TO ''
AS $$
BEGIN
  IF NOT public.has_role('superadmin') THEN
    RAISE EXCEPTION 'admin:forbidden: superadmin role required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_assert_superadmin() FROM PUBLIC, anon, authenticated, service_role;

-- 3. admin_set_role (S-1, S-2) ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_role(
  p_member_id uuid,
  p_role text,
  p_reason text DEFAULT NULL
)
  RETURNS TABLE (action text, role text, role_since timestamptz)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  v_reason text := NULLIF(pg_catalog.btrim(p_reason), '');
  v_row public.members;
  v_action text;
  v_role_since timestamptz;
BEGIN
  PERFORM public.admin_assert_superadmin();

  IF pg_catalog.current_setting('transaction_isolation') <> 'read committed' THEN
    RAISE EXCEPTION 'admin:isolation: role changes need READ COMMITTED'
      USING ERRCODE = 'invalid_transaction_state';
  END IF;

  IF p_role IS NULL OR p_role NOT IN ('member', 'board', 'superadmin') THEN
    RAISE EXCEPTION 'admin:invalid_argument: the role is member, board or superadmin'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM public.admin_assert_reason_length(v_reason);

  v_row := public.admin_lock_member(p_member_id);

  IF public.role_rank(p_role) = public.role_rank(v_row.role) THEN
    RAISE EXCEPTION 'admin:role_unchanged: the member already holds this role'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_action := CASE
    WHEN public.role_rank(p_role) > public.role_rank(v_row.role) THEN 'role.grant'
    ELSE 'role.revoke'
  END;

  -- members_role_guard enforces BR-10, BR-11 and BR-12 here and stamps role_since
  UPDATE public.members AS m
  SET role = p_role
  WHERE m.id = p_member_id
  RETURNING m.role_since INTO v_role_since;

  PERFORM public.audit_write(
    v_action,
    p_member_id,
    pg_catalog.jsonb_build_object('from', v_row.role, 'to', p_role),
    v_reason
  );

  RETURN QUERY SELECT v_action, p_role, v_role_since;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_role(uuid, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_role(uuid, text, text) TO authenticated;

-- 4. admin_anonymise_member (S-3) ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_anonymise_member(
  p_member_id uuid,
  p_confirm_number text,
  p_reason text DEFAULT NULL
)
  RETURNS TABLE (member_number text, purge_on date)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  v_reason text := NULLIF(pg_catalog.btrim(p_reason), '');
  v_row public.members;
  v_badges integer;
  v_purge_on date;
BEGIN
  PERFORM public.admin_assert_superadmin();

  PERFORM public.admin_assert_reason_length(v_reason);

  v_row := public.admin_lock_member(p_member_id);

  IF v_row.left_on IS NULL THEN
    RAISE EXCEPTION 'admin:not_former: only a former member can be anonymised; give the baixa first'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF pg_catalog.btrim(p_confirm_number) IS DISTINCT FROM v_row.member_number THEN
    RAISE EXCEPTION 'admin:confirm_mismatch: type the member number to confirm'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_row.anonymised_at IS NOT NULL THEN
    RAISE EXCEPTION 'admin:already_anonymised: this record was anonymised already'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- same rule as admin_get_member().purge_on (M4)
  v_purge_on := (v_row.left_on + interval '3 years')::date;

  DELETE FROM public.member_badges AS b
  WHERE b.member_id = p_member_id;
  GET DIAGNOSTICS v_badges = ROW_COUNT;

  UPDATE public.members AS m
  SET anonymised_at = pg_catalog.now(),
      card_token = public.generate_card_token(),
      phone_encrypted = NULL,
      postal_code = NULL,
      ludoya_username = NULL,
      bgg_username = NULL,
      newsletter_accepted = false
  WHERE m.id = p_member_id;

  PERFORM public.audit_write(
    'member.anonymise',
    p_member_id,
    pg_catalog.jsonb_build_object(
      'badges_deleted', v_badges,
      'purge_on', pg_catalog.to_char(v_purge_on, 'YYYY-MM-DD')
    ),
    v_reason
  );

  RETURN QUERY SELECT v_row.member_number, v_purge_on;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_anonymise_member(uuid, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_anonymise_member(uuid, text, text) TO authenticated;

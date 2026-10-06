-- Retention job (admin panel spec §4.5, §5.3, BR-3, BR-7, BR-14, BR-20, BR-22; T12).
--
-- One daily job, run by .github/workflows/retention.yml through GET /api/cron/retention
-- (decision D-F), does three things in ONE transaction:
--
--   1. Purge former members whose purge date has passed (purge date = left_on + 3 years,
--      decision D-H, provisional; member_purge_on() is the single place for that rule).
--      Cleared: names (to '', the columns are NOT NULL), DNI ciphertext, phone ciphertext,
--      postal code, gaming usernames, newsletter, the leave reason (motiu) and the badges; the
--      login account (and with it the e-mail) is deleted from auth.users. Kept, as the anonymous
--      stub of §4.5 (BR-2: the number is never reused, statistics stay right): member number,
--      primera alta (membership_start_date), alta actual (current_joined_on), data de baixa
--      (left_on), plus left_by because members_left_on_left_by_pair ties it to left_on (it says
--      only 'self' or 'board'), created_at, anonymised_at and the card token (already invalid:
--      a former member's card never verifies). purged_at is set. One `member.purge` entry each,
--      actor NULL (system), details {left_on, purge_on, badges_deleted, account_deleted}.
--   2. Delete sign-ups never confirmed that are older than 30 days (BR-22): the auth.users row
--      is deleted here, in the database, and handle_deleted_user() deletes its (active) member
--      row. The deletion and its audit entry are atomic: one aggregate
--      `account.purge_unconfirmed` entry per run with {accounts_deleted: n} (spec §5.1: "number
--      of accounts deleted (no e-mails)"), only when n > 0. Rows holding a role or a leave are
--      never touched (neither can happen for an unconfirmed account; skipping them keeps the
--      role delete guard from aborting the whole run).
--   3. Delete audit entries older than 3 years (§5.3, BR-14). audit_log_append_only() lets the
--      owner delete exactly those rows; this function runs as the owner (SECURITY DEFINER).
--
-- Why the database deletes the auth users itself instead of the route calling
-- auth.admin.deleteUser: the deletion and its audit entry then commit or roll back together,
-- and a dry run can report exactly what an apply would delete. It needs the function owner
-- (postgres) to hold DELETE on auth.users; locally it does (T6 checked INSERT/UPDATE/DELETE on
-- auth.users, auth.sessions, auth.refresh_tokens). The prod runbook checks it before the first
-- apply. auth.identities, sessions, refresh tokens and MFA factors cascade from auth.users.
--
-- Dry run (the default): the same selection, counted; nothing is written and no audit entry is
-- made. The route defaults to a dry run as well, and the scheduled workflow stays dry until the
-- RETENTION_APPLY repository variable is set (prod runbook).
--
-- Grants: run_retention(boolean) is EXECUTE for service_role only (and the owner). The
-- internal retention_run(boolean, uuid[]) and member_purge_on(date) have no API grant;
-- retention_run's p_only limits every step to the given member/user ids (NULL = everything) so
-- the integration tests can run it as postgres on their own fixtures while other test files
-- run in parallel. run_retention always passes NULL.
--
-- Concurrent runs are serialised by a transaction advisory lock.
--
-- Needs M1 (membership columns, handle_deleted_user), M3 (audit_log, audit_write) and T6
-- (membership_today). Safe to apply before the code ships: nothing calls it until the route
-- and the workflow are deployed.

-- 1. Purge date (D-H) ------------------------------------------------------------------------------
--    Same expression as admin_get_member().purge_on (M4) and admin_anonymise_member() (T8).
CREATE OR REPLACE FUNCTION public.member_purge_on(p_left_on date)
  RETURNS date
  LANGUAGE sql
  IMMUTABLE
  STRICT
  SET search_path TO ''
AS $$
  SELECT (p_left_on + interval '3 years')::date;
$$;

REVOKE EXECUTE ON FUNCTION public.member_purge_on(date) FROM PUBLIC, anon, authenticated, service_role;

-- 2. retention_run(): the job ----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.retention_run(p_dry_run boolean, p_only uuid[])
  RETURNS TABLE (
    dry_run boolean,
    members_purged integer,
    unconfirmed_deleted integer,
    audit_entries_deleted integer
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  v_dry boolean := COALESCE(p_dry_run, true);
  v_today date := public.membership_today();
  v_member record;
  v_badges integer;
  v_accounts integer;
  v_purged integer := 0;
  v_unconfirmed uuid[];
  v_unconfirmed_deleted integer := 0;
  v_audit_deleted integer := 0;
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.retention_run'));

  -- 1. Purge former members past their purge date -------------------------------------------------
  FOR v_member IN
    SELECT m.id, m.left_on
    FROM public.members AS m
    WHERE m.left_on IS NOT NULL
      AND m.purged_at IS NULL
      AND public.member_purge_on(m.left_on) <= v_today
      AND (p_only IS NULL OR m.id = ANY (p_only))
    ORDER BY m.left_on, m.id
    FOR UPDATE
  LOOP
    v_purged := v_purged + 1;
    CONTINUE WHEN v_dry;

    DELETE FROM public.member_badges AS b
    WHERE b.member_id = v_member.id;
    GET DIAGNOSTICS v_badges = ROW_COUNT;

    UPDATE public.members AS m
    SET first_name = '',
        last_name = '',
        dni_nie_encrypted = NULL,
        phone_encrypted = NULL,
        postal_code = NULL,
        ludoya_username = NULL,
        bgg_username = NULL,
        newsletter_accepted = false,
        leave_reason = NULL,
        purged_at = pg_catalog.now()
    WHERE m.id = v_member.id;

    -- handle_deleted_user() only deletes ACTIVE member rows, so the stub stays.
    DELETE FROM auth.users AS u
    WHERE u.id = v_member.id;
    GET DIAGNOSTICS v_accounts = ROW_COUNT;

    PERFORM public.audit_write(
      'member.purge',
      v_member.id,
      pg_catalog.jsonb_build_object(
        'left_on', pg_catalog.to_char(v_member.left_on, 'YYYY-MM-DD'),
        'purge_on', pg_catalog.to_char(public.member_purge_on(v_member.left_on), 'YYYY-MM-DD'),
        'badges_deleted', v_badges,
        'account_deleted', v_accounts > 0
      ),
      NULL
    );
  END LOOP;

  -- 2. Sign-ups never confirmed, older than 30 days (BR-22) ---------------------------------------
  SELECT COALESCE(pg_catalog.array_agg(u.id ORDER BY u.id), ARRAY[]::uuid[])
  INTO v_unconfirmed
  FROM auth.users AS u
  LEFT JOIN public.members AS m ON m.id = u.id
  WHERE u.email_confirmed_at IS NULL
    AND u.created_at < pg_catalog.now() - interval '30 days'
    AND (m.id IS NULL OR (m.left_on IS NULL AND m.role = 'member'))
    AND (p_only IS NULL OR u.id = ANY (p_only));

  IF v_dry THEN
    v_unconfirmed_deleted := pg_catalog.cardinality(v_unconfirmed);
  ELSIF pg_catalog.cardinality(v_unconfirmed) > 0 THEN
    DELETE FROM auth.users AS u
    WHERE u.id = ANY (v_unconfirmed);
    GET DIAGNOSTICS v_unconfirmed_deleted = ROW_COUNT;

    IF v_unconfirmed_deleted > 0 THEN
      PERFORM public.audit_write(
        'account.purge_unconfirmed',
        NULL,
        pg_catalog.jsonb_build_object('accounts_deleted', v_unconfirmed_deleted),
        NULL
      );
    END IF;
  END IF;

  -- 3. Audit entries older than 3 years (BR-14) ----------------------------------------------------
  --    Same boundary as audit_log_append_only(), which refuses anything younger.
  IF v_dry THEN
    SELECT pg_catalog.count(*)::integer INTO v_audit_deleted
    FROM public.audit_log AS a
    WHERE a.created_at < pg_catalog.now() - interval '3 years'
      AND (p_only IS NULL OR a.target_member_id = ANY (p_only));
  ELSE
    DELETE FROM public.audit_log AS a
    WHERE a.created_at < pg_catalog.now() - interval '3 years'
      AND (p_only IS NULL OR a.target_member_id = ANY (p_only));
    GET DIAGNOSTICS v_audit_deleted = ROW_COUNT;
  END IF;

  RETURN QUERY SELECT v_dry, v_purged, v_unconfirmed_deleted, v_audit_deleted;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.retention_run(boolean, uuid[]) FROM PUBLIC, anon, authenticated, service_role;

-- 3. run_retention(): the API entry point (service role only) ------------------------------------
CREATE OR REPLACE FUNCTION public.run_retention(p_dry_run boolean DEFAULT true)
  RETURNS TABLE (
    dry_run boolean,
    members_purged integer,
    unconfirmed_deleted integer,
    audit_entries_deleted integer
  )
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
  SELECT * FROM public.retention_run(COALESCE(p_dry_run, true), NULL);
$$;

REVOKE EXECUTE ON FUNCTION public.run_retention(boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_retention(boolean) TO service_role;

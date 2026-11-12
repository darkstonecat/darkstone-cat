-- audit_log: no direct reads through the API.
--
-- M3 (20261005100200_audit_log.sql) granted SELECT to `authenticated` with the policy
-- audit_log_board_select, so any board session could GET /rest/v1/audit_log and read `details`
-- as stored, including the past names that member.update keeps in `details.changes` for a member
-- who was later anonymised or purged (spec 5.3). Those entries stay up to 3 years (BR-14).
--
-- The panel never needed the table: every screen reads through admin_list_activity (SECURITY
-- DEFINER), which drops `changes` for such members, and the counters through admin_stats /
-- admin_list_badges / admin_delete_badge (also SECURITY DEFINER, owner privileges). The only
-- direct reader, the access-link cooldown (A-15), now reads with the service role.
--
-- After this migration only the table owner (SECURITY DEFINER functions) and service_role read
-- it. Writes are unchanged: audit_write() / log_admin_event() only, append-only trigger.

DROP POLICY IF EXISTS audit_log_board_select ON public.audit_log;

REVOKE SELECT ON public.audit_log FROM authenticated;

-- RLS stays enabled: with no policy, a future accidental GRANT to authenticated still reads
-- nothing. service_role bypasses RLS.

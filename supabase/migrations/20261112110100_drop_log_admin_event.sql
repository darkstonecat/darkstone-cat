-- Remove log_admin_event(): no session can write audit entries directly any more.
--
-- Apply AFTER the code that calls log_admin_event_for() (20261112110000_audit_server_events.sql)
-- is deployed: until then the access link (A-15) still logs through log_admin_event() and fails
-- closed without it (no entry, no mail).

DROP FUNCTION IF EXISTS public.log_admin_event(text, uuid, jsonb, text);

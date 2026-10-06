-- ---------------------------------------------------------------------------------------------
-- Manual cache refresh runs are recorded only by the server (T25, fix of T13)
-- ---------------------------------------------------------------------------------------------
-- 20261006100200 let any board member call admin_record_job_run directly (actor = auth.uid()),
-- so they could write fake ok/error rows. The panel's server action now records through the
-- service role and passes the actor it verified, so:
--   - admin_record_job_run is dropped (no API user can write the history any more);
--   - ops_record_manual_job_run(job, ok, duration_ms, error_code, actor) is service_role only,
--     and refuses an actor that is not an ACTIVE board+ member.
-- ops_record_job_run (automatic runs), ops_job_run_insert and admin_ops_status are unchanged.

DROP FUNCTION IF EXISTS public.admin_record_job_run(text, boolean, integer, text);

CREATE OR REPLACE FUNCTION public.ops_record_manual_job_run(
  p_job text,
  p_ok boolean,
  p_duration_ms integer,
  p_error_code text,
  p_actor uuid
)
  RETURNS bigint
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
BEGIN
  IF p_actor IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.members AS m
    WHERE m.id = p_actor
      AND m.left_on IS NULL
      AND public.role_rank(m.role) >= public.role_rank('board')
  ) THEN
    RAISE EXCEPTION 'ops:forbidden: the actor must be an active board member'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN public.ops_job_run_insert(p_job, p_ok, p_duration_ms, p_error_code, p_actor);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ops_record_manual_job_run(text, boolean, integer, text, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_record_manual_job_run(text, boolean, integer, text, uuid)
  TO service_role;

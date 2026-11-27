-- Member backup run history (docs/features/member-backup/spec.md §6, odd/tasks/member-backup.md T2).
--
-- Adds the job 'member_backup' to public.ops_job_runs, as 20261006100200_ops_job_runs.sql asks:
-- the CHECK, the job list of ops_job_run_insert() and the job list of admin_ops_status(), so V-6
-- shows the last weekly backup next to the cache jobs.
--
-- A backup run is always automatic (GET /api/cron/backup, actor NULL): ops_job_run_insert()
-- refuses an actor for it, so no manual-run path can record a backup success.

ALTER TABLE public.ops_job_runs DROP CONSTRAINT ops_job_runs_job_check;
ALTER TABLE public.ops_job_runs
  ADD CONSTRAINT ops_job_runs_job_check CHECK (job IN ('ludoya', 'bgg', 'member_backup'));

CREATE OR REPLACE FUNCTION public.ops_job_run_insert(
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
DECLARE
  new_id bigint;
  newest_success bigint;
BEGIN
  IF p_job IS NULL OR p_job NOT IN ('ludoya', 'bgg', 'member_backup') THEN
    RAISE EXCEPTION 'ops:invalid_argument: unknown job'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_job = 'member_backup' AND p_actor IS NOT NULL THEN
    RAISE EXCEPTION 'ops:invalid_argument: the member backup only runs automatically'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_ok IS NULL THEN
    RAISE EXCEPTION 'ops:invalid_argument: ok is required'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_duration_ms IS NOT NULL AND p_duration_ms < 0 THEN
    RAISE EXCEPTION 'ops:invalid_argument: duration must not be negative'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_error_code IS NOT NULL AND (p_ok OR p_error_code !~ '^[a-z0-9_]{1,40}$') THEN
    RAISE EXCEPTION 'ops:invalid_argument: error code must be a short code on a failed run'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO public.ops_job_runs (job, ok, actor_id, duration_ms, error_code)
  VALUES (p_job, p_ok, p_actor, p_duration_ms, p_error_code)
  RETURNING id INTO new_id;

  SELECT r.id INTO newest_success
  FROM public.ops_job_runs AS r
  WHERE r.job = p_job AND r.ok
  ORDER BY r.ran_at DESC, r.id DESC
  LIMIT 1;

  DELETE FROM public.ops_job_runs AS r
  WHERE r.job = p_job
    AND r.ran_at < now() - interval '90 days'
    AND r.id IS DISTINCT FROM newest_success;

  RETURN new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ops_job_run_insert(text, boolean, integer, text, uuid)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_ops_status()
  RETURNS TABLE (
    job text,
    last_run_at timestamptz,
    last_ok boolean,
    last_automatic boolean,
    last_actor_member_number text,
    last_actor_name text,
    last_duration_ms integer,
    last_error_code text,
    last_success_at timestamptz
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('board') THEN
    RAISE EXCEPTION 'ops:forbidden: board role required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    j.job,
    lr.ran_at,
    lr.ok,
    CASE WHEN lr.id IS NULL THEN NULL ELSE lr.actor_id IS NULL END,
    m.member_number,
    NULLIF(btrim(COALESCE(m.first_name, '') || ' ' || COALESCE(m.last_name, '')), ''),
    lr.duration_ms,
    lr.error_code,
    ls.ran_at
  FROM (VALUES (1, 'ludoya'::text), (2, 'bgg'::text), (3, 'member_backup'::text)) AS j(pos, job)
  LEFT JOIN LATERAL (
    SELECT r.id, r.ran_at, r.ok, r.actor_id, r.duration_ms, r.error_code
    FROM public.ops_job_runs AS r
    WHERE r.job = j.job
    ORDER BY r.ran_at DESC, r.id DESC
    LIMIT 1
  ) AS lr ON true
  LEFT JOIN LATERAL (
    SELECT r.ran_at
    FROM public.ops_job_runs AS r
    WHERE r.job = j.job AND r.ok
    ORDER BY r.ran_at DESC, r.id DESC
    LIMIT 1
  ) AS ls ON true
  LEFT JOIN public.members AS m
    ON m.id = lr.actor_id AND m.purged_at IS NULL
  ORDER BY j.pos;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_ops_status() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_ops_status() TO authenticated;

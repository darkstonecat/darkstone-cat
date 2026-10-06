-- Cache refresh runs (admin panel spec V-6, A-14; T13).
--
-- V-6 "Memòria cau" shows, per refresh job, the last result, when it ran, who ran it
-- ("automàtica" for the scheduled run, the board member otherwise) and how long it took. The
-- `ops.cache_refresh` audit entry records manual runs only (it needs a board session), so the
-- scheduled runs of /api/cron/refresh need their own storage: public.ops_job_runs.
--
-- Jobs: the two jobs of src/lib/cache-refresh.ts, 'ludoya' and 'bgg'. The retention job is NOT
-- recorded here: V-6 has no row for it, and its effect is already in the audit log
-- (member.purge, account.purge_unconfirmed). Adding a job means widening the CHECK below and the
-- job list of admin_ops_status().
--
-- Writes only through functions:
--   ops_record_job_run(job, ok, duration_ms, error_code)    service_role; actor NULL (automatic)
--   admin_record_job_run(job, ok, duration_ms, error_code)  board+; actor = auth.uid() (manual)
-- Read: admin_ops_status() (board+), one row per known job with the last run and the last
-- successful run. The table itself: no grant to anon/authenticated; service_role SELECT only
-- (tests, support queries).
--
-- error_code is a short code (`^[a-z0-9_]{1,40}$`, e.g. timeout, rate_limited, http_503), never
-- an error message: messages can carry URLs or upstream text. It is NULL for a successful run.
--
-- Pruning, on insert: runs of the same job older than 90 days are deleted, except the newest
-- successful run (so "last success" survives a long outage). A job runs about twice a day plus
-- the manual runs, so a job keeps a few hundred rows at most.
--
-- Errors: ops:forbidden 42501 (not board), ops:invalid_argument 22023.
--
-- Needs M2 (has_role). Safe to apply before the code ships: nothing writes or reads it until the
-- T13 code is deployed; until then the cron route's recording call fails and is only logged.

-- 1. Table -----------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ops_job_runs (
  id bigserial PRIMARY KEY,
  job text NOT NULL CONSTRAINT ops_job_runs_job_check CHECK (job IN ('ludoya', 'bgg')),
  ran_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL,
  -- NULL = the scheduled (automatic) run. No foreign key: a run outlives its actor's account.
  actor_id uuid NULL,
  duration_ms integer NULL CONSTRAINT ops_job_runs_duration_check CHECK (duration_ms IS NULL OR duration_ms >= 0),
  error_code text NULL CONSTRAINT ops_job_runs_error_code_check
    CHECK (error_code IS NULL OR error_code ~ '^[a-z0-9_]{1,40}$'),
  CONSTRAINT ops_job_runs_ok_code_check CHECK (NOT (ok AND error_code IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS ops_job_runs_job_ran_at_idx ON public.ops_job_runs (job, ran_at DESC, id DESC);

REVOKE ALL ON TABLE public.ops_job_runs FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON SEQUENCE public.ops_job_runs_id_seq FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.ops_job_runs TO service_role;

ALTER TABLE public.ops_job_runs ENABLE ROW LEVEL SECURITY;
-- No policies: the API roles never read or write rows directly (service_role bypasses RLS).

-- 2. Internal writer -------------------------------------------------------------------------------
--    Validates, inserts and prunes. No API role can execute it.
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
  IF p_job IS NULL OR p_job NOT IN ('ludoya', 'bgg') THEN
    RAISE EXCEPTION 'ops:invalid_argument: unknown job'
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

-- 3. Automatic runs (/api/cron/refresh, service role) ---------------------------------------------
CREATE OR REPLACE FUNCTION public.ops_record_job_run(
  p_job text,
  p_ok boolean,
  p_duration_ms integer DEFAULT NULL,
  p_error_code text DEFAULT NULL
)
  RETURNS bigint
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
BEGIN
  RETURN public.ops_job_run_insert(p_job, p_ok, p_duration_ms, p_error_code, NULL);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.ops_record_job_run(text, boolean, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ops_record_job_run(text, boolean, integer, text) TO service_role;

-- 4. Manual runs (A-14, board session) ------------------------------------------------------------
--    The actor is always the caller; it cannot be passed in.
CREATE OR REPLACE FUNCTION public.admin_record_job_run(
  p_job text,
  p_ok boolean,
  p_duration_ms integer DEFAULT NULL,
  p_error_code text DEFAULT NULL
)
  RETURNS bigint
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('board') THEN
    RAISE EXCEPTION 'ops:forbidden: board role required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN public.ops_job_run_insert(p_job, p_ok, p_duration_ms, p_error_code, auth.uid());
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_record_job_run(text, boolean, integer, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_record_job_run(text, boolean, integer, text) TO authenticated;

-- 5. Status for V-6 (board+) ----------------------------------------------------------------------
--    One row per known job, in display order, even if it never ran (then every column but `job`
--    is NULL). last_automatic: the last run had no actor. last_actor_member_number /
--    last_actor_name: the manual actor's member row (NULL when automatic, or when the actor's
--    row is gone or purged). last_success_at: the newest successful run.
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
  FROM (VALUES (1, 'ludoya'::text), (2, 'bgg'::text)) AS j(pos, job)
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

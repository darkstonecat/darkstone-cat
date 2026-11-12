-- Audit entries of app-side events written only by the server.
--
-- log_admin_event() (20261005100900_admin_exports_more.sql) is executable by `authenticated`, so
-- any board session could POST /rest/v1/rpc/log_admin_event and write a member.send_access_link
-- entry for a link that was never sent, or an ops.cache_refresh entry with made-up details and a
-- free reason, as often as it liked (the log is append-only: such rows stay 3 years). The actor
-- was always the caller, so nobody could be impersonated.
--
-- This migration is additive and safe to apply before the code that uses it is deployed:
--   1. audit_write_as(actor, …): the body of audit_write() with an explicit actor. Internal, like
--      audit_write(), which now delegates to it with auth.uid() (same behaviour for every caller).
--   2. log_admin_event_for(actor, action, target, details): service_role only. The server actions
--      call it after their own role check, passing the verified actor (same pattern as
--      ops_record_manual_job_run, 20261006100300). It re-checks that the actor is an active board
--      member and accepts only the exact shape each event has:
--        member.send_access_link  an active, not purged target; details {}.
--        ops.cache_refresh        no target; details exactly {"jobs": [...], "ok": bool}, jobs a
--                                 non-empty list of distinct names among 'ludoya', 'bgg'.
--      No reason: neither event takes one.
-- 20261112110100_drop_log_admin_event.sql then removes log_admin_event(), once the code that
-- calls log_admin_event_for() is live.

-- 1. audit_write_as ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_write_as(
  p_actor uuid,
  p_action text,
  p_target uuid,
  p_details jsonb,
  p_reason text
)
  RETURNS bigint
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  actor_role_now text;
  actor_number text;
  target_number text;
  entry_details jsonb := COALESCE(p_details, '{}'::jsonb);
  new_id bigint;
BEGIN
  IF pg_catalog.jsonb_typeof(entry_details) <> 'object' THEN
    RAISE EXCEPTION 'audit:invalid_details: details must be a JSON object'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF public.audit_details_leak(entry_details) THEN
    RAISE EXCEPTION 'audit:sensitive_details: details may name DNI/phone fields but never hold their values'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_actor IS NOT NULL THEN
    SELECT m.role, m.member_number INTO actor_role_now, actor_number
    FROM public.members AS m
    WHERE m.id = p_actor;
  END IF;

  IF p_target IS NOT NULL THEN
    SELECT m.member_number INTO target_number
    FROM public.members AS m
    WHERE m.id = p_target;
  END IF;

  INSERT INTO public.audit_log (
    actor_id, actor_role, actor_member_number, action,
    target_member_id, target_member_number, details, reason
  )
  VALUES (
    p_actor, actor_role_now, actor_number, p_action,
    p_target, target_number, entry_details, NULLIF(pg_catalog.btrim(p_reason), '')
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_write_as(uuid, text, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.audit_write(
  p_action text,
  p_target uuid,
  p_details jsonb,
  p_reason text
)
  RETURNS bigint
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
BEGIN
  RETURN public.audit_write_as(auth.uid(), p_action, p_target, p_details, p_reason);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_write(text, uuid, jsonb, text)
  FROM PUBLIC, anon, authenticated, service_role;

-- 2. log_admin_event_for -------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_admin_event_for(
  p_actor uuid,
  p_action text,
  p_target uuid,
  p_details jsonb
)
  RETURNS bigint
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  entry_details jsonb := COALESCE(p_details, '{}'::jsonb);
  jobs jsonb;
  shape_ok boolean;
  target_left_on date;
BEGIN
  IF p_actor IS NULL OR NOT EXISTS (
    SELECT 1
    FROM public.members AS m
    WHERE m.id = p_actor
      AND m.left_on IS NULL
      AND m.purged_at IS NULL
      AND public.role_rank(m.role) >= public.role_rank('board')
  ) THEN
    RAISE EXCEPTION 'audit:forbidden: the actor must be an active board member'
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

    IF entry_details <> '{}'::jsonb THEN
      RAISE EXCEPTION 'audit:invalid_details: % takes no details', p_action
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
  ELSE
    IF p_target IS NOT NULL THEN
      RAISE EXCEPTION 'audit:invalid_target: % takes no target member', p_action
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    jobs := entry_details -> 'jobs';
    -- CASE, not OR: the array checks must never run on a value that is not an array. Assigned
    -- first because PL/pgSQL ends an IF condition at its first THEN.
    shape_ok := CASE
      WHEN (SELECT pg_catalog.array_agg(k ORDER BY k) FROM pg_catalog.jsonb_object_keys(entry_details) AS k)
             IS DISTINCT FROM ARRAY['jobs', 'ok']
        OR pg_catalog.jsonb_typeof(entry_details -> 'ok') IS DISTINCT FROM 'boolean'
        OR pg_catalog.jsonb_typeof(jobs) IS DISTINCT FROM 'array'
        THEN false
      ELSE pg_catalog.jsonb_array_length(jobs) > 0
        AND NOT EXISTS (
          SELECT 1 FROM pg_catalog.jsonb_array_elements(jobs) AS j
          WHERE j NOT IN ('"ludoya"'::jsonb, '"bgg"'::jsonb)
        )
        AND (SELECT count(DISTINCT j) FROM pg_catalog.jsonb_array_elements(jobs) AS j)
            = pg_catalog.jsonb_array_length(jobs)
    END;

    IF NOT shape_ok THEN
      RAISE EXCEPTION 'audit:invalid_details: % needs {"jobs": [ludoya|bgg, ...], "ok": boolean}', p_action
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;

  RETURN public.audit_write_as(p_actor, p_action, p_target, entry_details, NULL);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_admin_event_for(uuid, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_admin_event_for(uuid, text, uuid, jsonb) TO service_role;

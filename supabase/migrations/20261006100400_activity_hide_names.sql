-- admin_list_activity: do not return the past names of an anonymised or purged member
-- (T23 verification, spec 5.3). Same signature, grants and behaviour; only `details` changes:
-- the `changes` key (member.update before/after names) is removed when the row's target is
-- anonymised, purged or gone.

CREATE OR REPLACE FUNCTION public.admin_list_activity(
  p_action text DEFAULT NULL,
  p_actor uuid DEFAULT NULL,
  p_target uuid DEFAULT NULL,
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 25,
  p_before_id bigint DEFAULT NULL,
  p_actor_kind text DEFAULT NULL,
  p_target_number text DEFAULT NULL
)
  RETURNS TABLE (
    id bigint,
    created_at timestamptz,
    actor_id uuid,
    actor_role text,
    actor_member_number text,
    actor_name text,
    action text,
    target_member_id uuid,
    target_member_number text,
    target_name text,
    details jsonb,
    reason text,
    total_count integer
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
AS $$
#variable_conflict use_column
DECLARE
  v_limit integer := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 200);
  v_group text;
  v_cursor_at timestamptz;
  v_cursor_id bigint;
BEGIN
  PERFORM public.admin_assert_board();

  IF p_actor_kind IS NOT NULL AND p_actor_kind NOT IN ('system', 'self') THEN
    RAISE EXCEPTION 'admin:invalid_argument: unknown actor kind %', p_actor_kind
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_action LIKE '%.*' THEN
    v_group := pg_catalog.left(p_action, -1);                     -- 'badge.*' -> 'badge.'
  END IF;

  IF p_before_id IS NOT NULL THEN
    SELECT a.created_at, a.id INTO v_cursor_at, v_cursor_id
    FROM public.audit_log AS a
    WHERE a.id = p_before_id;

    IF NOT FOUND THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  WITH filtered AS (
    SELECT a.*
    FROM public.audit_log AS a
    WHERE (p_action IS NULL
           OR (v_group IS NULL AND a.action = p_action)
           OR (v_group IS NOT NULL
               AND pg_catalog.left(a.action, pg_catalog.length(v_group)) = v_group))
      AND (p_actor IS NULL OR a.actor_id = p_actor)
      AND (p_actor_kind IS NULL
           OR (p_actor_kind = 'system' AND a.actor_id IS NULL)
           OR (p_actor_kind = 'self' AND a.actor_id = a.target_member_id))
      AND (p_target IS NULL OR a.target_member_id = p_target)
      AND (p_target_number IS NULL OR a.target_member_number = p_target_number)
      AND (p_from IS NULL OR a.created_at >= p_from)
      AND (p_to IS NULL OR a.created_at < p_to)
  )
  SELECT
    f.id,
    f.created_at,
    f.actor_id,
    f.actor_role,
    f.actor_member_number,
    CASE WHEN act.id IS NOT NULL AND act.purged_at IS NULL
      THEN pg_catalog.btrim(act.first_name || ' ' || act.last_name) END,
    f.action,
    f.target_member_id,
    f.target_member_number,
    CASE WHEN tgt.id IS NOT NULL AND tgt.purged_at IS NULL AND tgt.anonymised_at IS NULL
      THEN pg_catalog.btrim(tgt.first_name || ' ' || tgt.last_name) END,
    -- Spec 5.3: an anonymised or purged member is shown by number only, so the past names kept in
    -- member.update `changes` are dropped for such a target (the app renderer does the same).
    CASE WHEN f.target_member_id IS NOT NULL
           AND (tgt.id IS NULL OR tgt.purged_at IS NOT NULL OR tgt.anonymised_at IS NOT NULL)
      THEN f.details - 'changes'
      ELSE f.details
    END,
    f.reason,
    (SELECT count(*) FROM filtered)::integer
  FROM filtered AS f
  LEFT JOIN public.members AS act ON act.id = f.actor_id
  LEFT JOIN public.members AS tgt ON tgt.id = f.target_member_id
  WHERE v_cursor_id IS NULL OR (f.created_at, f.id) < (v_cursor_at, v_cursor_id)
  ORDER BY f.created_at DESC, f.id DESC
  LIMIT v_limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_activity(text, uuid, uuid, timestamptz, timestamptz, integer, bigint, text, text)
  FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_activity(text, uuid, uuid, timestamptz, timestamptz, integer, bigint, text, text)
  TO authenticated;

-- Member benefits managed by the board (odd/tasks/member-benefits.md, S3-S4).
--
-- A benefit is a perk for members (a shop discount, ...): translated name and description, an
-- optional discount code, the shop link and a collaborator logo (the id of an entry of
-- src/data/collaborators.ts; the app shows no image for an unknown id).
--
-- Only ACTIVE members read non-archived benefits (the discount code is for members only). Nobody
-- writes the table through the API: every change goes through the audited admin_*_benefit
-- functions, called with the board member's session.
--
-- Errors (prefix:code SQLSTATE):
--   admin:forbidden            insufficient_privilege   not a board member
--   admin:invalid_argument     invalid_parameter_value  bad texts, url, code, logo, order or patch
--   admin:not_found            invalid_parameter_value  unknown benefit
--   admin:benefit_archived     invalid_parameter_value  archiving an archived benefit
--   admin:no_value             invalid_parameter_value  an update that changes nothing
--
-- Translated texts reuse the badge helpers (badge_texts_valid, admin_assert_badge_texts,
-- badge_texts_trim): same {ca, es?, en?} shape, ca required.

-- 1. Validation helpers ---------------------------------------------------------------------------
--    Shop link: https only, no spaces, at most 300 characters.
CREATE OR REPLACE FUNCTION public.benefit_url_valid(p_url text)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  SELECT p_url IS NOT NULL
    AND p_url ~ '^https://[^[:space:]/]+[^[:space:]]*$'
    AND pg_catalog.char_length(p_url) <= 300;
$$;

--    Discount code: 1 to 40 characters, no spaces. NULL means the benefit has no code.
CREATE OR REPLACE FUNCTION public.benefit_code_valid(p_code text)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  SELECT p_code IS NULL OR p_code ~ '^[^[:space:]]{1,40}$';
$$;

--    Collaborator id (logo): the slug shape of src/data/collaborators.ts ids. NULL means no logo.
CREATE OR REPLACE FUNCTION public.benefit_collaborator_valid(p_id text)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  SELECT p_id IS NULL OR p_id ~ '^[a-z0-9][a-z0-9-]{1,63}$';
$$;

REVOKE EXECUTE ON FUNCTION public.benefit_url_valid(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.benefit_code_valid(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.benefit_collaborator_valid(text) FROM PUBLIC, anon, authenticated, service_role;

-- 2. The table --------------------------------------------------------------------------------------
CREATE TABLE public.member_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name jsonb NOT NULL,
  description jsonb NOT NULL,
  discount_code text,
  url text NOT NULL,
  collaborator_id text,
  sort_order integer NOT NULL DEFAULT 0,
  archived_at timestamptz,
  archived_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT member_benefits_name_valid CHECK (public.badge_texts_valid(name, 60)),
  CONSTRAINT member_benefits_description_valid CHECK (public.badge_texts_valid(description, 200)),
  CONSTRAINT member_benefits_code_valid CHECK (public.benefit_code_valid(discount_code)),
  CONSTRAINT member_benefits_url_valid CHECK (public.benefit_url_valid(url)),
  CONSTRAINT member_benefits_collaborator_valid CHECK (public.benefit_collaborator_valid(collaborator_id)),
  CONSTRAINT member_benefits_archived_pair CHECK (archived_at IS NOT NULL OR archived_by IS NULL)
);

COMMENT ON TABLE public.member_benefits IS
  'Member benefits (odd/tasks/member-benefits.md). Read by active members only; written only through the admin_*_benefit functions.';

CREATE INDEX member_benefits_sort_idx ON public.member_benefits (sort_order, created_at);

INSERT INTO public.member_benefits (name, description, discount_code, url, collaborator_id, sort_order)
VALUES (
  '{"ca": "Outlet Games", "es": "Outlet Games", "en": "Outlet Games"}',
  '{"ca": "Descompte a la botiga online de jocs de taula amb el codi de soci.", "es": "Descuento en la tienda online de juegos de mesa con el código de socio.", "en": "Discount at the online board game shop with the member code."}',
  'DARKSTONE',
  'https://outletgames.es',
  'outlet-games',
  10
);

ALTER TABLE public.member_benefits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.member_benefits FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.member_benefits TO authenticated;
-- Not even the service role writes it: every change goes through the audited functions.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.member_benefits FROM service_role;

-- has_role('member') is true only for an ACTIVE member: former members and accounts without a
-- members row see nothing, so the discount code stays with members.
CREATE POLICY member_benefits_select_active ON public.member_benefits
  FOR SELECT TO authenticated
  USING (archived_at IS NULL AND public.has_role('member'));

-- 3. Audit actions --------------------------------------------------------------------------------
ALTER TABLE public.audit_log DROP CONSTRAINT audit_log_action_check;

ALTER TABLE public.audit_log ADD CONSTRAINT audit_log_action_check CHECK (action IN (
  'member.update',
  'member.reveal_sensitive',
  'membership.leave',
  'membership.rejoin',
  'badge.award',
  'badge.revoke',
  'badge.create',
  'badge.update',
  'badge.archive',
  'badge.restore',
  'badge.delete',
  'benefit.create',
  'benefit.update',
  'benefit.archive',
  'benefit.restore',
  'card.regenerate',
  'export.members_csv',
  'export.member_data',
  'export.member_register',
  'export.emails',
  'member.send_access_link',
  'role.grant',
  'role.revoke',
  'member.anonymise',
  'member.purge',
  'account.purge_unconfirmed',
  'ops.cache_refresh'
));

-- 4. Internal helpers -----------------------------------------------------------------------------
--    Locks and returns a benefit. Raises admin:not_found for an unknown id.
CREATE OR REPLACE FUNCTION public.admin_lock_benefit(p_id uuid)
  RETURNS public.member_benefits
  LANGUAGE plpgsql
  SET search_path TO ''
AS $$
DECLARE
  v_row public.member_benefits;
BEGIN
  SELECT b.* INTO v_row
  FROM public.member_benefits AS b
  WHERE b.id = p_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin:not_found: unknown benefit'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN v_row;
END;
$$;

--    Raises admin:invalid_argument unless the url, code and collaborator id are valid.
CREATE OR REPLACE FUNCTION public.admin_assert_benefit_fields(p_url text, p_code text, p_collaborator_id text)
  RETURNS void
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
AS $$
BEGIN
  IF NOT public.benefit_url_valid(p_url) THEN
    RAISE EXCEPTION 'admin:invalid_argument: url must be an https link of at most 300 characters'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT public.benefit_code_valid(p_code) THEN
    RAISE EXCEPTION 'admin:invalid_argument: discount_code must be 1 to 40 characters without spaces'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF NOT public.benefit_collaborator_valid(p_collaborator_id) THEN
    RAISE EXCEPTION 'admin:invalid_argument: unknown collaborator id'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_lock_benefit(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_assert_benefit_fields(text, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- 5. admin_list_benefits ----------------------------------------------------------------------------
--    Every benefit, archived ones included, in display order.
CREATE OR REPLACE FUNCTION public.admin_list_benefits()
  RETURNS TABLE (
    id uuid,
    name jsonb,
    description jsonb,
    discount_code text,
    url text,
    collaborator_id text,
    sort_order integer,
    archived_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.admin_assert_board();

  RETURN QUERY
  SELECT b.id, b.name, b.description, b.discount_code, b.url, b.collaborator_id, b.sort_order,
         b.archived_at, b.created_at, b.updated_at
  FROM public.member_benefits AS b
  ORDER BY (b.archived_at IS NOT NULL), b.sort_order, b.created_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_benefits() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_benefits() TO authenticated;

-- 6. admin_create_benefit ---------------------------------------------------------------------------
--    Adds a benefit at the end of the list and returns its id. Texts are trimmed; an empty code or
--    collaborator id is stored as NULL. Details: {"benefit": id, "name": ca name}.
CREATE OR REPLACE FUNCTION public.admin_create_benefit(
  p_name jsonb,
  p_description jsonb,
  p_url text,
  p_discount_code text DEFAULT NULL,
  p_collaborator_id text DEFAULT NULL
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  v_name jsonb;
  v_url text := pg_catalog.btrim(p_url);
  v_code text := NULLIF(pg_catalog.btrim(p_discount_code), '');
  v_collaborator text := NULLIF(pg_catalog.btrim(p_collaborator_id), '');
  v_order integer;
  v_id uuid;
BEGIN
  PERFORM public.admin_assert_board();

  PERFORM public.admin_assert_badge_texts(p_name, 60, 'name');
  PERFORM public.admin_assert_badge_texts(p_description, 200, 'description');
  PERFORM public.admin_assert_benefit_fields(v_url, v_code, v_collaborator);

  v_name := public.badge_texts_trim(p_name);

  -- Serialises creates so two at once do not take the same sort_order.
  LOCK TABLE public.member_benefits IN SHARE ROW EXCLUSIVE MODE;

  SELECT COALESCE(pg_catalog.max(b.sort_order), 0) + 10 INTO v_order
  FROM public.member_benefits AS b;

  INSERT INTO public.member_benefits (name, description, discount_code, url, collaborator_id, sort_order, created_by)
  VALUES (v_name, public.badge_texts_trim(p_description), v_code, v_url, v_collaborator, v_order, auth.uid())
  RETURNING member_benefits.id INTO v_id;

  PERFORM public.audit_write(
    'benefit.create',
    NULL,
    pg_catalog.jsonb_build_object('benefit', v_id, 'name', v_name ->> 'ca'),
    NULL
  );

  RETURN v_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_benefit(jsonb, jsonb, text, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_create_benefit(jsonb, jsonb, text, text, text) TO authenticated;

-- 7. admin_update_benefit ---------------------------------------------------------------------------
--    p_patch: any of name, description, discount_code, url, collaborator_id, sort_order.
--    discount_code and collaborator_id accept null or "" to clear them. Archived benefits can be
--    edited. Returns the fields that changed; nothing changed is admin:no_value.
--    Details: {"benefit": id, "name": ca name after the change, "fields": [...]} (never the code).
CREATE OR REPLACE FUNCTION public.admin_update_benefit(p_id uuid, p_patch jsonb)
  RETURNS text[]
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  c_allowed constant text[] := ARRAY['name', 'description', 'discount_code', 'url', 'collaborator_id', 'sort_order'];
  v_old public.member_benefits;
  v_new public.member_benefits;
  v_changed text[] := '{}';
  v_field text;
BEGIN
  PERFORM public.admin_assert_board();

  IF p_patch IS NULL OR pg_catalog.jsonb_typeof(p_patch) <> 'object' OR p_patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'admin:invalid_argument: the patch must be a non-empty object'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  FOR v_field IN SELECT k FROM pg_catalog.jsonb_object_keys(p_patch) AS k LOOP
    IF NOT (v_field = ANY (c_allowed)) THEN
      RAISE EXCEPTION 'admin:invalid_argument: % cannot be changed', v_field
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END LOOP;

  IF p_patch ? 'name' THEN PERFORM public.admin_assert_badge_texts(p_patch -> 'name', 60, 'name'); END IF;
  IF p_patch ? 'description' THEN PERFORM public.admin_assert_badge_texts(p_patch -> 'description', 200, 'description'); END IF;

  IF p_patch ? 'url' AND pg_catalog.jsonb_typeof(p_patch -> 'url') <> 'string' THEN
    RAISE EXCEPTION 'admin:invalid_argument: url must be a string'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_patch ? 'discount_code' AND pg_catalog.jsonb_typeof(p_patch -> 'discount_code') NOT IN ('string', 'null') THEN
    RAISE EXCEPTION 'admin:invalid_argument: discount_code must be a string or null'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_patch ? 'collaborator_id' AND pg_catalog.jsonb_typeof(p_patch -> 'collaborator_id') NOT IN ('string', 'null') THEN
    RAISE EXCEPTION 'admin:invalid_argument: collaborator_id must be a string or null'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF p_patch ? 'sort_order' AND (
    pg_catalog.jsonb_typeof(p_patch -> 'sort_order') <> 'number'
    OR (p_patch ->> 'sort_order') !~ '^-?[0-9]{1,6}$'
  ) THEN
    RAISE EXCEPTION 'admin:invalid_argument: sort_order must be a whole number'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_old := public.admin_lock_benefit(p_id);
  v_new := v_old;

  IF p_patch ? 'name' THEN v_new.name := public.badge_texts_trim(p_patch -> 'name'); END IF;
  IF p_patch ? 'description' THEN v_new.description := public.badge_texts_trim(p_patch -> 'description'); END IF;
  IF p_patch ? 'url' THEN v_new.url := pg_catalog.btrim(p_patch ->> 'url'); END IF;
  IF p_patch ? 'discount_code' THEN v_new.discount_code := NULLIF(pg_catalog.btrim(p_patch ->> 'discount_code'), ''); END IF;
  IF p_patch ? 'collaborator_id' THEN v_new.collaborator_id := NULLIF(pg_catalog.btrim(p_patch ->> 'collaborator_id'), ''); END IF;
  IF p_patch ? 'sort_order' THEN v_new.sort_order := (p_patch ->> 'sort_order')::integer; END IF;

  PERFORM public.admin_assert_benefit_fields(v_new.url, v_new.discount_code, v_new.collaborator_id);

  IF v_new.name IS DISTINCT FROM v_old.name THEN v_changed := pg_catalog.array_append(v_changed, 'name'); END IF;
  IF v_new.description IS DISTINCT FROM v_old.description THEN v_changed := pg_catalog.array_append(v_changed, 'description'); END IF;
  IF v_new.discount_code IS DISTINCT FROM v_old.discount_code THEN v_changed := pg_catalog.array_append(v_changed, 'discount_code'); END IF;
  IF v_new.url IS DISTINCT FROM v_old.url THEN v_changed := pg_catalog.array_append(v_changed, 'url'); END IF;
  IF v_new.collaborator_id IS DISTINCT FROM v_old.collaborator_id THEN v_changed := pg_catalog.array_append(v_changed, 'collaborator_id'); END IF;
  IF v_new.sort_order IS DISTINCT FROM v_old.sort_order THEN v_changed := pg_catalog.array_append(v_changed, 'sort_order'); END IF;

  IF pg_catalog.cardinality(v_changed) = 0 THEN
    RAISE EXCEPTION 'admin:no_value: nothing to change'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.member_benefits AS b
  SET name = v_new.name,
      description = v_new.description,
      discount_code = v_new.discount_code,
      url = v_new.url,
      collaborator_id = v_new.collaborator_id,
      sort_order = v_new.sort_order,
      updated_at = pg_catalog.clock_timestamp()
  WHERE b.id = p_id;

  PERFORM public.audit_write(
    'benefit.update',
    NULL,
    pg_catalog.jsonb_build_object(
      'benefit', p_id,
      'name', v_new.name ->> 'ca',
      'fields', pg_catalog.to_jsonb(v_changed)
    ),
    NULL
  );

  RETURN v_changed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_benefit(uuid, jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_benefit(uuid, jsonb) TO authenticated;

-- 8. admin_archive_benefit / admin_restore_benefit --------------------------------------------------
--    Archive hides the benefit from every member; restore shows it again.
--    Details: {"benefit": id, "name": ca name}.
CREATE OR REPLACE FUNCTION public.admin_archive_benefit(p_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  v_row public.member_benefits;
BEGIN
  PERFORM public.admin_assert_board();

  v_row := public.admin_lock_benefit(p_id);

  IF v_row.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'admin:benefit_archived: the benefit is already archived'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.member_benefits AS b
  SET archived_at = pg_catalog.clock_timestamp(),
      archived_by = auth.uid(),
      updated_at = pg_catalog.clock_timestamp()
  WHERE b.id = p_id;

  PERFORM public.audit_write(
    'benefit.archive',
    NULL,
    pg_catalog.jsonb_build_object('benefit', p_id, 'name', v_row.name ->> 'ca'),
    NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_restore_benefit(p_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  v_row public.member_benefits;
BEGIN
  PERFORM public.admin_assert_board();

  v_row := public.admin_lock_benefit(p_id);

  IF v_row.archived_at IS NULL THEN
    RAISE EXCEPTION 'admin:invalid_argument: the benefit is not archived'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.member_benefits AS b
  SET archived_at = NULL,
      archived_by = NULL,
      updated_at = pg_catalog.clock_timestamp()
  WHERE b.id = p_id;

  PERFORM public.audit_write(
    'benefit.restore',
    NULL,
    pg_catalog.jsonb_build_object('benefit', p_id, 'name', v_row.name ->> 'ca'),
    NULL
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_archive_benefit(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_archive_benefit(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_restore_benefit(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_restore_benefit(uuid) TO authenticated;

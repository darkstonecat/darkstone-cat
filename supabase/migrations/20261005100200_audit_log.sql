-- Migration M3: append-only audit log (admin panel spec §5, BR-14, BR-15).
--
-- Action keys (spec §5.1, exactly these 18; the CHECK below lists the same set):
--   member.update               board         member, fields changed (T7)
--   member.reveal_sensitive     board / superadmin for a former member   which field (app)
--   membership.leave            member (self) or board                  (T6)
--   membership.rejoin           board                                   (T6)
--   badge.award                 board                                   (T7)
--   badge.revoke                board                                   (T7)
--   card.regenerate             board                                   (T7)
--   export.members_csv          board         filter used, row count    (app)
--   export.member_data          board         member                    (app)
--   export.member_register      superadmin    row count                 (app)
--   export.emails               board         list, number of addresses (app)
--   member.send_access_link     board         member                    (app)
--   role.grant                  superadmin                              (T8)
--   role.revoke                 superadmin                              (T8)
--   member.anonymise            superadmin                              (T8)
--   member.purge                system        retention job             (T12)
--   account.purge_unconfirmed   system        retention job             (T12)
--   ops.cache_refresh           board         jobs run, result          (app)
-- "(app)" keys are logged by server actions through log_admin_event(); the rest are written
-- by the SECURITY DEFINER functions of later tasks through audit_write(), in the same
-- transaction as the change.
--
-- Who may do what:
--   - Read: board, superadmin and the legacy admin (RLS, has_role('board')); the service role
--     (SELECT grant, bypasses RLS). anon has no grant at all.
--   - Write: nobody directly. anon, authenticated and service_role have no INSERT, UPDATE,
--     DELETE or TRUNCATE. Entries are written only by audit_write() (owner privileges), which
--     only other SECURITY DEFINER functions can call, and by log_admin_event() for the (app)
--     keys. Only the owner (postgres) can insert directly, e.g. a backdated row in a test.
--   - Update: never, not even the owner (trigger).
--   - Delete: only entries older than 3 years (spec §5.3), enforced by the same trigger for
--     every role including the owner. The retention job (T12) deletes them as the owner, from
--     a SECURITY DEFINER function or a postgres connection. TRUNCATE is always refused.
--   No foreign keys: entries survive the anonymisation and the purge of actor and target, and
--   keep their member numbers as snapshots (spec §5.3).
--
-- BR-15, what the database enforces on details (in audit_write(), so on every writer, and
-- again as a CHECK): no object key, at any depth, that names a sensitive field (dni, nie,
-- dni_nie, dni_nie_encrypted, phone, phone_encrypted, phone_number, telefon, telephone,
-- mobile), and no string value shaped like a DNI, a NIE or a phone number (9 to 15 digits).
-- Field NAMES go as values instead: {"field": "dni"}, {"fields": ["dni_nie"]}. The free-text
-- reason is not scanned; the app must not put DNI/phone values there.
--
-- Errors (the message starts with a stable prefix the app maps to a translated text):
--   audit:forbidden            42501  caller lacks the role (board, or superadmin where needed)
--   audit:action_not_allowed   22023  key not logged directly through log_admin_event()
--   audit:invalid_target       22023  target missing, unknown/purged, not expected, or not active
--   audit:invalid_details      22023  details not an object, or a reveal without a valid field
--   audit:reason_required      22023  a former member's DNI reveal without a reason (BR-21)
--   audit:sensitive_details    23514  details would store a DNI/phone value (BR-15)
--   audit:append_only          23514  UPDATE, DELETE of an entry younger than 3 years, TRUNCATE
--
-- Safe to apply to production before the code that uses it: nothing reads or writes the table
-- yet.

-- 1. Sensitive-value detector (BR-15) ---------------------------------------------------------
--    Pure, so it can back a CHECK. Internal: no API role needs to call it.
CREATE OR REPLACE FUNCTION public.audit_details_leak(p_details jsonb)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM pg_catalog.jsonb_path_query(COALESCE(p_details, '{}'::jsonb), 'strict $.**') AS item(v)
    WHERE (
        pg_catalog.jsonb_typeof(item.v) = 'object'
        AND EXISTS (
          SELECT 1
          FROM pg_catalog.jsonb_object_keys(item.v) AS k(name)
          WHERE pg_catalog.lower(k.name) IN (
            'dni', 'nie', 'dni_nie', 'dni_nie_encrypted', 'phone', 'phone_encrypted',
            'phone_number', 'telefon', 'telephone', 'mobile'
          )
        )
      )
      OR (
        pg_catalog.jsonb_typeof(item.v) = 'string'
        AND (
          (item.v #>> '{}') ~ '^[0-9]{8}[- ]?[A-Za-z]$'                      -- DNI
          OR (item.v #>> '{}') ~ '^[XYZxyz][- ]?[0-9]{7}[- ]?[A-Za-z]$'      -- NIE
          OR (
            (item.v #>> '{}') ~ '^\+?[0-9][0-9 ().-]*$'                       -- phone
            AND pg_catalog.length(pg_catalog.regexp_replace(item.v #>> '{}', '[^0-9]', '', 'g'))
                BETWEEN 9 AND 15
          )
        )
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.audit_details_leak(jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- 2. Table -------------------------------------------------------------------------------------
--    A new, empty table, so its CHECKs are validated straight away.
CREATE TABLE public.audit_log (
  id bigserial PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid,                -- NULL = system (retention job) or a call without a session
  actor_role text,              -- role at that moment
  actor_member_number text,     -- snapshot
  action text NOT NULL,
  target_member_id uuid,
  target_member_number text,    -- snapshot, what V-4 shows once the target is purged
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  reason text,
  CONSTRAINT audit_log_action_check CHECK (action IN (
    'member.update',
    'member.reveal_sensitive',
    'membership.leave',
    'membership.rejoin',
    'badge.award',
    'badge.revoke',
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
  )),
  CONSTRAINT audit_log_details_object CHECK (pg_catalog.jsonb_typeof(details) = 'object'),
  CONSTRAINT audit_log_details_size CHECK (pg_catalog.octet_length(details::text) <= 16384),
  CONSTRAINT audit_log_details_no_sensitive CHECK (NOT public.audit_details_leak(details)),
  CONSTRAINT audit_log_reason_length CHECK (pg_catalog.char_length(reason) <= 1000)
);

COMMENT ON TABLE public.audit_log IS
  'Append-only admin audit log (spec §5). Written only through audit_write()/log_admin_event(); entries are deleted only after 3 years.';

-- V-4 filters: date range (default), action, actor, target member; V-3 shows a member's
-- entries; V-1 the latest 10. id breaks ties for stable pagination.
CREATE INDEX audit_log_created_at_idx ON public.audit_log (created_at DESC, id DESC);
CREATE INDEX audit_log_action_idx ON public.audit_log (action, created_at DESC);
CREATE INDEX audit_log_actor_idx ON public.audit_log (actor_id, created_at DESC);
CREATE INDEX audit_log_target_idx ON public.audit_log (target_member_id, created_at DESC);

-- 3. Privileges and RLS ------------------------------------------------------------------------
REVOKE ALL ON public.audit_log FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.audit_log TO authenticated, service_role;
REVOKE ALL ON SEQUENCE public.audit_log_id_seq FROM PUBLIC, anon, authenticated, service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--    TO authenticated: has_role() is not executable by anon (M2). The sub-select runs it once
--    per query instead of once per row.
CREATE POLICY audit_log_board_select ON public.audit_log
  FOR SELECT
  TO authenticated
  USING ((SELECT public.has_role('board')));

-- 4. Append-only trigger (BR-14) ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_log_append_only()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO ''
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.created_at < now() - interval '3 years' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'audit:append_only: audit entries cannot be changed or deleted (% refused)', TG_OP
    USING ERRCODE = 'check_violation';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_log_append_only() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_append_only();

CREATE TRIGGER audit_log_no_truncate
  BEFORE TRUNCATE ON public.audit_log
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.audit_log_append_only();

-- 5. audit_write(): the one writer -------------------------------------------------------------
--    Internal: called only by other SECURITY DEFINER functions (owner privileges), never through
--    the API. Snapshots the actor (auth.uid(), their role and member number now) and the target
--    member number. A blank reason is stored as NULL. An unknown action fails on the CHECK.
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
DECLARE
  actor uuid := auth.uid();
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

  IF actor IS NOT NULL THEN
    SELECT m.role, m.member_number INTO actor_role_now, actor_number
    FROM public.members AS m
    WHERE m.id = actor;
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
    actor, actor_role_now, actor_number, p_action,
    p_target, target_number, entry_details, NULLIF(pg_catalog.btrim(p_reason), '')
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_write(text, uuid, jsonb, text) FROM PUBLIC, anon, authenticated, service_role;

-- 6. log_admin_event(): events the app logs itself ---------------------------------------------
--    For reads that expose personal data (exports, DNI/phone reveal) and actions whose work
--    happens outside the database (access link e-mail, cache refresh). Board or higher; the
--    register export is superadmin only (S-4). Target rules:
--      export.member_data, member.reveal_sensitive, member.send_access_link  need a member
--        that is not purged; the access link only for an active member (A-15);
--      export.members_csv, export.member_register, export.emails, ops.cache_refresh  take none.
--    member.reveal_sensitive needs details.field = 'dni' | 'phone'. On a former member
--    (BR-21) only a superadmin may reveal, only the DNI (the phone is deleted on leave), and
--    with a non-blank reason. Minimum reason lengths are an open decision (D-E) and not
--    enforced here; A-11 on a former member stays open to board (D-D).
CREATE OR REPLACE FUNCTION public.log_admin_event(
  p_action text,
  p_target uuid,
  p_details jsonb DEFAULT '{}'::jsonb,
  p_reason text DEFAULT NULL
)
  RETURNS bigint
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  entry_details jsonb := COALESCE(p_details, '{}'::jsonb);
  target_left_on date;
BEGIN
  IF NOT public.has_role('board') THEN
    RAISE EXCEPTION 'audit:forbidden: board role required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_action IS NULL OR p_action NOT IN (
    'export.members_csv', 'export.member_data', 'export.member_register', 'export.emails',
    'member.reveal_sensitive', 'member.send_access_link', 'ops.cache_refresh'
  ) THEN
    RAISE EXCEPTION 'audit:action_not_allowed: % cannot be logged directly', COALESCE(p_action, 'NULL')
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_action = 'export.member_register' AND NOT public.has_role('superadmin') THEN
    RAISE EXCEPTION 'audit:forbidden: superadmin role required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF pg_catalog.jsonb_typeof(entry_details) <> 'object' THEN
    RAISE EXCEPTION 'audit:invalid_details: details must be a JSON object'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_action IN ('export.member_data', 'member.reveal_sensitive', 'member.send_access_link') THEN
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
  ELSIF p_target IS NOT NULL THEN
    RAISE EXCEPTION 'audit:invalid_target: % takes no target member', p_action
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_action = 'member.send_access_link' AND target_left_on IS NOT NULL THEN
    RAISE EXCEPTION 'audit:invalid_target: an access link goes to active members only'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_action = 'member.reveal_sensitive' THEN
    IF entry_details->>'field' IS NULL OR entry_details->>'field' NOT IN ('dni', 'phone') THEN
      RAISE EXCEPTION 'audit:invalid_details: a reveal names the field, dni or phone'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF target_left_on IS NOT NULL THEN
      IF NOT public.has_role('superadmin') THEN
        RAISE EXCEPTION 'audit:forbidden: only a superadmin can reveal a former member''s DNI'
          USING ERRCODE = 'insufficient_privilege';
      END IF;

      IF entry_details->>'field' <> 'dni' THEN
        RAISE EXCEPTION 'audit:invalid_details: a former member has no phone to reveal'
          USING ERRCODE = 'invalid_parameter_value';
      END IF;

      IF NULLIF(pg_catalog.btrim(p_reason), '') IS NULL THEN
        RAISE EXCEPTION 'audit:reason_required: revealing a former member''s DNI needs a reason'
          USING ERRCODE = 'invalid_parameter_value';
      END IF;
    END IF;
  END IF;

  RETURN public.audit_write(p_action, p_target, entry_details, p_reason);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_admin_event(text, uuid, jsonb, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.log_admin_event(text, uuid, jsonb, text) TO authenticated;

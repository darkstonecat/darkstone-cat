-- Migration: badge catalogue managed by the board (odd/tasks/badge-catalogue.md S1-S5).
--
-- 1. public.badges, the catalogue. It replaces the hard-coded list (member_badges CHECK and
--    admin_badge_keys()). key is an immutable slug; name / earned_text / locked_text are
--    {ca, es, en} objects with ca required (the app falls back to ca); icon is one of
--    badge_icon_keys(). The tenure badge "X anys amb Darkstone" is derived by the app (BR-6) and
--    never lives here: member_tenure (and the retired member_year) are reserved keys.
--    Members read the catalogue except archived badges; no API role writes it, service_role
--    included.
-- 2. member_badges.badge_key becomes a foreign key to it. The existing rows already use the two
--    seeded keys. member_badges_select_own is unchanged on purpose: a member's own data export
--    (src/lib/profile/actions.ts) must keep archived badges; the app hides them on screen.
-- 3. audit_log: new actions badge.create / badge.update / badge.archive / badge.restore /
--    badge.delete (no target member). Every badge entry, award and revoke included, stores the
--    Catalan name at that moment (details.name) so the log stays readable after a rename.
-- 4. Board functions (SECURITY DEFINER, EXECUTE for authenticated, role checked inside, actor =
--    auth.uid()): admin_list_badges, admin_create_badge, admin_update_badge,
--    admin_archive_badge, admin_restore_badge, admin_award_badge_bulk; admin_delete_badge is
--    superadmin only and only for a badge never awarded (no holder and no badge.award entry).
-- 5. admin_award_badge / admin_revoke_badge v2: same signatures, they read the catalogue and
--    refuse an archived badge ("Desaparecen para todos": it can be neither awarded nor revoked
--    until it is restored). admin_badge_keys() now lists the non-archived catalogue.
-- 6. admin_get_member v2: each badge also carries name, icon and archived.
--
-- Errors (prefix:code, SQLSTATE):
--   admin:forbidden          42501  caller lacks the role
--   admin:invalid_argument   22023  bad key, texts, icon, patch, list or unknown badge on award
--   admin:not_found          22023  unknown badge (catalogue functions) or member
--   admin:not_active         22023  a former member in an award
--   admin:no_value           22023  an update that changes nothing
--   admin:reason_too_long    22023  award note over 500 characters
--   admin:badge_exists       22023  create with a key already in the catalogue (archived too)
--   admin:badge_archived     22023  award, revoke or archive of an archived badge
--   admin:badge_in_use       22023  delete of a badge that was ever awarded
--   badges:key_immutable     22023  any UPDATE of badges.key, owner included

-- 1. Validation helpers ---------------------------------------------------------------------------
--    The icons the board can pick. The app maps each key to a react-icons/md component; both
--    lists are pinned by tests (tests/integration/badge-catalogue.test.ts).
CREATE OR REPLACE FUNCTION public.badge_icon_keys()
  RETURNS text[]
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  SELECT ARRAY[
    'star', 'how_to_reg', 'gift', 'dice', 'puzzle', 'trophy', 'volunteer', 'groups',
    'school', 'celebration', 'book', 'medal', 'heart', 'handshake', 'brush', 'megaphone'
  ]::text[];
$$;

--    A translated text: a JSON object whose keys are among ca / es / en, ca present, every value
--    a string that is not blank and at most p_max characters once trimmed.
CREATE OR REPLACE FUNCTION public.badge_texts_valid(p_texts jsonb, p_max integer)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  SELECT p_texts IS NOT NULL
    AND pg_catalog.jsonb_typeof(p_texts) = 'object'
    AND p_texts ? 'ca'
    AND NOT EXISTS (
      SELECT 1
      FROM pg_catalog.jsonb_each(p_texts) AS e(locale, value)
      WHERE e.locale NOT IN ('ca', 'es', 'en')
         OR pg_catalog.jsonb_typeof(e.value) <> 'string'
         OR pg_catalog.btrim(e.value #>> '{}') = ''
         OR pg_catalog.char_length(pg_catalog.btrim(e.value #>> '{}')) > p_max
    );
$$;

--    Slug: lower case letter, then letters, digits or underscores, 3 to 48 characters.
CREATE OR REPLACE FUNCTION public.badge_key_valid(p_key text)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  SELECT p_key IS NOT NULL
    AND p_key ~ '^[a-z][a-z0-9_]{2,47}$'
    AND p_key NOT IN ('member_tenure', 'member_year');
$$;

REVOKE EXECUTE ON FUNCTION public.badge_icon_keys() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.badge_texts_valid(jsonb, integer) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.badge_key_valid(text) FROM PUBLIC, anon, authenticated, service_role;

-- 2. The catalogue ----------------------------------------------------------------------------------
CREATE TABLE public.badges (
  key text PRIMARY KEY,
  name jsonb NOT NULL,
  earned_text jsonb NOT NULL,
  locked_text jsonb NOT NULL,
  icon text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  show_locked boolean NOT NULL DEFAULT true,
  archived_at timestamptz,
  archived_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT badges_key_format CHECK (public.badge_key_valid(key)),
  CONSTRAINT badges_name_valid CHECK (public.badge_texts_valid(name, 60)),
  CONSTRAINT badges_earned_text_valid CHECK (public.badge_texts_valid(earned_text, 200)),
  CONSTRAINT badges_locked_text_valid CHECK (public.badge_texts_valid(locked_text, 200)),
  CONSTRAINT badges_icon_known CHECK (icon = ANY (public.badge_icon_keys())),
  CONSTRAINT badges_archived_pair CHECK (archived_at IS NOT NULL OR archived_by IS NULL)
);

COMMENT ON TABLE public.badges IS
  'Badge catalogue (odd/tasks/badge-catalogue.md). Written only through the admin_*_badge functions.';

CREATE INDEX badges_sort_idx ON public.badges (sort_order, key);

--    The key is what member_badges and the audit log point at: it never changes.
CREATE OR REPLACE FUNCTION public.badges_key_guard()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO ''
AS $$
BEGIN
  IF NEW.key IS DISTINCT FROM OLD.key THEN
    RAISE EXCEPTION 'badges:key_immutable: a badge key never changes'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.badges_key_guard() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER badges_key_guard
  BEFORE UPDATE OF key ON public.badges
  FOR EACH ROW EXECUTE FUNCTION public.badges_key_guard();

INSERT INTO public.badges (key, name, earned_text, locked_text, icon, sort_order) VALUES
  (
    'volunteer_egara_joga',
    '{"ca": "Voluntariat Egara Juga", "es": "Voluntariado Egara Juga", "en": "Egara Juga volunteer"}',
    '{"ca": "Ha col·laborat a la fira Egara Juga.", "es": "Ha colaborado en la feria Egara Juga.", "en": "Helped out at the Egara Juga fair."}',
    '{"ca": "Col·labora a la fira Egara Juga per aconseguir-la.", "es": "Colabora en la feria Egara Juga para conseguirla.", "en": "Help out at the Egara Juga fair to earn it."}',
    'how_to_reg',
    10
  ),
  (
    'ludoteca_donor',
    '{"ca": "Donant de la ludoteca", "es": "Donante de la ludoteca", "en": "Library donor"}',
    '{"ca": "Ha donat un joc a la ludoteca de l''associació.", "es": "Ha donado un juego a la ludoteca de la asociación.", "en": "Donated a game to the association''s library."}',
    '{"ca": "Dona un joc a la ludoteca de l''associació per aconseguir-la.", "es": "Dona un juego a la ludoteca de la asociación para conseguirla.", "en": "Donate a game to the association''s library to earn it."}',
    'gift',
    20
  );

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.badges FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.badges TO authenticated;
-- Not even the service role writes the catalogue: every change goes through the audited
-- admin_*_badge functions (owned by postgres). Its CHECK helpers are not executable by API roles
-- either, so a direct write would fail anyway; this makes the rule explicit.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.badges FROM service_role;

CREATE POLICY badges_select_active ON public.badges
  FOR SELECT TO authenticated
  USING (archived_at IS NULL);

-- 3. member_badges points at the catalogue --------------------------------------------------------
ALTER TABLE public.member_badges DROP CONSTRAINT member_badges_badge_key_check;

ALTER TABLE public.member_badges
  ADD CONSTRAINT member_badges_badge_key_fkey
  FOREIGN KEY (badge_key) REFERENCES public.badges(key) ON UPDATE RESTRICT ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS member_badges_badge_key_idx ON public.member_badges (badge_key);

-- 4. Audit actions --------------------------------------------------------------------------------
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

-- 5. Internal helpers -----------------------------------------------------------------------------
--    The non-archived catalogue, for code that still asks for "the keys the board can award".
CREATE OR REPLACE FUNCTION public.admin_badge_keys()
  RETURNS text[]
  LANGUAGE sql
  STABLE
  SET search_path TO ''
AS $$
  SELECT COALESCE(pg_catalog.array_agg(b.key ORDER BY b.sort_order, b.key), '{}'::text[])
  FROM public.badges AS b
  WHERE b.archived_at IS NULL;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_badge_keys() FROM PUBLIC, anon, authenticated, service_role;

--    Locks and returns a catalogue badge. Raises admin:not_found for an unknown key.
CREATE OR REPLACE FUNCTION public.admin_lock_badge(p_key text)
  RETURNS public.badges
  LANGUAGE plpgsql
  SET search_path TO ''
AS $$
DECLARE
  v_row public.badges;
BEGIN
  SELECT b.* INTO v_row
  FROM public.badges AS b
  WHERE b.key = p_key
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin:not_found: unknown badge'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN v_row;
END;
$$;

--    The badge an award or revoke is about: it must exist (admin:invalid_argument, as before the
--    catalogue) and not be archived (admin:badge_archived). Shares the row so a concurrent
--    archive waits for the award to finish.
CREATE OR REPLACE FUNCTION public.admin_awardable_badge(p_key text)
  RETURNS public.badges
  LANGUAGE plpgsql
  SET search_path TO ''
AS $$
DECLARE
  v_row public.badges;
BEGIN
  IF p_key IS NOT NULL THEN
    SELECT b.* INTO v_row
    FROM public.badges AS b
    WHERE b.key = p_key
    FOR SHARE;
  END IF;

  IF v_row.key IS NULL THEN
    RAISE EXCEPTION 'admin:invalid_argument: unknown badge'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_row.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'admin:badge_archived: the badge is archived'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN v_row;
END;
$$;

--    Raises admin:invalid_argument unless p_texts is a valid translated text of at most p_max.
CREATE OR REPLACE FUNCTION public.admin_assert_badge_texts(p_texts jsonb, p_max integer, p_field text)
  RETURNS void
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
AS $$
BEGIN
  IF NOT public.badge_texts_valid(p_texts, p_max) THEN
    RAISE EXCEPTION 'admin:invalid_argument: % must be {ca, es?, en?} texts of at most % characters', p_field, p_max
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
END;
$$;

--    Trims every value of a valid translated text.
CREATE OR REPLACE FUNCTION public.badge_texts_trim(p_texts jsonb)
  RETURNS jsonb
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  SELECT pg_catalog.jsonb_object_agg(e.locale, pg_catalog.btrim(e.value #>> '{}'))
  FROM pg_catalog.jsonb_each(p_texts) AS e(locale, value);
$$;

REVOKE EXECUTE ON FUNCTION public.admin_lock_badge(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_awardable_badge(text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_assert_badge_texts(jsonb, integer, text) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.badge_texts_trim(jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- 6. admin_list_badges ------------------------------------------------------------------------------
--    Every badge, archived ones included, in display order. holders counts the members who hold it
--    (purged stubs excluded); active_holders only active members (what an archive hides from);
--    ever_awarded is what admin_delete_badge checks (a holder now or a badge.award entry).
CREATE OR REPLACE FUNCTION public.admin_list_badges()
  RETURNS TABLE (
    key text,
    name jsonb,
    earned_text jsonb,
    locked_text jsonb,
    icon text,
    sort_order integer,
    show_locked boolean,
    archived_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz,
    holders integer,
    active_holders integer,
    ever_awarded boolean
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
  SELECT
    b.key,
    b.name,
    b.earned_text,
    b.locked_text,
    b.icon,
    b.sort_order,
    b.show_locked,
    b.archived_at,
    b.created_at,
    b.updated_at,
    COALESCE(h.holders, 0)::integer,
    COALESCE(h.active_holders, 0)::integer,
    (COALESCE(h.n_rows, 0) > 0 OR EXISTS (
      SELECT 1
      FROM public.audit_log AS a
      WHERE a.action = 'badge.award'
        AND a.details ->> 'badge' = b.key
    ))
  FROM public.badges AS b
  LEFT JOIN LATERAL (
    SELECT
      pg_catalog.count(*) AS n_rows,
      pg_catalog.count(*) FILTER (WHERE m.purged_at IS NULL) AS holders,
      pg_catalog.count(*) FILTER (WHERE m.purged_at IS NULL AND m.left_on IS NULL) AS active_holders
    FROM public.member_badges AS mb
    JOIN public.members AS m ON m.id = mb.member_id
    WHERE mb.badge_key = b.key
  ) AS h ON true
  ORDER BY b.sort_order, b.key;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_badges() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_badges() TO authenticated;

-- 7. admin_create_badge -----------------------------------------------------------------------------
--    Puts the new badge last. Details: {"badge": key, "name": ca name}.
CREATE OR REPLACE FUNCTION public.admin_create_badge(
  p_key text,
  p_name jsonb,
  p_earned_text jsonb,
  p_locked_text jsonb,
  p_icon text,
  p_show_locked boolean DEFAULT true
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  v_name jsonb;
BEGIN
  PERFORM public.admin_assert_board();

  IF NOT public.badge_key_valid(p_key) THEN
    RAISE EXCEPTION 'admin:invalid_argument: a badge key is 3 to 48 lower case letters, digits or _'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM public.admin_assert_badge_texts(p_name, 60, 'name');
  PERFORM public.admin_assert_badge_texts(p_earned_text, 200, 'earned_text');
  PERFORM public.admin_assert_badge_texts(p_locked_text, 200, 'locked_text');

  IF p_icon IS NULL OR NOT (p_icon = ANY (public.badge_icon_keys())) THEN
    RAISE EXCEPTION 'admin:invalid_argument: unknown icon'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_name := public.badge_texts_trim(p_name);

  -- Serialises creates so two of them never get the same sort_order.
  LOCK TABLE public.badges IN SHARE ROW EXCLUSIVE MODE;

  IF EXISTS (SELECT 1 FROM public.badges AS b WHERE b.key = p_key) THEN
    RAISE EXCEPTION 'admin:badge_exists: a badge with this key already exists'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO public.badges (key, name, earned_text, locked_text, icon, sort_order, show_locked, created_by)
  VALUES (
    p_key,
    v_name,
    public.badge_texts_trim(p_earned_text),
    public.badge_texts_trim(p_locked_text),
    p_icon,
    COALESCE((SELECT pg_catalog.max(b.sort_order) FROM public.badges AS b), 0) + 10,
    COALESCE(p_show_locked, true),
    auth.uid()
  );

  PERFORM public.audit_write(
    'badge.create',
    NULL,
    pg_catalog.jsonb_build_object('badge', p_key, 'name', v_name ->> 'ca'),
    NULL
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_create_badge(text, jsonb, jsonb, jsonb, text, boolean) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_create_badge(text, jsonb, jsonb, jsonb, text, boolean) TO authenticated;

-- 8. admin_update_badge -----------------------------------------------------------------------------
--    p_patch: any of name, earned_text, locked_text, icon, sort_order, show_locked. The key, the
--    archive state and anything else are refused. Archived badges can be edited (to fix one
--    before restoring it). Returns the fields that changed; nothing changed is admin:no_value.
--    Details: {"badge": key, "name": ca name after the change, "fields": [...]}.
CREATE OR REPLACE FUNCTION public.admin_update_badge(p_key text, p_patch jsonb)
  RETURNS text[]
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  c_allowed constant text[] := ARRAY['name', 'earned_text', 'locked_text', 'icon', 'sort_order', 'show_locked'];
  v_old public.badges;
  v_new public.badges;
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
  IF p_patch ? 'earned_text' THEN PERFORM public.admin_assert_badge_texts(p_patch -> 'earned_text', 200, 'earned_text'); END IF;
  IF p_patch ? 'locked_text' THEN PERFORM public.admin_assert_badge_texts(p_patch -> 'locked_text', 200, 'locked_text'); END IF;

  IF p_patch ? 'icon' AND (
    pg_catalog.jsonb_typeof(p_patch -> 'icon') <> 'string'
    OR NOT ((p_patch ->> 'icon') = ANY (public.badge_icon_keys()))
  ) THEN
    RAISE EXCEPTION 'admin:invalid_argument: unknown icon'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_patch ? 'sort_order' AND (
    pg_catalog.jsonb_typeof(p_patch -> 'sort_order') <> 'number'
    OR (p_patch ->> 'sort_order') !~ '^-?[0-9]{1,6}$'
  ) THEN
    RAISE EXCEPTION 'admin:invalid_argument: sort_order must be a whole number'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_patch ? 'show_locked' AND pg_catalog.jsonb_typeof(p_patch -> 'show_locked') <> 'boolean' THEN
    RAISE EXCEPTION 'admin:invalid_argument: show_locked must be true or false'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_old := public.admin_lock_badge(p_key);
  v_new := v_old;

  IF p_patch ? 'name' THEN v_new.name := public.badge_texts_trim(p_patch -> 'name'); END IF;
  IF p_patch ? 'earned_text' THEN v_new.earned_text := public.badge_texts_trim(p_patch -> 'earned_text'); END IF;
  IF p_patch ? 'locked_text' THEN v_new.locked_text := public.badge_texts_trim(p_patch -> 'locked_text'); END IF;
  IF p_patch ? 'icon' THEN v_new.icon := p_patch ->> 'icon'; END IF;
  IF p_patch ? 'sort_order' THEN v_new.sort_order := (p_patch ->> 'sort_order')::integer; END IF;
  IF p_patch ? 'show_locked' THEN v_new.show_locked := (p_patch ->> 'show_locked')::boolean; END IF;

  IF v_new.name IS DISTINCT FROM v_old.name THEN v_changed := pg_catalog.array_append(v_changed, 'name'); END IF;
  IF v_new.earned_text IS DISTINCT FROM v_old.earned_text THEN v_changed := pg_catalog.array_append(v_changed, 'earned_text'); END IF;
  IF v_new.locked_text IS DISTINCT FROM v_old.locked_text THEN v_changed := pg_catalog.array_append(v_changed, 'locked_text'); END IF;
  IF v_new.icon IS DISTINCT FROM v_old.icon THEN v_changed := pg_catalog.array_append(v_changed, 'icon'); END IF;
  IF v_new.sort_order IS DISTINCT FROM v_old.sort_order THEN v_changed := pg_catalog.array_append(v_changed, 'sort_order'); END IF;
  IF v_new.show_locked IS DISTINCT FROM v_old.show_locked THEN v_changed := pg_catalog.array_append(v_changed, 'show_locked'); END IF;

  IF pg_catalog.cardinality(v_changed) = 0 THEN
    RAISE EXCEPTION 'admin:no_value: nothing to change'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.badges AS b
  SET name = v_new.name,
      earned_text = v_new.earned_text,
      locked_text = v_new.locked_text,
      icon = v_new.icon,
      sort_order = v_new.sort_order,
      show_locked = v_new.show_locked,
      updated_at = pg_catalog.clock_timestamp()
  WHERE b.key = p_key;

  PERFORM public.audit_write(
    'badge.update',
    NULL,
    pg_catalog.jsonb_build_object(
      'badge', p_key,
      'name', v_new.name ->> 'ca',
      'fields', pg_catalog.to_jsonb(v_changed)
    ),
    NULL
  );

  RETURN v_changed;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_badge(text, jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_badge(text, jsonb) TO authenticated;

-- 9. admin_archive_badge / admin_restore_badge ------------------------------------------------------
--    Archive hides the badge from every member, holders included, and keeps member_badges as it
--    is, so a restore is lossless. Details: archive {"badge", "name", "active_holders"};
--    restore {"badge", "name"}.
CREATE OR REPLACE FUNCTION public.admin_archive_badge(p_key text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  v_row public.badges;
  v_active integer;
BEGIN
  PERFORM public.admin_assert_board();

  v_row := public.admin_lock_badge(p_key);

  IF v_row.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'admin:badge_archived: the badge is already archived'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT pg_catalog.count(*)::integer INTO v_active
  FROM public.member_badges AS mb
  JOIN public.members AS m ON m.id = mb.member_id
  WHERE mb.badge_key = p_key
    AND m.left_on IS NULL
    AND m.purged_at IS NULL;

  UPDATE public.badges AS b
  SET archived_at = pg_catalog.clock_timestamp(),
      archived_by = auth.uid(),
      updated_at = pg_catalog.clock_timestamp()
  WHERE b.key = p_key;

  PERFORM public.audit_write(
    'badge.archive',
    NULL,
    pg_catalog.jsonb_build_object('badge', p_key, 'name', v_row.name ->> 'ca', 'active_holders', v_active),
    NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_restore_badge(p_key text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  v_row public.badges;
BEGIN
  PERFORM public.admin_assert_board();

  v_row := public.admin_lock_badge(p_key);

  IF v_row.archived_at IS NULL THEN
    RAISE EXCEPTION 'admin:invalid_argument: the badge is not archived'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.badges AS b
  SET archived_at = NULL,
      archived_by = NULL,
      updated_at = pg_catalog.clock_timestamp()
  WHERE b.key = p_key;

  PERFORM public.audit_write(
    'badge.restore',
    NULL,
    pg_catalog.jsonb_build_object('badge', p_key, 'name', v_row.name ->> 'ca'),
    NULL
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_archive_badge(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_archive_badge(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_restore_badge(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_restore_badge(text) TO authenticated;

-- 10. admin_delete_badge (superadmin) ---------------------------------------------------------------
--    Only for a badge that was never awarded: no member_badges row (purged stubs included) and no
--    badge.award entry in the audit log. Anything else is archived instead. Details:
--    {"badge", "name"}.
CREATE OR REPLACE FUNCTION public.admin_delete_badge(p_key text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  v_row public.badges;
BEGIN
  PERFORM public.admin_assert_superadmin();

  v_row := public.admin_lock_badge(p_key);

  IF EXISTS (SELECT 1 FROM public.member_badges AS mb WHERE mb.badge_key = p_key)
     OR EXISTS (
       SELECT 1
       FROM public.audit_log AS a
       WHERE a.action = 'badge.award'
         AND a.details ->> 'badge' = p_key
     ) THEN
    RAISE EXCEPTION 'admin:badge_in_use: the badge was awarded; archive it instead'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  DELETE FROM public.badges AS b WHERE b.key = p_key;

  PERFORM public.audit_write(
    'badge.delete',
    NULL,
    pg_catalog.jsonb_build_object('badge', p_key, 'name', v_row.name ->> 'ca'),
    NULL
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_badge(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_delete_badge(text) TO authenticated;

-- 11. admin_award_badge / admin_revoke_badge v2 ----------------------------------------------------
--    Same signatures and errors as 20261005100500, plus admin:badge_archived; the details gain the
--    Catalan name. Details: award {"badge", "name"}; revoke {"badge", "name", "awarded_on"}.
CREATE OR REPLACE FUNCTION public.admin_award_badge(
  p_member_id uuid,
  p_badge_key text,
  p_note text DEFAULT NULL
)
  RETURNS timestamptz
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  v_note text := NULLIF(pg_catalog.btrim(p_note), '');
  v_badge public.badges;
  v_row public.members;
  v_awarded_at timestamptz;
BEGIN
  PERFORM public.admin_assert_board();

  v_badge := public.admin_awardable_badge(p_badge_key);

  PERFORM public.admin_assert_reason_length(v_note);

  v_row := public.admin_lock_member(p_member_id);

  IF v_row.left_on IS NOT NULL THEN                                  -- BR-7
    RAISE EXCEPTION 'admin:not_active: a former member''s badges are kept as they are'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  INSERT INTO public.member_badges (member_id, badge_key, awarded_by)
  VALUES (p_member_id, p_badge_key, auth.uid())
  ON CONFLICT (member_id, badge_key) DO NOTHING
  RETURNING awarded_at INTO v_awarded_at;

  IF v_awarded_at IS NULL THEN
    RAISE EXCEPTION 'admin:badge_held: the member already holds this badge'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM public.audit_write(
    'badge.award',
    p_member_id,
    pg_catalog.jsonb_build_object('badge', p_badge_key, 'name', v_badge.name ->> 'ca'),
    v_note
  );

  RETURN v_awarded_at;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_award_badge(uuid, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_award_badge(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_revoke_badge(
  p_member_id uuid,
  p_badge_key text,
  p_reason text DEFAULT NULL
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  v_reason text := NULLIF(pg_catalog.btrim(p_reason), '');
  v_badge public.badges;
  v_row public.members;
  v_awarded_at timestamptz;
BEGIN
  PERFORM public.admin_assert_board();

  v_badge := public.admin_awardable_badge(p_badge_key);

  PERFORM public.admin_assert_reason_length(v_reason);

  v_row := public.admin_lock_member(p_member_id);

  IF v_row.left_on IS NOT NULL THEN                                  -- BR-7
    RAISE EXCEPTION 'admin:not_active: a former member''s badges are kept as they are'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  DELETE FROM public.member_badges
  WHERE member_id = p_member_id
    AND badge_key = p_badge_key
  RETURNING awarded_at INTO v_awarded_at;

  IF v_awarded_at IS NULL THEN
    RAISE EXCEPTION 'admin:badge_not_held: the member does not hold this badge'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM public.audit_write(
    'badge.revoke',
    p_member_id,
    pg_catalog.jsonb_build_object(
      'badge', p_badge_key,
      'name', v_badge.name ->> 'ca',
      'awarded_on', pg_catalog.to_char(v_awarded_at AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD')
    ),
    v_reason
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_revoke_badge(uuid, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_revoke_badge(uuid, text, text) TO authenticated;

-- 12. admin_award_badge_bulk ------------------------------------------------------------------------
--    One badge to 1..100 members in one transaction. Duplicate ids count once. All or nothing: an
--    unknown or purged member (admin:not_found) or a former one (admin:not_active) fails the whole
--    call. Members who already hold the badge are skipped. One badge.award entry per new holder,
--    with the note as reason. Members are locked in id order, so two bulk calls never deadlock.
CREATE OR REPLACE FUNCTION public.admin_award_badge_bulk(
  p_badge_key text,
  p_member_ids uuid[],
  p_note text DEFAULT NULL
)
  RETURNS TABLE (awarded integer, skipped integer)
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
#variable_conflict use_variable
DECLARE
  v_note text := NULLIF(pg_catalog.btrim(p_note), '');
  v_badge public.badges;
  v_ids uuid[];
  v_id uuid;
  v_row public.members;
  v_awarded_at timestamptz;
  v_awarded integer := 0;
  v_skipped integer := 0;
BEGIN
  PERFORM public.admin_assert_board();

  SELECT pg_catalog.array_agg(DISTINCT x ORDER BY x) INTO v_ids
  FROM pg_catalog.unnest(p_member_ids) AS x
  WHERE x IS NOT NULL;

  IF v_ids IS NULL OR pg_catalog.cardinality(v_ids) > 100 THEN
    RAISE EXCEPTION 'admin:invalid_argument: between 1 and 100 members'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_badge := public.admin_awardable_badge(p_badge_key);

  PERFORM public.admin_assert_reason_length(v_note);

  FOREACH v_id IN ARRAY v_ids LOOP
    v_row := public.admin_lock_member(v_id);

    IF v_row.left_on IS NOT NULL THEN                                -- BR-7
      RAISE EXCEPTION 'admin:not_active: a former member cannot get a badge'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    v_awarded_at := NULL;
    INSERT INTO public.member_badges (member_id, badge_key, awarded_by)
    VALUES (v_id, p_badge_key, auth.uid())
    ON CONFLICT (member_id, badge_key) DO NOTHING
    RETURNING member_badges.awarded_at INTO v_awarded_at;

    IF v_awarded_at IS NULL THEN
      v_skipped := v_skipped + 1;
    ELSE
      v_awarded := v_awarded + 1;
      PERFORM public.audit_write(
        'badge.award',
        v_id,
        pg_catalog.jsonb_build_object('badge', p_badge_key, 'name', v_badge.name ->> 'ca'),
        v_note
      );
    END IF;
  END LOOP;

  awarded := v_awarded;
  skipped := v_skipped;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_award_badge_bulk(text, uuid[], text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_award_badge_bulk(text, uuid[], text) TO authenticated;

-- 13. admin_get_member v2 ---------------------------------------------------------------------------
--    Same as 20261005100300 except each badge also carries name ({ca, es?, en?}), icon and
--    archived. The tenure badge "X anys amb Darkstone" is derived by the app from
--    current_joined_on (BR-6) and is not in the list.
CREATE OR REPLACE FUNCTION public.admin_get_member(p_member_number text)
  RETURNS TABLE (
    id uuid,
    member_number text,
    state text,
    first_name text,
    last_name text,
    email text,
    has_login boolean,
    role text,
    role_since timestamptz,
    postal_code text,
    ludoya_username text,
    bgg_username text,
    newsletter_accepted boolean,
    has_dni boolean,
    has_phone boolean,
    membership_start_date date,
    current_joined_on date,
    left_on date,
    left_by text,
    leave_reason text,
    purge_on date,
    anonymised_at timestamptz,
    card_valid boolean,
    card_issued_at timestamptz,
    created_at timestamptz,
    badges jsonb
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
  SELECT
    m.id,
    m.member_number,
    CASE WHEN m.left_on IS NULL THEN 'active' ELSE 'former' END,
    m.first_name,
    m.last_name,
    u.email::text,
    (u.id IS NOT NULL AND u.deleted_at IS NULL),
    m.role,
    m.role_since,
    CASE WHEN m.left_on IS NULL THEN m.postal_code END,
    CASE WHEN m.left_on IS NULL THEN m.ludoya_username END,
    CASE WHEN m.left_on IS NULL THEN m.bgg_username END,
    CASE WHEN m.left_on IS NULL THEN m.newsletter_accepted END,
    (m.dni_nie_encrypted IS NOT NULL),
    CASE WHEN m.left_on IS NULL THEN (m.phone_encrypted IS NOT NULL) END,
    m.membership_start_date,
    m.current_joined_on,
    m.left_on,
    m.left_by,
    m.leave_reason,
    (m.left_on + interval '3 years')::date,
    m.anonymised_at,
    (m.left_on IS NULL),
    m.card_issued_at,
    m.created_at,
    COALESCE(
      (
        SELECT pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'badge_key', b.badge_key,
            'awarded_at', b.awarded_at,
            'awarded_by', b.awarded_by,
            'awarded_by_name',
              CASE WHEN a.id IS NOT NULL AND a.purged_at IS NULL
                THEN pg_catalog.btrim(a.first_name || ' ' || a.last_name) END,
            'name', c.name,
            'icon', c.icon,
            'archived', (c.archived_at IS NOT NULL)
          )
          ORDER BY b.awarded_at, b.badge_key
        )
        FROM public.member_badges AS b
        JOIN public.badges AS c ON c.key = b.badge_key
        LEFT JOIN public.members AS a ON a.id = b.awarded_by
        WHERE b.member_id = m.id
      ),
      '[]'::jsonb
    )
  FROM public.members AS m
  LEFT JOIN auth.users AS u ON u.id = m.id
  WHERE m.member_number = p_member_number
    AND m.purged_at IS NULL
    AND (u.id IS NULL OR u.email_confirmed_at IS NOT NULL);          -- BR-22
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_get_member(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_get_member(text) TO authenticated;

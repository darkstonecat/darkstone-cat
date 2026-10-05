-- Migration M6: the board's member mutations (admin panel spec A-4, A-5, A-8, A-9; BR-4, BR-7,
-- BR-13, BR-15, BR-16, BR-20, BR-21) and a sharper BR-15 detector.
--
-- Functions, each one transaction that changes data (or reads a secret) and writes exactly one
-- audit entry through audit_write() (M3):
--   admin_update_member(p_member_id, p_patch)                  A-4  member.update
--   admin_reveal_sensitive(p_member_id, p_field, p_reason)     A-5  member.reveal_sensitive
--   admin_award_badge(p_member_id, p_badge_key, p_note)        A-8  badge.award
--   admin_revoke_badge(p_member_id, p_badge_key, p_reason)     A-8  badge.revoke
--   regenerate_card_token(target_member_id)                    A-9  card.regenerate (v2, same
--                                                                   signature and return value)
-- Server actions (T11a) call them with the user's session client. DNI and phone are encrypted
-- in the app (src/lib/encryption.ts), so these functions only ever see ciphertext.
--
-- Who may call them: board, superadmin and the legacy admin (admin_assert_board(), M4), with
-- an active membership. Targets: a confirmed, not purged member (BR-22); anything else is
-- "not found". Only ACTIVE targets can be edited, get or lose badges, or get a new card: a
-- former member's register is read-only (spec V-3), their badges are kept as they were (BR-7)
-- and their card is invalid until the return, which issues a new one (BR-4). The reveal is the
-- only one that reaches a former member, and only for a superadmin, only the DNI, and only with
-- a reason (BR-21).
--
-- A-4 rules (the same as the member's own profile edit, src/lib/profile/actions.ts and
-- src/lib/validation/member-fields.ts; the server action validates first, this is the backstop):
--   p_patch is a JSON object with any subset of these keys, nothing else:
--     first_name, last_name      string, trimmed, 1..100 (never null)
--     postal_code                string of 5 digits, or null/"" to clear
--     ludoya_username,
--     bgg_username               trimmed, leading "@" dropped, letters/digits/_ . - and inner
--                                spaces, 1..64; null/"" to clear
--     phone_encrypted,
--     dni_nie_encrypted          ciphertext "iv:tag:data" (base64, 12-byte IV, 16-byte tag,
--                                <= 512 chars), or null to clear. A plain DNI/phone is refused.
--   Not editable: e-mail (BR-13), member number, role, card token, membership dates and state,
--   newsletter consent (the member's own choice; A-4 does not list it).
--   Returns the names of the fields that changed (sorted). A patch that changes nothing
--   (empty, or every value equal to the stored one) changes nothing and writes NO audit entry.
--   A new ciphertext always differs from the stored one (random IV), so the action sends the
--   encrypted fields only when the plain value changed.
--   Audit details: {"fields": [...], "changes": {"first_name": {"from", "to"}, ...}}. Field
--   names are first_name, last_name, postal_code, ludoya_username, bgg_username, phone, dni.
--   Before/after values only for the names (spec §5.2 "normal fields"); never for DNI/phone
--   (BR-15) nor for postal code and usernames, which are deleted on leave (BR-20) and so must
--   not survive in V-3 "Activitat".
--
-- A-5: the audit entry is written BEFORE the value is returned, in the same transaction, so a
--   reveal is on record whatever the caller does with the ciphertext (fail closed). Active
--   member: board, reason optional. Former member: superadmin only, DNI only (the phone is
--   deleted on leave), reason of at least admin_reveal_reason_min_length() = 10 characters
--   after trim (D-E, provisional). Reason at most 500. A field with no stored value returns
--   admin:no_value and logs nothing (nothing was revealed). member.reveal_sensitive leaves the
--   log_admin_event() whitelist (T3 follow-up): the reveal can only be logged by revealing.
--
-- A-8: the catalogue is admin_badge_keys() = the member_badges CHECK ('volunteer_egara_joga',
--   'ludoteca_donor'). "Membre {year}" is derived from the primera alta (BR-6) and never stored,
--   so it cannot be awarded or revoked. Not idempotent on purpose: awarding a badge the member
--   holds is admin:badge_held, revoking one they lack is admin:badge_not_held, and neither
--   writes an entry (a stale screen learns its state was out of date; no empty audit entries).
--   awarded_by = the caller. Award note and revoke reason go to the audit reason, at most 500.
--   Details: badge.award {"badge": key}; badge.revoke {"badge": key, "awarded_on": "YYYY-MM-DD"}.
--
-- A-9: board only (the spec has no member self-service), active members only. New token and
--   card_issued_at = now() (the "last regeneration" date of V-3, T1 follow-up). Details {} (the
--   token is a credential and never logged). The old token stops verifying at once.
--
-- BR-15, audit_details_leak() v2 (keeps its signature; still backs the audit_log CHECK and the
-- check in audit_write()). An entry leaks when, at any depth:
--   1. an object KEY, lower-cased with accents folded and "_", "-", " " removed, is one of
--      dni, nie, nif, dninie, dniencrypted, dninieencrypted, phone, phonenumber,
--      phoneencrypted, telefon, telefono, telephone, telefonnumber, mobile, mobil, movil,
--      mobilephone (covers dni_nie, dniNie, DNI-NIE, Teléfono, Móvil, Phone_Encrypted, ...);
--   2. a STRING value, after trimming whitespace (also newlines/tabs) and dropping one leading
--      label (dni, nie, nif, tel, telf, telefon, telèfon, telefono, teléfono, phone, mobile,
--      mobil, mòbil, movil, móvil, then an optional ":" "." "#"), and with the separators
--      space . - / ( ) removed ("compact"), is
--        a DNI          ^[0-9]{8}[A-Za-z]$            12.345.678-Z, DNI 12345678Z
--        a NIE          ^[XYZxyz][0-9]{7}[A-Za-z]$    X-1234567-L
--        a phone with + ^\+[0-9]{9,15}$               +34 612 345 678, (+34) 612345678, +44 ...
--        a Spanish phone ^(0034|34)?[6-9][0-9]{8}$    612345678, 612/345/678, tel: 912 34 56 78
--   3. a NUMBER value whose integer text matches the Spanish phone rule (612345678, 34612345678).
-- Not a leak: 9..15 digit ids and counts that are not Spanish-phone shaped (123456789,
-- 123456789012, 512345678), member numbers (000-123), dates and timestamps, UUIDs, card tokens,
-- 8-digit numbers. Accepted residuals: a 9-digit id that starts with 6-9 (or 11 digits starting
-- 346..349) IS treated as a phone and makes the write fail with audit:sensitive_details; send
-- such ids under a key the renderer knows and prefer UUIDs. A DNI/phone inside a longer
-- sentence is not detected: details hold structured values, and the free-text reason column is
-- not scanned (the app must keep DNI/phone values out of it).
-- Replacing the function does not re-check existing rows (a CHECK is only evaluated on write,
-- and audit_log rows are never updated). Locally only test rows exist; prod has no rows yet.
--
-- Errors (the message starts with a stable prefix the app maps to a translated text):
--   admin:forbidden          42501  caller is not an active board member or higher; a board
--                                   member revealing a former member's DNI (superadmin only)
--   admin:not_found          22023  unknown member, purged stub, or a sign-up never confirmed
--   admin:not_active         22023  the target is a former member (edit, badges, card)
--   admin:invalid_argument   22023  patch not an object, a key outside the A-4 whitelist, a
--                                   reveal field other than dni/phone (or phone of a former
--                                   member), a badge key outside the catalogue
--   admin:invalid_value      22023  a patch value fails validation; the message continues with
--                                   the patch key: "admin:invalid_value: postal_code ..."
--   admin:no_value           22023  reveal of a field with no stored value
--   admin:reason_required    22023  former member's DNI reveal with a reason under 10 after trim
--   admin:reason_too_long    22023  reveal reason, badge note or revoke reason over 500
--   admin:badge_held         22023  award of a badge the member already holds
--   admin:badge_not_held     22023  revoke of a badge the member does not hold
--   audit:sensitive_details  23514  (from audit_write) a name shaped like a DNI/phone, BR-15
-- regenerate_card_token used to raise 'Unauthorized: admin role required' / 'Member not found';
-- it now uses admin:forbidden / admin:not_found like the others (nothing in src/ calls it yet).
-- anon and service_role have no EXECUTE on any of them (Postgres "permission denied", 42501):
-- they need the caller's JWT subject. READ COMMITTED (the default), never REPEATABLE READ.
--
-- Needs M1–M5. Safe to apply to production before the code that uses it: nothing in src/ calls
-- these functions; log_admin_event() loses member.reveal_sensitive, which no shipped code logs;
-- the narrower detector only lets more harmless values through, and catches more leaks.

-- 1. Constants and internal helpers -------------------------------------------------------------
--    No API role can execute them; the functions below call them with owner privileges.

--    D-E (provisional): minimum length of the reason for revealing a former member's DNI.
CREATE OR REPLACE FUNCTION public.admin_reveal_reason_min_length()
  RETURNS integer
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  SELECT 10;
$$;

--    Maximum length of a reveal reason, a badge note and a badge revoke reason (the audit
--    reason column allows 1000; 500 matches the membership reasons of M5).
CREATE OR REPLACE FUNCTION public.admin_reason_max_length()
  RETURNS integer
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  SELECT 500;
$$;

--    The badges the board can award by hand: the member_badges.badge_key CHECK. "Membre {year}"
--    is derived, never stored (BR-6). A new badge type means a migration that widens both.
CREATE OR REPLACE FUNCTION public.admin_badge_keys()
  RETURNS text[]
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  SELECT ARRAY['volunteer_egara_joga', 'ludoteca_donor']::text[];
$$;

--    Locks and returns a member the board may act on: confirmed (BR-22) and not purged. Login
--    account optional (a former member's account may be gone). Raises admin:not_found.
CREATE OR REPLACE FUNCTION public.admin_lock_member(p_member_id uuid)
  RETURNS public.members
  LANGUAGE plpgsql
  SET search_path TO ''
AS $$
DECLARE
  v_row public.members;
BEGIN
  SELECT m.* INTO v_row
  FROM public.members AS m
  LEFT JOIN auth.users AS u ON u.id = m.id
  WHERE m.id = p_member_id
    AND m.purged_at IS NULL
    AND (u.id IS NULL OR u.email_confirmed_at IS NOT NULL)            -- BR-22
  FOR UPDATE OF m;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin:not_found: unknown member'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN v_row;
END;
$$;

--    Raises admin:reason_too_long when a trimmed reason/note is over the limit.
CREATE OR REPLACE FUNCTION public.admin_assert_reason_length(p_reason text)
  RETURNS void
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO ''
AS $$
BEGIN
  IF pg_catalog.char_length(pg_catalog.btrim(p_reason)) > public.admin_reason_max_length() THEN
    RAISE EXCEPTION 'admin:reason_too_long: at most % characters', public.admin_reason_max_length()
      USING ERRCODE = 'invalid_parameter_value';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reveal_reason_min_length() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_reason_max_length() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_badge_keys() FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_lock_member(uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_assert_reason_length(text) FROM PUBLIC, anon, authenticated, service_role;

-- 2. BR-15 detector v2 --------------------------------------------------------------------------
--    One scalar value (the text of a JSON string or number). Pure, so it can back the CHECK.
CREATE OR REPLACE FUNCTION public.audit_value_is_sensitive(p_value text)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  WITH trimmed AS (
    SELECT pg_catalog.regexp_replace(COALESCE(p_value, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g') AS v
  ), unlabelled AS (
    SELECT pg_catalog.regexp_replace(
      t.v,
      '^(telefono|teléfono|telefon|telèfon|telf|tel|phone|mobile|mòbil|mobil|móvil|movil|dni|nie|nif)[[:space:]]*[:.#]?[[:space:]]*',
      '',
      'i'
    ) AS v
    FROM trimmed AS t
  ), compact AS (
    SELECT pg_catalog.regexp_replace(u.v, '[[:space:].()/-]', '', 'g') AS v
    FROM unlabelled AS u
  )
  SELECT c.v ~ '^[0-9]{8}[A-Za-z]$'                 -- DNI
      OR c.v ~ '^[XYZxyz][0-9]{7}[A-Za-z]$'         -- NIE
      OR c.v ~ '^\+[0-9]{9,15}$'                    -- any phone written with +
      OR c.v ~ '^(0034|34)?[6-9][0-9]{8}$'          -- Spanish phone
  FROM compact AS c;
$$;

REVOKE EXECUTE ON FUNCTION public.audit_value_is_sensitive(text) FROM PUBLIC, anon, authenticated, service_role;

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
          WHERE pg_catalog.translate(
                  pg_catalog.regexp_replace(pg_catalog.lower(k.name), '[_ -]', '', 'g'),
                  'àáèéíìòóúùïüç',
                  'aaeeiioouuiuc'
                ) IN (
            'dni', 'nie', 'nif', 'dninie', 'dniencrypted', 'dninieencrypted',
            'phone', 'phonenumber', 'phoneencrypted',
            'telefon', 'telefono', 'telephone', 'telefonnumber',
            'mobile', 'mobil', 'movil', 'mobilephone'
          )
        )
      )
      OR (
        pg_catalog.jsonb_typeof(item.v) = 'string'
        AND public.audit_value_is_sensitive(item.v #>> '{}')
      )
      OR (
        pg_catalog.jsonb_typeof(item.v) = 'number'
        AND (item.v #>> '{}') ~ '^(34)?[6-9][0-9]{8}$'
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.audit_details_leak(jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- 3. admin_update_member (A-4) ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_member(p_member_id uuid, p_patch jsonb)
  RETURNS text[]
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  -- patch key -> audit field name
  c_keys constant text[] := ARRAY[
    'first_name', 'last_name', 'postal_code', 'ludoya_username', 'bgg_username',
    'phone_encrypted', 'dni_nie_encrypted'
  ];
  c_cipher constant text := '^[A-Za-z0-9+/]{16}:[A-Za-z0-9+/]{22}==:[A-Za-z0-9+/]+={0,2}$';
  v_key text;
  v_value jsonb;
  v_text text;
  v_row public.members;
  v_first_name text;
  v_last_name text;
  v_postal_code text;
  v_ludoya text;
  v_bgg text;
  v_phone text;
  v_dni text;
  v_fields text[] := ARRAY[]::text[];
  v_changes jsonb := '{}'::jsonb;
BEGIN
  PERFORM public.admin_assert_board();

  IF p_patch IS NULL OR pg_catalog.jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'admin:invalid_argument: the patch must be a JSON object'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  FOR v_key IN SELECT k FROM pg_catalog.jsonb_object_keys(p_patch) AS k LOOP
    IF NOT (v_key = ANY (c_keys)) THEN
      RAISE EXCEPTION 'admin:invalid_argument: % cannot be edited', v_key
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END LOOP;

  v_row := public.admin_lock_member(p_member_id);

  IF v_row.left_on IS NOT NULL THEN
    RAISE EXCEPTION 'admin:not_active: a former member''s register is read-only'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  v_first_name := v_row.first_name;
  v_last_name := v_row.last_name;
  v_postal_code := v_row.postal_code;
  v_ludoya := v_row.ludoya_username;
  v_bgg := v_row.bgg_username;
  v_phone := v_row.phone_encrypted;
  v_dni := v_row.dni_nie_encrypted;

  FOR v_key, v_value IN SELECT e.key, e.value FROM pg_catalog.jsonb_each(p_patch) AS e LOOP
    IF pg_catalog.jsonb_typeof(v_value) NOT IN ('string', 'null') THEN
      RAISE EXCEPTION 'admin:invalid_value: % must be a string or null', v_key
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    -- trimmed text, NULL for JSON null or a blank string
    v_text := NULLIF(pg_catalog.btrim(v_value #>> '{}', E' \t\r\n'), '');

    IF v_key IN ('first_name', 'last_name') THEN
      IF v_text IS NULL OR pg_catalog.char_length(v_text) > 100 THEN
        RAISE EXCEPTION 'admin:invalid_value: % must have 1 to 100 characters', v_key
          USING ERRCODE = 'invalid_parameter_value';
      END IF;
      IF v_key = 'first_name' THEN v_first_name := v_text; ELSE v_last_name := v_text; END IF;

    ELSIF v_key = 'postal_code' THEN
      IF v_text IS NOT NULL AND v_text !~ '^[0-9]{5}$' THEN
        RAISE EXCEPTION 'admin:invalid_value: postal_code must have 5 digits'
          USING ERRCODE = 'invalid_parameter_value';
      END IF;
      v_postal_code := v_text;

    ELSIF v_key IN ('ludoya_username', 'bgg_username') THEN
      -- normalizeUsername(): trim, drop leading "@", trim again
      v_text := NULLIF(pg_catalog.btrim(pg_catalog.regexp_replace(COALESCE(v_text, ''), '^@+', '')), '');
      IF v_text IS NOT NULL AND v_text !~ '^[[:alnum:]_. -]{1,64}$' THEN
        RAISE EXCEPTION 'admin:invalid_value: % is not a valid username', v_key
          USING ERRCODE = 'invalid_parameter_value';
      END IF;
      IF v_key = 'ludoya_username' THEN v_ludoya := v_text; ELSE v_bgg := v_text; END IF;

    ELSE -- phone_encrypted, dni_nie_encrypted: ciphertext only, never trimmed
      v_text := v_value #>> '{}';
      IF v_text IS NOT NULL AND (pg_catalog.char_length(v_text) > 512 OR v_text !~ c_cipher) THEN
        RAISE EXCEPTION 'admin:invalid_value: % must be ciphertext (iv:tag:data)', v_key
          USING ERRCODE = 'invalid_parameter_value';
      END IF;
      IF v_key = 'phone_encrypted' THEN v_phone := v_text; ELSE v_dni := v_text; END IF;
    END IF;
  END LOOP;

  -- Changed fields, alphabetical by audit name
  IF v_bgg IS DISTINCT FROM v_row.bgg_username THEN v_fields := v_fields || 'bgg_username'::text; END IF;
  IF v_dni IS DISTINCT FROM v_row.dni_nie_encrypted THEN v_fields := v_fields || 'dni'::text; END IF;
  IF v_first_name IS DISTINCT FROM v_row.first_name THEN
    v_fields := v_fields || 'first_name'::text;
    v_changes := v_changes || pg_catalog.jsonb_build_object(
      'first_name', pg_catalog.jsonb_build_object('from', v_row.first_name, 'to', v_first_name));
  END IF;
  IF v_last_name IS DISTINCT FROM v_row.last_name THEN
    v_fields := v_fields || 'last_name'::text;
    v_changes := v_changes || pg_catalog.jsonb_build_object(
      'last_name', pg_catalog.jsonb_build_object('from', v_row.last_name, 'to', v_last_name));
  END IF;
  IF v_ludoya IS DISTINCT FROM v_row.ludoya_username THEN v_fields := v_fields || 'ludoya_username'::text; END IF;
  IF v_phone IS DISTINCT FROM v_row.phone_encrypted THEN v_fields := v_fields || 'phone'::text; END IF;
  IF v_postal_code IS DISTINCT FROM v_row.postal_code THEN v_fields := v_fields || 'postal_code'::text; END IF;

  IF pg_catalog.cardinality(v_fields) = 0 THEN
    RETURN v_fields;   -- nothing changed: no UPDATE, no audit entry
  END IF;

  UPDATE public.members
  SET first_name = v_first_name,
      last_name = v_last_name,
      postal_code = v_postal_code,
      ludoya_username = v_ludoya,
      bgg_username = v_bgg,
      phone_encrypted = v_phone,
      dni_nie_encrypted = v_dni
  WHERE id = p_member_id;

  PERFORM public.audit_write(
    'member.update',
    p_member_id,
    CASE WHEN v_changes = '{}'::jsonb
      THEN pg_catalog.jsonb_build_object('fields', pg_catalog.to_jsonb(v_fields))
      ELSE pg_catalog.jsonb_build_object('fields', pg_catalog.to_jsonb(v_fields), 'changes', v_changes)
    END,
    NULL
  );

  RETURN v_fields;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_update_member(uuid, jsonb) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_member(uuid, jsonb) TO authenticated;

-- 4. admin_reveal_sensitive (A-5) ---------------------------------------------------------------
--    Returns the stored ciphertext; the server action decrypts it and shows it on that screen
--    only. The audit entry is written first.
CREATE OR REPLACE FUNCTION public.admin_reveal_sensitive(
  p_member_id uuid,
  p_field text,
  p_reason text DEFAULT NULL
)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  v_reason text := NULLIF(pg_catalog.btrim(p_reason), '');
  v_row public.members;
  v_value text;
BEGIN
  PERFORM public.admin_assert_board();

  IF p_field IS NULL OR p_field NOT IN ('dni', 'phone') THEN
    RAISE EXCEPTION 'admin:invalid_argument: the field is dni or phone'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM public.admin_assert_reason_length(v_reason);

  -- FOR UPDATE through the shared lookup: a concurrent leave cannot slip between the state
  -- check and the read.
  v_row := public.admin_lock_member(p_member_id);

  IF v_row.left_on IS NOT NULL THEN                                  -- BR-21
    IF NOT public.has_role('superadmin') THEN
      RAISE EXCEPTION 'admin:forbidden: only a superadmin can reveal a former member''s DNI'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF p_field <> 'dni' THEN
      RAISE EXCEPTION 'admin:invalid_argument: a former member has no phone to reveal'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF v_reason IS NULL OR pg_catalog.char_length(v_reason) < public.admin_reveal_reason_min_length() THEN
      RAISE EXCEPTION 'admin:reason_required: revealing a former member''s DNI needs a reason of at least % characters',
        public.admin_reveal_reason_min_length()
        USING ERRCODE = 'invalid_parameter_value';
    END IF;
  END IF;

  v_value := CASE p_field WHEN 'dni' THEN v_row.dni_nie_encrypted ELSE v_row.phone_encrypted END;

  IF v_value IS NULL THEN
    RAISE EXCEPTION 'admin:no_value: nothing stored for %', p_field
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  PERFORM public.audit_write(
    'member.reveal_sensitive',
    p_member_id,
    pg_catalog.jsonb_build_object('field', p_field),
    v_reason
  );

  RETURN v_value;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_reveal_sensitive(uuid, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_reveal_sensitive(uuid, text, text) TO authenticated;

-- 5. Badges (A-8) -------------------------------------------------------------------------------
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
  v_row public.members;
  v_awarded_at timestamptz;
BEGIN
  PERFORM public.admin_assert_board();

  IF p_badge_key IS NULL OR NOT (p_badge_key = ANY (public.admin_badge_keys())) THEN
    RAISE EXCEPTION 'admin:invalid_argument: unknown badge'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

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
    pg_catalog.jsonb_build_object('badge', p_badge_key),
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
  v_row public.members;
  v_awarded_at timestamptz;
BEGIN
  PERFORM public.admin_assert_board();

  IF p_badge_key IS NULL OR NOT (p_badge_key = ANY (public.admin_badge_keys())) THEN
    RAISE EXCEPTION 'admin:invalid_argument: unknown badge'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

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
      'awarded_on', pg_catalog.to_char(v_awarded_at AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD')
    ),
    v_reason
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_revoke_badge(uuid, text, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_revoke_badge(uuid, text, text) TO authenticated;

-- 6. regenerate_card_token v2 (A-9) -------------------------------------------------------------
--    Same signature and return value (the new token) as before; now board+ on an active
--    member, stamps card_issued_at and writes card.regenerate.
CREATE OR REPLACE FUNCTION public.regenerate_card_token(target_member_id uuid)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  v_row public.members;
  v_token text := public.generate_card_token();
BEGIN
  PERFORM public.admin_assert_board();

  v_row := public.admin_lock_member(target_member_id);

  IF v_row.left_on IS NOT NULL THEN                                  -- BR-4
    RAISE EXCEPTION 'admin:not_active: a former member gets a new card on return'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.members
  SET card_token = v_token,
      card_issued_at = pg_catalog.now()
  WHERE id = target_member_id;

  PERFORM public.audit_write('card.regenerate', target_member_id, '{}'::jsonb, NULL);

  RETURN v_token;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.regenerate_card_token(uuid) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.regenerate_card_token(uuid) TO authenticated;

-- 7. log_admin_event without member.reveal_sensitive --------------------------------------------
--    Same signature, grants and body as in 20261005100200_audit_log.sql, minus the reveal: it
--    is logged only by admin_reveal_sensitive() above, which returns the value only after the
--    entry is written. Target rules now:
--      export.member_data, member.send_access_link  need a member that is not purged; the
--        access link only for an active member (A-15);
--      export.members_csv, export.member_register, export.emails, ops.cache_refresh  none.
--    A-11 on a former member stays open to board (D-D).
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
    'member.send_access_link', 'ops.cache_refresh'
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

  IF p_action IN ('export.member_data', 'member.send_access_link') THEN
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

  RETURN public.audit_write(p_action, p_target, entry_details, p_reason);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_admin_event(text, uuid, jsonb, text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.log_admin_event(text, uuid, jsonb, text) TO authenticated;

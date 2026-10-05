-- Migration: lock down member secrets (admin panel T7b, correction from the T7 verification).
--
-- Defect: any board session could read every member's dni_nie_encrypted/phone_encrypted
-- through PostgREST (policy admins_select_all, USING is_admin()) and through
-- get_all_members_for_admin() (EXECUTE for authenticated). AES-GCM had no AAD, so a ciphertext
-- copied into the caller's own row (members_update_own grants those columns) decrypted on
-- /profile/edit: any member's DNI, with no audit entry (breaks A-5, BR-16, BR-21).
--
-- 1. RLS: drop admins_select_all (members) and member_badges_admins_select_all. Every
--    session-client read in src/ is own-row only (.eq("id", user.id) / .eq("member_id",
--    user.id)); board screens read through SECURITY DEFINER functions (admin_* from T5-T8) or,
--    until T27, get_all_members_for_admin() through the service role. members_select_own and
--    member_badges_select_own stay.
-- 2. get_all_members_for_admin(): EXECUTE for service_role only (revoked from PUBLIC, anon,
--    authenticated). Its old has_role('board') guard is always false for the service role, so
--    the guard now requires the service-role JWT (auth.role() = 'service_role'): even the owner
--    role without that claim is refused. The callers (/admin, /admin/members, the CSV export)
--    check requireRole/getAdminAccess('board') first and then call it with the admin client.
--    Same body otherwise; it goes away in T27.
-- 3. TRUNCATE on members and member_badges revoked from service_role (and anon/authenticated):
--    TRUNCATE skips row-level triggers, so it bypassed members_role_delete_guard (T8 verification).
-- 4. Ciphertext bound to its row. src/lib/encryption.ts now writes
--    "v2:<member uuid>:<iv>:<tag>:<data>" (AES-256-GCM, AAD "member:<uuid>"). The trigger
--    members_ciphertext_guard refuses, for every role, an INSERT or an UPDATE that changes
--    dni_nie_encrypted/phone_encrypted (or id) to anything but NULL or v2 ciphertext naming the
--    row's own id. So a ciphertext copied from another row is refused on write, and rewriting
--    its owner breaks the GCM tag. Legacy "iv:tag:data" values already stored stay readable
--    (the app keeps a decrypt fallback until scripts/reencrypt-member-secrets.mjs ran on prod)
--    and rows holding them can still update other columns; a NEW legacy value is refused.
--    admin_update_member() checks the same rule (its old iv:tag:data shape check is replaced).
-- 5. BR-15 detector v3 (audit_value_is_sensitive / audit_details_leak, same signatures; still
--    the audit_log CHECK and the audit_write() guard). Changes from v2:
--      - values: accents folded and lower-cased first; leading labels are stripped repeatedly
--        (telefono, telephone, telefon, telf, tfno, tlf, tel, phone, mobile, mobil, movil, dni,
--        nie, nif, with dotted forms d.n.i, n.i.e, n.i.f), each followed by any run of
--        characters outside [0-9a-z+]; then EVERY character outside [0-9a-z+] is removed
--        before matching (catches "Telf.: 93 123 45 67", "DNI/NIE: X1234567L",
--        "N.I.E. X1234567L", "12,345,678Z", "612_345_678");
--      - JSON numbers: the Spanish phone rule is tried on all the digits and on the integer
--        part (612345678.0, 612345678.25, 61234567.8, -612345678);
--      - keys: every non-alphanumeric character is removed after folding, and phoneno,
--        mobilenumber, telephonenumber, mobilephonenumber, tel, telf, dninif join the list
--        ("DNI/NIE", "phone_no", "mobile_number", "Tel.").
--    False-positive policy unchanged: member numbers, dates, timestamps, UUIDs, card tokens,
--    counts and 9..15 digit ids that are not Spanish-phone shaped pass. Residuals: a 9-digit id
--    starting 6-9 is treated as a phone (as in v2), and now also an amount whose digits, once
--    separators are dropped, form one (e.g. "6.123.456,78"); a value inside a longer sentence is
--    still not detected, and the free-text reason column is not scanned.
--
-- Errors: members:ciphertext_unbound: <column> (23514) from the trigger;
--   admin:invalid_value: <key> must be ciphertext bound to the member (22023) from
--   admin_update_member(); 'Unauthorized: service role required' (42501) from
--   get_all_members_for_admin() without the service-role JWT.
--
-- Needs M1-M7. Prod order: apply this migration, deploy the code (it writes v2 and decrypts
-- both formats), then run scripts/reencrypt-member-secrets.mjs (--dry-run, then --apply). The
-- code before this task keeps working for reads of legacy values, but its sign-up/profile
-- writes (legacy format) are refused by the trigger, so deploy right after applying.

-- 1. RLS ----------------------------------------------------------------------------------------
DROP POLICY IF EXISTS admins_select_all ON public.members;
DROP POLICY IF EXISTS member_badges_admins_select_all ON public.member_badges;

-- 2. get_all_members_for_admin(): service role only ----------------------------------------------
CREATE OR REPLACE FUNCTION public.get_all_members_for_admin()
  RETURNS SETOF admin_member_view
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
BEGIN
  -- Only the service role holds EXECUTE; this also refuses the owner role without that JWT.
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: service role required'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
    SELECT m.id, m.member_number, m.first_name, m.last_name,
           u.email::text, m.dni_nie_encrypted, m.phone_encrypted,
           m.postal_code, m.ludoya_username, m.bgg_username, m.role,
           m.newsletter_accepted, m.membership_start_date,
           m.created_at
    FROM public.members m
    JOIN auth.users u ON u.id = m.id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_all_members_for_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_all_members_for_admin() TO service_role;

-- 3. TRUNCATE --------------------------------------------------------------------------------------
REVOKE TRUNCATE ON public.members, public.member_badges FROM service_role, anon, authenticated;

-- 4. Ciphertext bound to its row ---------------------------------------------------------------------
--    NULL, or "v2:<p_member_id>:<iv 12 bytes>:<tag 16 bytes>:<data>" (base64). The length limit
--    stays with the CHECKs members_*_encrypted_length (512).
CREATE OR REPLACE FUNCTION public.member_ciphertext_is_bound(p_value text, p_member_id uuid)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  SELECT p_value IS NULL
      OR (
        p_member_id IS NOT NULL
        AND p_value ~ ('^v2:' || p_member_id::text
                       || ':[A-Za-z0-9+/]{16}:[A-Za-z0-9+/]{22}==:[A-Za-z0-9+/]+={0,2}$')
      );
$$;

REVOKE EXECUTE ON FUNCTION public.member_ciphertext_is_bound(text, uuid) FROM PUBLIC, anon, authenticated, service_role;

-- SECURITY DEFINER so the helper above needs no grant to the writing role.
CREATE OR REPLACE FUNCTION public.members_ciphertext_guard()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
BEGIN
  IF (TG_OP = 'INSERT'
      OR NEW.dni_nie_encrypted IS DISTINCT FROM OLD.dni_nie_encrypted
      OR NEW.id IS DISTINCT FROM OLD.id)
     AND NOT public.member_ciphertext_is_bound(NEW.dni_nie_encrypted, NEW.id) THEN
    RAISE EXCEPTION 'members:ciphertext_unbound: dni_nie_encrypted must be v2 ciphertext bound to its row'
      USING ERRCODE = 'check_violation';
  END IF;

  IF (TG_OP = 'INSERT'
      OR NEW.phone_encrypted IS DISTINCT FROM OLD.phone_encrypted
      OR NEW.id IS DISTINCT FROM OLD.id)
     AND NOT public.member_ciphertext_is_bound(NEW.phone_encrypted, NEW.id) THEN
    RAISE EXCEPTION 'members:ciphertext_unbound: phone_encrypted must be v2 ciphertext bound to its row'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.members_ciphertext_guard() FROM PUBLIC, anon, authenticated, service_role;

CREATE TRIGGER members_ciphertext_guard
  BEFORE INSERT OR UPDATE OF dni_nie_encrypted, phone_encrypted, id ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.members_ciphertext_guard();

-- 5. BR-15 detector v3 -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.audit_value_is_sensitive(p_value text)
  RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  WITH folded AS (
    -- Both cases listed, so the folding does not depend on the database locale.
    SELECT pg_catalog.translate(
      pg_catalog.lower(COALESCE(p_value, '')),
      'àáâäèéêëìíîïòóôöùúûüçñÀÁÂÄÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜÇÑ',
      'aaaaeeeeiiiioooouuuucnaaaaeeeeiiiioooouuuucn'
    ) AS v
  ), unlabelled AS (
    SELECT pg_catalog.regexp_replace(
      f.v,
      '^[^0-9a-z+]*((telefono|telephone|telefon|telf|tfno|tlf|tel|phone|mobile|mobil|movil|d\.?n\.?i|n\.?i\.?e|n\.?i\.?f)[^0-9a-z+]*)+',
      ''
    ) AS v
    FROM folded AS f
  ), compact AS (
    SELECT pg_catalog.regexp_replace(u.v, '[^0-9a-z+]', '', 'g') AS v
    FROM unlabelled AS u
  )
  SELECT c.v ~ '^[0-9]{8}[a-z]$'                    -- DNI
      OR c.v ~ '^[xyz][0-9]{7}[a-z]$'               -- NIE
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
          WHERE pg_catalog.regexp_replace(
                  pg_catalog.translate(
                    pg_catalog.lower(k.name),
                    'àáâäèéêëìíîïòóôöùúûüçñÀÁÂÄÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜÇÑ',
                    'aaaaeeeeiiiioooouuuucnaaaaeeeeiiiioooouuuucn'
                  ),
                  '[^0-9a-z]', '', 'g'
                ) IN (
            'dni', 'nie', 'nif', 'dninie', 'dninif', 'dniencrypted', 'dninieencrypted',
            'phone', 'phoneno', 'phonenumber', 'phoneencrypted',
            'tel', 'telf', 'telefon', 'telefono', 'telephone', 'telephonenumber', 'telefonnumber',
            'mobile', 'mobil', 'movil', 'mobilephone', 'mobilenumber', 'mobilephonenumber'
          )
        )
      )
      OR (
        pg_catalog.jsonb_typeof(item.v) = 'string'
        AND public.audit_value_is_sensitive(item.v #>> '{}')
      )
      OR (
        pg_catalog.jsonb_typeof(item.v) = 'number'
        AND (
          pg_catalog.regexp_replace(item.v #>> '{}', '[^0-9]', '', 'g') ~ '^(34)?[6-9][0-9]{8}$'
          OR pg_catalog.regexp_replace(pg_catalog.split_part(item.v #>> '{}', '.', 1), '[^0-9]', '', 'g')
             ~ '^(34)?[6-9][0-9]{8}$'
        )
      )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.audit_details_leak(jsonb) FROM PUBLIC, anon, authenticated, service_role;

-- 6. admin_update_member (A-4): ciphertext must be v2 bound to the target ----------------------------
--    Same body as 20261005100500_member_admin_mutations.sql; only the ciphertext check changes.
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

    ELSE -- phone_encrypted, dni_nie_encrypted: v2 ciphertext bound to the target, never trimmed
      v_text := v_value #>> '{}';
      IF pg_catalog.char_length(v_text) > 512 OR NOT public.member_ciphertext_is_bound(v_text, p_member_id) THEN
        RAISE EXCEPTION 'admin:invalid_value: % must be ciphertext bound to the member (v2:<id>:iv:tag:data)', v_key
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

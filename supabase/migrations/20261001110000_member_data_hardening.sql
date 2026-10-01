-- Migration: member data hardening (security audit D-2, D-5).
--
-- D-2: members can write their own row through the members_update_own policy, with no size
-- limit at the database. Add length-only CHECK constraints that match the app limits.
-- NOT VALID: the constraint applies to every new INSERT/UPDATE but existing rows are not
-- scanned, so legacy production data can never make this migration fail. (A legacy row that
-- exceeds a limit must be shortened the next time that row is updated.)
-- dni_nie_encrypted and phone_encrypted hold "iv:tag:data" in base64 (about 70 characters
-- for the longest valid value); 512 is generous and only blocks abuse.
ALTER TABLE public.members
  ADD CONSTRAINT members_first_name_length CHECK (char_length(first_name) <= 100) NOT VALID,
  ADD CONSTRAINT members_last_name_length CHECK (char_length(last_name) <= 100) NOT VALID,
  ADD CONSTRAINT members_postal_code_length CHECK (char_length(postal_code) <= 10) NOT VALID,
  ADD CONSTRAINT members_ludoya_username_length CHECK (char_length(ludoya_username) <= 64) NOT VALID,
  ADD CONSTRAINT members_bgg_username_length CHECK (char_length(bgg_username) <= 64) NOT VALID,
  ADD CONSTRAINT members_dni_nie_encrypted_length CHECK (char_length(dni_nie_encrypted) <= 512) NOT VALID,
  ADD CONSTRAINT members_phone_encrypted_length CHECK (char_length(phone_encrypted) <= 512) NOT VALID;

-- D-5: generate_member_number() was executable by anon and authenticated through
-- /rest/v1/rpc/generate_member_number, so anyone could burn member numbers (sequence values
-- are never given back) and the function had no pinned search_path. It is only needed as the
-- column DEFAULT of members.member_number, which handle_new_user() (SECURITY DEFINER, owned
-- by postgres) evaluates as postgres, and by service-role inserts.
CREATE OR REPLACE FUNCTION public.generate_member_number()
  RETURNS text
  LANGUAGE plpgsql
  SET search_path TO ''
AS $$
BEGIN
  RETURN '000-' || pg_catalog.lpad(pg_catalog.nextval('public.member_number_seq')::text, 3, '0');
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_member_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_member_number() TO service_role;

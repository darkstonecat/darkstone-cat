-- Member numbers never truncate past 999 (BR-2: numbers are permanent and never reused).
--
-- generate_member_number() built '000-' || lpad(nextval, 3, '0'). lpad also TRUNCATES a longer
-- string to the given length, so from member 1000 on the numbers wrapped ('1196' -> '119') and
-- collided with members_member_number_key: sign-up failed with "Database error creating new
-- user". Production starts at 168, so this would hit the association at member 1000.
--
-- New format: three digits at least, as many as needed beyond that ('000-007', '000-999',
-- '000-1000'). Every number already issued keeps its value. The admin list sorts by the digits
-- padded to 20 (admin_list_members, 20261005100400), so '000-1000' sorts after '000-999'.
-- member_number has no length CHECK; the routes accept up to 32 characters.
--
-- The format lives in member_number_format(n) so it can be tested without moving the shared
-- sequence. Same pinned search_path and grants as 20261001110000_member_data_hardening.sql:
-- executable by service_role (and the owner, postgres), never by anon/authenticated.
--
-- Safe to apply to production at any time (before member 1000): nothing else changes.

CREATE OR REPLACE FUNCTION public.member_number_format(n bigint)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  STRICT
  SET search_path TO ''
AS $$
  SELECT '000-' || pg_catalog.lpad(n::text, GREATEST(3, pg_catalog.length(n::text)), '0');
$$;

REVOKE EXECUTE ON FUNCTION public.member_number_format(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.member_number_format(bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.generate_member_number()
  RETURNS text
  LANGUAGE plpgsql
  SET search_path TO ''
AS $$
BEGIN
  RETURN public.member_number_format(pg_catalog.nextval('public.member_number_seq'));
END;
$$;

REVOKE EXECUTE ON FUNCTION public.generate_member_number() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_member_number() TO service_role;

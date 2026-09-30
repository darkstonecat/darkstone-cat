-- Migration: members.card_token — unguessable, revocable token encoded in the member card QR
-- (https://www.darkstone.cat/verify/<card_token>). Never encodes the sequential member number.

-- 1. Token generator: 32 hex chars from a v4 UUID (122 random bits), URL-safe, no extension needed
CREATE OR REPLACE FUNCTION public.generate_card_token()
  RETURNS text
  LANGUAGE sql
  SET search_path TO ''
AS $$
  SELECT replace(gen_random_uuid()::text, '-', '');
$$;

-- 2. Column: add nullable, backfill one distinct token per existing row, then lock it down
ALTER TABLE public.members ADD COLUMN card_token text;

UPDATE public.members SET card_token = public.generate_card_token() WHERE card_token IS NULL;

ALTER TABLE public.members
  ALTER COLUMN card_token SET DEFAULT public.generate_card_token(),
  ALTER COLUMN card_token SET NOT NULL,
  ADD CONSTRAINT members_card_token_key UNIQUE (card_token);

-- 3. RLS: members can update their own row but not role, member_number or card_token
DROP POLICY members_update_own ON public.members;

CREATE POLICY members_update_own ON public.members
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT m.role FROM public.members m WHERE m.id = auth.uid())
    AND member_number = (SELECT m.member_number FROM public.members m WHERE m.id = auth.uid())
    AND card_token = (SELECT m.card_token FROM public.members m WHERE m.id = auth.uid())
  );

-- 4. Admin-only revocation: issues a new token and returns it
CREATE OR REPLACE FUNCTION public.regenerate_card_token(target_member_id uuid)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  new_token text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.members WHERE id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
  END IF;

  new_token := public.generate_card_token();

  UPDATE public.members SET card_token = new_token WHERE id = target_member_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Member not found';
  END IF;

  RETURN new_token;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.regenerate_card_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.regenerate_card_token(uuid) TO authenticated;

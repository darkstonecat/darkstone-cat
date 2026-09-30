-- Migration: close gaps found in review of card_token / member_badges
-- 1. members_update_own also pins membership_start_date and created_at (badge "Membre {year}" source)
-- 2. card_token format CHECK so admins cannot set a guessable token directly
-- 3. member_badges: no write privileges for API roles (service role only)

DROP POLICY members_update_own ON public.members;

CREATE POLICY members_update_own ON public.members
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role = (SELECT m.role FROM public.members m WHERE m.id = auth.uid())
    AND member_number = (SELECT m.member_number FROM public.members m WHERE m.id = auth.uid())
    AND card_token = (SELECT m.card_token FROM public.members m WHERE m.id = auth.uid())
    AND membership_start_date IS NOT DISTINCT FROM (SELECT m.membership_start_date FROM public.members m WHERE m.id = auth.uid())
    AND created_at IS NOT DISTINCT FROM (SELECT m.created_at FROM public.members m WHERE m.id = auth.uid())
  );

ALTER TABLE public.members
  ADD CONSTRAINT members_card_token_format CHECK (card_token ~ '^[0-9a-f]{32}$');

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.member_badges FROM anon, authenticated;

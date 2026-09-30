-- Migration: member_badges — badges assigned by the board (Supabase dashboard / service role).
-- "Membre {year}" is derived from members.membership_start_date and is not stored here.

CREATE TABLE public.member_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  badge_key text NOT NULL CHECK (badge_key IN ('volunteer_egara_joga', 'ludoteca_donor')),
  awarded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (member_id, badge_key)
);

ALTER TABLE public.member_badges ENABLE ROW LEVEL SECURITY;

-- Read-only for members and admins; writes only through the service role (bypasses RLS)
CREATE POLICY member_badges_select_own ON public.member_badges
  FOR SELECT USING (auth.uid() = member_id);

CREATE POLICY member_badges_admins_select_all ON public.member_badges
  FOR SELECT USING (public.is_admin());

-- Migration M1: membership state on the member row (admin panel spec §4, BR-1..8, BR-18, BR-20).
--
-- The membership state is a mark on the member's own row, not a separate table: a person keeps
-- one row and one member number for life (BR-1, BR-2). State = active while left_on IS NULL,
-- former otherwise. Leave/rejoin cycles are recorded in the audit log (T3), not here.
--
-- This migration also locks down who may write members:
--   * members may update only their self-editable profile columns (column-level grants), and a
--     former member may not update their row at all;
--   * admins_update_all is dropped: board changes to another member will go through audited
--     SECURITY DEFINER functions (T6/T7), never a direct PostgREST UPDATE;
--   * deleting a login account no longer deletes a former member's register row (the purge,
--     3 years after the leave, keeps an anonymous stub), so the FK cascade becomes a trigger.
--
-- Safe to apply to production before the code that uses it: no current code path writes a
-- column that loses its grant (see the GRANT list below).

-- 1. Membership columns ------------------------------------------------------------------------
--    membership_start_date stays as "primera alta" (never changes, source of "Membre {year}").
ALTER TABLE public.members
  ADD COLUMN current_joined_on date NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN left_on date,
  ADD COLUMN left_by text,
  ADD COLUMN leave_reason text,
  ADD COLUMN anonymised_at timestamptz,
  ADD COLUMN purged_at timestamptz,
  ADD COLUMN card_issued_at timestamptz NOT NULL DEFAULT now();

-- "Alta actual" equals "primera alta" until the first return; the current card was issued when
-- the row was created (regenerate_card_token will maintain card_issued_at from T7 on).
UPDATE public.members
SET current_joined_on = membership_start_date,
    card_issued_at = created_at;

-- Consistency checks. NOT VALID like every new CHECK in this project (existing rows are never
-- scanned, so legacy data cannot make the migration fail); they apply to every new write.
ALTER TABLE public.members
  ADD CONSTRAINT members_left_by_values
    CHECK (left_by IN ('self', 'board')) NOT VALID,
  -- left_on and left_by are set together on a leave and cleared together on a return
  ADD CONSTRAINT members_left_on_left_by_pair
    CHECK ((left_on IS NULL) = (left_by IS NULL)) NOT VALID,
  ADD CONSTRAINT members_leave_reason_length
    CHECK (char_length(leave_reason) <= 500) NOT VALID,
  ADD CONSTRAINT members_leave_reason_requires_leave
    CHECK (leave_reason IS NULL OR left_on IS NOT NULL) NOT VALID,
  -- BR-8: a leave given by the board needs a written reason; the purge deletes the reason
  ADD CONSTRAINT members_board_leave_has_reason
    CHECK (left_by IS DISTINCT FROM 'board' OR leave_reason IS NOT NULL OR purged_at IS NOT NULL) NOT VALID,
  -- only a former member can be anonymised (S-3) or purged (§4.5)
  ADD CONSTRAINT members_anonymised_requires_leave
    CHECK (anonymised_at IS NULL OR left_on IS NOT NULL) NOT VALID,
  ADD CONSTRAINT members_purged_requires_leave
    CHECK (purged_at IS NULL OR left_on IS NOT NULL) NOT VALID;

-- Active/former filters (lists, stats, exports) and the retention job (left_on + 3 years)
CREATE INDEX members_left_on_idx ON public.members (left_on);

-- 2. Column-level UPDATE for members -----------------------------------------------------------
--    Every self-update path and the columns it writes, all through the user's session client:
--      updateMemberProfile (src/lib/profile/actions.ts): first_name, last_name, postal_code,
--        ludoya_username, bgg_username, newsletter_accepted, phone_encrypted, dni_nie_encrypted
--      linkGamingAccount / unlinkGamingAccount / setNewsletterAccepted
--        (src/lib/profile/details-actions.ts): ludoya_username, bgg_username, newsletter_accepted
--    updateMemberAfterSignup (src/lib/supabase/actions.ts) and scripts/migrate-members.mjs use
--    the service role, which keeps its full table privileges.
--    INSERT and DELETE were already impossible for API roles (no RLS policy); revoking them, and
--    TRUNCATE (which RLS does not cover), makes that explicit (BR-3).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.members FROM anon, authenticated;

GRANT UPDATE (
  first_name,
  last_name,
  postal_code,
  ludoya_username,
  bgg_username,
  newsletter_accepted,
  phone_encrypted,
  dni_nie_encrypted
) ON public.members TO authenticated;

-- The WITH CHECK pins stay as a second line of defence behind the column grants. USING adds
-- left_on IS NULL: a former member (a session still open at the time of the leave) cannot
-- write their row.
DROP POLICY members_update_own ON public.members;

CREATE POLICY members_update_own ON public.members
  FOR UPDATE
  USING (auth.uid() = id AND left_on IS NULL)
  WITH CHECK (
    auth.uid() = id
    AND left_on IS NULL
    AND role = (SELECT m.role FROM public.members m WHERE m.id = auth.uid())
    AND member_number = (SELECT m.member_number FROM public.members m WHERE m.id = auth.uid())
    AND card_token = (SELECT m.card_token FROM public.members m WHERE m.id = auth.uid())
    AND membership_start_date IS NOT DISTINCT FROM (SELECT m.membership_start_date FROM public.members m WHERE m.id = auth.uid())
    AND created_at IS NOT DISTINCT FROM (SELECT m.created_at FROM public.members m WHERE m.id = auth.uid())
  );

-- 3. No direct admin UPDATE on other members ---------------------------------------------------
--    It let any admin change any column, including role. Nothing in src/ relied on it (the admin
--    screens are read-only; card regeneration is the SECURITY DEFINER regenerate_card_token).
DROP POLICY admins_update_all ON public.members;

-- 4. Deleting a login account ------------------------------------------------------------------
--    members_id_fkey (ON DELETE CASCADE) deleted the member row with the auth user. A former
--    member's register must survive the deletion of the login account (anonymisation S-3 and
--    the purge delete the account but keep a stub with the number and dates, BR-2), so the FK
--    becomes a trigger that deletes only ACTIVE rows. deleteAccount, discardUnconfirmedSignup
--    and prepareSignup (active or unconfirmed users) behave as before. member_badges still
--    cascades from members.
ALTER TABLE public.members DROP CONSTRAINT members_id_fkey;

CREATE OR REPLACE FUNCTION public.handle_deleted_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
BEGIN
  DELETE FROM public.members
  WHERE id = OLD.id
    AND left_on IS NULL;
  RETURN OLD;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_deleted_user() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_deleted_user();

-- 5. State-aware public checks -----------------------------------------------------------------
--    BR-4: a card is valid only while the membership is active. Same signature, grants and
--    search_path as 20260930120000_verify_card_token.sql.
CREATE OR REPLACE FUNCTION public.verify_card_token(p_token text)
  RETURNS TABLE (valid boolean, member_number text)
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  found_number text;
BEGIN
  -- Malformed input never reaches the table: same answer as an unknown token
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{32}$' THEN
    RETURN QUERY SELECT false, NULL::text;
    RETURN;
  END IF;

  -- A former member's card answers exactly like an unknown token
  SELECT m.member_number INTO found_number
  FROM public.members AS m
  WHERE m.card_token = p_token
    AND m.left_on IS NULL;

  RETURN QUERY SELECT (found_number IS NOT NULL), found_number;
END;
$$;

--    §4.4: no magic link (or, from T26, recovery mail) for a former member. Same signature,
--    grants and search_path as 20261001120000_is_email_confirmed.sql.
CREATE OR REPLACE FUNCTION public.is_email_confirmed(p_email text)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    WHERE u.email = lower(btrim(p_email))
      AND u.email_confirmed_at IS NOT NULL
      AND u.deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.members m
        WHERE m.id = u.id
          AND m.left_on IS NOT NULL
      )
  );
$$;

-- 6. Who awarded a badge (A-8). No FK to auth.users: the awarding board member's login account
--    may be deleted later, and the value must survive it.
ALTER TABLE public.member_badges ADD COLUMN awarded_by uuid;

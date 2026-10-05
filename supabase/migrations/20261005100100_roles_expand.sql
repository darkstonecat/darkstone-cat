-- Migration M2: role hierarchy, expand step (admin panel spec §3, BR-9..BR-12, BR-16).
--
-- Roles are hierarchical: superadmin ⊃ board ⊃ member. During the transition the legacy role
-- 'admin' stays valid and ranks like 'board'; the contract migration (T27/M7) maps admin → board
-- and removes it from the CHECK.
--
-- Who may change a role does not change here: since M1 authenticated users have no UPDATE grant
-- on members.role, so a role changes only through the service role (today) and the audited
-- SECURITY DEFINER role functions (T8). The role guard below is the backstop for both.
--
-- Errors raised by the role guard (SQLSTATE 23514 check_violation; PostgREST answers 400). The
-- message starts with a stable prefix the app maps to a translated text:
--   role_guard:self_role_change     BR-11  the caller (auth.uid()) changes their own role
--   role_guard:last_superadmin      BR-10  removing a superadmin would leave fewer than two
--   role_guard:former_member_role   BR-12  a former member (left_on set) would hold a role
-- Callers without a JWT subject (service role, migrations, SQL editor) skip BR-11 only. To fix
-- the data by hand past BR-10, promote the replacement first (promotions are always allowed).
--
-- Safe to apply to production before the code that uses it: 'admin' keeps every permission it
-- has today (is_admin() accepts it), and no current code path writes role.

-- 1. Wider role CHECK --------------------------------------------------------------------------
--    Every existing row passed the narrower check, so validating the new one cannot fail.
ALTER TABLE public.members DROP CONSTRAINT members_role_check;

ALTER TABLE public.members
  ADD CONSTRAINT members_role_check
    CHECK (role IN ('member', 'admin', 'board', 'superadmin')) NOT VALID;

ALTER TABLE public.members VALIDATE CONSTRAINT members_role_check;

-- BR-12: a former member holds no role. NOT VALID like every new CHECK in this project; the role
-- guard raises the same rule first with a stable message.
ALTER TABLE public.members
  ADD CONSTRAINT members_former_member_no_role
    CHECK (NOT (left_on IS NOT NULL AND role <> 'member')) NOT VALID;

-- 2. role_since --------------------------------------------------------------------------------
--    When the current role was granted ("Junta des de …"). NULL for plain members. Existing
--    admins get created_at: the real grant date was never recorded, and created_at is the
--    earliest moment the role can have been held (better than a fake "today").
ALTER TABLE public.members ADD COLUMN role_since timestamptz;

UPDATE public.members
SET role_since = created_at
WHERE role <> 'member';

-- 3. role_rank() and has_role() ----------------------------------------------------------------
--    role_rank is pure (no table access), so it keeps the default EXECUTE grants and can be
--    used anywhere. Unknown names rank NULL, so a comparison with them is never true.
CREATE OR REPLACE FUNCTION public.role_rank(p_role text)
  RETURNS integer
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  SELECT CASE p_role
    WHEN 'member' THEN 0
    WHEN 'board' THEN 1
    WHEN 'admin' THEN 1      -- legacy alias of board, removed in M7
    WHEN 'superadmin' THEN 2
  END;
$$;

--    True when the caller is an ACTIVE member (left_on IS NULL) whose role ranks at least
--    p_min. Fails closed: no session, no row, a former member or an unknown p_min give false.
--    Only for signed-in users: an RLS policy that anon can reach must call is_admin() (which
--    keeps its PUBLIC grant) or be scoped TO authenticated, or anon gets "permission denied".
CREATE OR REPLACE FUNCTION public.has_role(p_min text)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
AS $$
  SELECT COALESCE(
    (
      SELECT public.role_rank(m.role) >= public.role_rank(p_min)
      FROM public.members AS m
      WHERE m.id = auth.uid()
        AND m.left_on IS NULL
    ),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_role(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(text) TO authenticated;

-- 4. Existing admin checks accept board and superadmin -----------------------------------------
--    is_admin() keeps its signature, language and grants, so every RLS policy that calls it
--    (admins_select_all on members, member_badges' admin SELECT) now also lets board and
--    superadmin in. It now also requires an active membership.
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
  SELECT public.has_role('board');
$$;

--    Same bodies as 20260312191146_create_members_table_and_rls.sql and
--    20260930100000_add_members_card_token.sql; only the role check changes. Messages stay the
--    same (the app and the tests match on "admin role required").
CREATE OR REPLACE FUNCTION public.get_all_members_for_admin()
  RETURNS SETOF admin_member_view
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
BEGIN
  IF NOT public.has_role('board') THEN
    RAISE EXCEPTION 'Unauthorized: admin role required';
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

CREATE OR REPLACE FUNCTION public.regenerate_card_token(target_member_id uuid)
  RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  new_token text;
BEGIN
  IF NOT public.has_role('board') THEN
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

-- 5. Role guard --------------------------------------------------------------------------------
--    Fires when an UPDATE names role or left_on (a leave is where BR-12 bites most often).
--    Checks run in this order: BR-11, BR-12, BR-10. Then role_since follows the rank: a new
--    rank stamps now() (NULL for member); same rank (admin → board in M7) keeps the date.
CREATE OR REPLACE FUNCTION public.members_role_guard()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  caller uuid := auth.uid();
  other_superadmins integer;
BEGIN
  IF NEW.role IS NOT DISTINCT FROM OLD.role AND NEW.left_on IS NOT DISTINCT FROM OLD.left_on THEN
    RETURN NEW;
  END IF;

  -- BR-11: nobody changes their own role, whatever the path (calls without a JWT subject skip)
  IF caller IS NOT NULL AND caller = OLD.id AND NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role_guard:self_role_change: nobody can change their own role'
      USING ERRCODE = 'check_violation';
  END IF;

  -- BR-12: a former member holds no role; the role is removed before the leave
  IF NEW.left_on IS NOT NULL AND NEW.role <> 'member' THEN
    RAISE EXCEPTION 'role_guard:former_member_role: a former member cannot hold a role'
      USING ERRCODE = 'check_violation';
  END IF;

  -- BR-10: removing a superadmin may never leave fewer than two active superadmins. The lock
  -- serialises concurrent demotions, so two of them cannot both see the same count.
  IF OLD.role = 'superadmin' AND OLD.left_on IS NULL
     AND (NEW.role IS DISTINCT FROM 'superadmin' OR NEW.left_on IS NOT NULL) THEN
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.members_role_guard'));

    SELECT count(*) INTO other_superadmins
    FROM public.members AS m
    WHERE m.role = 'superadmin'
      AND m.left_on IS NULL
      AND m.id <> OLD.id;

    IF other_superadmins < 2 THEN
      RAISE EXCEPTION 'role_guard:last_superadmin: there must always be at least two superadmins'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF public.role_rank(NEW.role) IS DISTINCT FROM public.role_rank(OLD.role) THEN
    NEW.role_since := CASE WHEN NEW.role = 'member' THEN NULL ELSE now() END;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.members_role_guard() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER members_role_guard
  BEFORE UPDATE OF role, left_on ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.members_role_guard();

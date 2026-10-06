-- Migration M7: role hierarchy, contract step (admin panel spec §3, BR-9..BR-12; T27).
--
-- M2 (20261005100100_roles_expand.sql) widened the role CHECK and kept the legacy role 'admin'
-- as an alias of 'board'. This migration retires it:
--   1. every active 'admin' becomes 'board'. role_since is kept: the role guard only restamps it
--      when role_rank() changes, and admin and board rank the same (1) while this UPDATE runs.
--      A former member still holding 'admin' (impossible since M2's guard, but the BR-12 CHECK
--      is NOT VALID) becomes 'member', which is what BR-12 requires.
--   2. the role CHECK allows only 'member', 'board' and 'superadmin'.
--   3. role_rank() no longer knows 'admin' (NULL rank, so has_role() is false for it).
--   4. get_all_members_for_admin() and its return type admin_member_view are dropped. Nothing
--      calls them since T24 (the admin screens read through the admin_* SECURITY DEFINER
--      functions, the exports through admin_export_*).
-- Everything else stays as it is. A few functions still name 'admin' in a role filter
-- (admin_list_members, admin_export_members, admin_stats); that branch simply never matches.
-- audit_log keeps actor_role = 'admin' on old entries (history is append-only); the app shows
-- it as "Junta".
--
-- PRODUCTION ORDER (see odd/tasks/admin-panel.md, prod runbook): apply this migration ONLY
--   a) after the admin-panel code is deployed. The code before the admin panel only lets
--      role = 'admin' into /admin, so applying M7 under it locks every admin out; the admin-panel
--      code accepts 'board' (and still treats a leftover 'admin' as board until M7 is applied,
--      src/lib/auth/roles.ts), and
--   b) after supabase/snippets/promote-superadmins.sql has run and two active superadmins exist:
--      BR-10 only lets a superadmin go while two others remain, and roles can only change
--      through the superadmin functions once nobody holds 'admin' any more.
-- The migration refuses to run without two active superadmins (step 0), so b) cannot be skipped
-- by accident. It fails atomically.

-- 0. Precondition: two active superadmins (runbook b) ---------------------------------------------
DO $$
DECLARE
  v_superadmins integer;
BEGIN
  SELECT count(*) INTO v_superadmins
  FROM public.members AS m
  WHERE m.role = 'superadmin'
    AND m.left_on IS NULL;

  -- An empty database (local db:reset, CI, a fresh preview branch) has no members at all and
  -- nothing to protect; any database with members must have the superadmins first.
  IF v_superadmins < 2 AND EXISTS (SELECT 1 FROM public.members) THEN
    RAISE EXCEPTION 'roles_contract: found % active superadmins, need 2 (run supabase/snippets/promote-superadmins.sql first)', v_superadmins
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

-- 1. admin → board (role_since kept: same rank) ----------------------------------------------------
UPDATE public.members
SET role = 'board'
WHERE role = 'admin'
  AND left_on IS NULL;

UPDATE public.members
SET role = 'member'
WHERE role = 'admin'
  AND left_on IS NOT NULL;

-- 2. Narrow role CHECK ---------------------------------------------------------------------------
--    No row holds 'admin' any more, so validating the narrower check cannot fail.
ALTER TABLE public.members DROP CONSTRAINT members_role_check;

ALTER TABLE public.members
  ADD CONSTRAINT members_role_check
    CHECK (role IN ('member', 'board', 'superadmin')) NOT VALID;

ALTER TABLE public.members VALIDATE CONSTRAINT members_role_check;

-- 3. role_rank() without the legacy alias ----------------------------------------------------------
--    CREATE OR REPLACE keeps the grants (pure function, default EXECUTE).
CREATE OR REPLACE FUNCTION public.role_rank(p_role text)
  RETURNS integer
  LANGUAGE sql
  IMMUTABLE
  SET search_path TO ''
AS $$
  SELECT CASE p_role
    WHEN 'member' THEN 0
    WHEN 'board' THEN 1
    WHEN 'superadmin' THEN 2
  END;
$$;

-- 4. Drop the service-role member list and its type ------------------------------------------------
DROP FUNCTION IF EXISTS public.get_all_members_for_admin();

DROP TYPE IF EXISTS public.admin_member_view;

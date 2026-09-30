-- Migration: deleting an auth user must also delete its members row.
-- members.id referenced auth.users(id) with no ON DELETE action, so
-- auth.admin.deleteUser failed for any user that had a members row
-- (account deletion, abandoned sign-ups). member_badges already cascades
-- from members, so this removes the whole chain.

ALTER TABLE public.members
  DROP CONSTRAINT members_id_fkey,
  ADD CONSTRAINT members_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

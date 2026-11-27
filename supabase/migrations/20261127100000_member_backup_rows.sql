-- Member backup (docs/features/member-backup/spec.md, odd/tasks/member-backup.md T1).
--
-- backup_member_rows(): every member row the weekly backup Sheet carries, with the e-mail from
-- auth.users and the member's badges, in one read. Called only by GET /api/cron/backup with the
-- service role (a scheduled job has no user). The DNI/phone columns stay encrypted here: the
-- route decrypts them with ENCRYPTION_KEY, so the key never reaches the database.
--
-- Rows: the same set as the llibre de socis (S-4): purged stubs are left out, and so are
-- sign-ups whose e-mail was never confirmed (BR-22: not members yet, deleted after 30 days).
-- Former members are included with whatever the database still holds after their baixa.
--
-- badges: "<key>@<YYYY-MM-DD>" joined with "; ", oldest award first, date in Madrid time.
-- Order: member number by length, then text, so 000-1000 comes after 000-999.

CREATE OR REPLACE FUNCTION public.backup_member_rows()
  RETURNS TABLE (
    id uuid,
    member_number text,
    first_name text,
    last_name text,
    email text,
    dni_nie_encrypted text,
    phone_encrypted text,
    postal_code text,
    ludoya_username text,
    bgg_username text,
    role text,
    newsletter_accepted boolean,
    membership_start_date date,
    current_joined_on date,
    left_on date,
    left_by text,
    leave_reason text,
    anonymised_at timestamptz,
    created_at timestamptz,
    badges text
  )
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
AS $$
  SELECT
    m.id,
    m.member_number,
    m.first_name,
    m.last_name,
    u.email::text,
    m.dni_nie_encrypted,
    m.phone_encrypted,
    m.postal_code,
    m.ludoya_username,
    m.bgg_username,
    m.role,
    m.newsletter_accepted,
    m.membership_start_date,
    m.current_joined_on,
    m.left_on,
    m.left_by,
    m.leave_reason,
    m.anonymised_at,
    m.created_at,
    (
      SELECT pg_catalog.string_agg(
        b.badge_key || '@' || pg_catalog.to_char(b.awarded_at AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD'),
        '; ' ORDER BY b.awarded_at, b.badge_key
      )
      FROM public.member_badges AS b
      WHERE b.member_id = m.id
    )
  FROM public.members AS m
  LEFT JOIN auth.users AS u ON u.id = m.id
  WHERE m.purged_at IS NULL
    AND (u.id IS NULL OR u.email_confirmed_at IS NOT NULL)
  ORDER BY pg_catalog.char_length(m.member_number), m.member_number;
$$;

REVOKE EXECUTE ON FUNCTION public.backup_member_rows() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backup_member_rows() TO service_role;

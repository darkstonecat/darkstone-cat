-- Migration: holders of one catalogue badge (odd/tasks/badge-catalogue.md T3a, S7.3).
--
-- admin_list_badge_holders(p_key): board only, for the badge page "Socis que la tenen" and the
-- bulk award dialog ("ja la té"). Every member who holds the badge, archived badges included
-- (the page of an archived badge still lists them). Purged stubs and unconfirmed sign-ups are
-- left out, like admin_get_member (BR-22). Active members first, then former ones; newest award
-- first within each group. No DNI, phone or e-mail.
--
-- Errors (prefix:code, SQLSTATE):
--   admin:forbidden   42501  caller lacks the role
--   admin:not_found   22023  unknown (or missing) badge key

CREATE OR REPLACE FUNCTION public.admin_list_badge_holders(p_key text)
  RETURNS TABLE (
    member_id uuid,
    member_number text,
    first_name text,
    last_name text,
    state text,
    awarded_at timestamptz
  )
  LANGUAGE plpgsql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
AS $$
#variable_conflict use_column
BEGIN
  PERFORM public.admin_assert_board();

  IF p_key IS NULL OR NOT EXISTS (SELECT 1 FROM public.badges AS b WHERE b.key = p_key) THEN
    RAISE EXCEPTION 'admin:not_found: unknown badge'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.member_number,
    m.first_name,
    m.last_name,
    CASE WHEN m.left_on IS NULL THEN 'active' ELSE 'former' END,
    mb.awarded_at
  FROM public.member_badges AS mb
  JOIN public.members AS m ON m.id = mb.member_id
  LEFT JOIN auth.users AS u ON u.id = m.id
  WHERE mb.badge_key = p_key
    AND m.purged_at IS NULL
    AND (u.id IS NULL OR u.email_confirmed_at IS NOT NULL)            -- BR-22
  ORDER BY (m.left_on IS NOT NULL), mb.awarded_at DESC, m.member_number;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_list_badge_holders(text) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_badge_holders(text) TO authenticated;

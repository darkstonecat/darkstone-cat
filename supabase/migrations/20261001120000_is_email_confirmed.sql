-- A-4 (pre-account hijack): the magic-link request must only be sent for an account
-- whose email was already confirmed. GoTrue sends a sign-up confirmation mail (whose
-- link also signs the person in) for an UNCONFIRMED user, so a stranger who
-- pre-registered someone else's email with their own password would get that
-- account confirmed by the victim. The magic-link server action asks this function
-- first, with the service-role client.
--
-- Callable only by service_role (never anon/authenticated through PostgREST), so it
-- cannot be used from the browser to enumerate accounts.
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
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_email_confirmed(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_email_confirmed(text) TO service_role;

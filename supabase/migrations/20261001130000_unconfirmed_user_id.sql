-- A-4 (iv) (pre-account hijack through sign-up): when someone signs up with an email
-- whose account is still UNCONFIRMED, GoTrue keeps that user and its password. A
-- stranger who pre-registered a victim's email therefore keeps their own password
-- after the victim signs up and confirms. The sign-up flow now asks this function
-- right before `signUp` and deletes the stale unconfirmed user, so the last sign-up
-- wins and the password that ends up confirmed is the victim's.
--
-- Returns the id only for an UNCONFIRMED user (never a confirmed one, which must not
-- be deleted). Callable only by service_role, so it cannot be used from the browser
-- to enumerate accounts.
CREATE OR REPLACE FUNCTION public.unconfirmed_user_id(p_email text)
  RETURNS uuid
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
AS $$
  SELECT u.id
  FROM auth.users u
  WHERE lower(u.email) = lower(btrim(p_email))
    AND u.email_confirmed_at IS NULL
    AND u.deleted_at IS NULL
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.unconfirmed_user_id(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unconfirmed_user_id(text) TO service_role;

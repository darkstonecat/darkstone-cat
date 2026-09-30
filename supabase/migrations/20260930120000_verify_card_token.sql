-- Migration: public card verification for /verify/<token> (QR of the member card).
-- Anonymous visitors may check a token, but the only things they can learn are whether it is
-- valid and the member number of a valid card. Nothing else about the member is ever returned.

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

  SELECT m.member_number INTO found_number
  FROM public.members AS m
  WHERE m.card_token = p_token;

  RETURN QUERY SELECT (found_number IS NOT NULL), found_number;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.verify_card_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_card_token(text) TO anon, authenticated;

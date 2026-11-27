-- Member restore (docs/features/member-backup/spec.md §7, odd/tasks/member-backup.md T4).
--
-- restore_raise_member_number_seq(p_floor): moves public.member_number_seq up to p_floor so the
-- next generated number is above it. Used by scripts/restore-members.mjs before it restores the
-- members of a backup Sheet: handle_new_user() gives every new auth user the next number of
-- the sequence, and without this a restored member could get a number that the backup assigns
-- to another member (a unique violation), and new sign-ups after the restore would collide too.
--
-- It never lowers the sequence (a floor below the current value is a no-op), so calling it on
-- a live database cannot make a number repeat. Service role only. Returns the sequence's last
-- value after the call.

CREATE OR REPLACE FUNCTION public.restore_raise_member_number_seq(p_floor bigint)
  RETURNS bigint
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  current_value bigint;
BEGIN
  IF p_floor IS NULL OR p_floor < 1 THEN
    RAISE EXCEPTION 'restore:invalid_argument: the floor must be a positive number'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Serialise concurrent calls so two restores cannot both read the same value.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('public.restore_raise_member_number_seq'));

  SELECT CASE WHEN s.is_called THEN s.last_value ELSE s.last_value - 1 END
    INTO current_value
  FROM public.member_number_seq AS s;

  IF p_floor > current_value THEN
    PERFORM pg_catalog.setval('public.member_number_seq', p_floor, true);
    RETURN p_floor;
  END IF;
  RETURN current_value;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.restore_raise_member_number_seq(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.restore_raise_member_number_seq(bigint) TO service_role;

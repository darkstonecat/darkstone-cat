-- Migration: shared rate limiter.
-- The in-memory limiter only protects one serverless instance. This table and function give
-- the server a limiter shared by every instance. It is called only with the service role from
-- src/lib/rate-limit.ts; the bucket is "<scope>:<HMAC of the IP>", never a raw IP.

CREATE TABLE public.rate_limit_hits (
  id bigserial PRIMARY KEY,
  bucket text NOT NULL,
  hit_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rate_limit_hits_bucket_hit_at_idx ON public.rate_limit_hits (bucket, hit_at);
-- Serves the opportunistic cleanup of old rows across all buckets.
CREATE INDEX rate_limit_hits_hit_at_idx ON public.rate_limit_hits (hit_at);

-- RLS on with no policies: no client role can read or write the table.
ALTER TABLE public.rate_limit_hits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.rate_limit_hits FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.rate_limit_hits_id_seq FROM PUBLIC, anon, authenticated;

-- Records one hit for p_bucket and returns true when it is allowed (fewer than p_max hits
-- in the last p_window_seconds), false when the bucket is over its limit. Denied calls are
-- not recorded. The per-bucket advisory lock makes check-then-insert atomic for one bucket.
-- Windows are capped at 2 days because the cleanup below drops every row older than that.
CREATE OR REPLACE FUNCTION public.rate_limit_hit(
  p_bucket text,
  p_max integer,
  p_window_seconds integer
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
AS $$
DECLARE
  hits integer;
BEGIN
  IF p_bucket IS NULL OR p_bucket = '' OR p_max < 1 OR p_window_seconds < 1 OR p_window_seconds > 172800 THEN
    RAISE EXCEPTION 'invalid rate limit arguments';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext(p_bucket));

  DELETE FROM public.rate_limit_hits
  WHERE bucket = p_bucket
    AND hit_at < now() - make_interval(secs => p_window_seconds);

  -- Cheap housekeeping so abandoned buckets never accumulate: on a small share of calls,
  -- drop everything older than the longest allowed window.
  IF random() < 0.02 THEN
    DELETE FROM public.rate_limit_hits WHERE hit_at < now() - interval '2 days';
  END IF;

  SELECT count(*) INTO hits FROM public.rate_limit_hits WHERE bucket = p_bucket;
  IF hits >= p_max THEN
    RETURN false;
  END IF;

  INSERT INTO public.rate_limit_hits (bucket) VALUES (p_bucket);
  RETURN true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rate_limit_hit(text, integer, integer) TO service_role;

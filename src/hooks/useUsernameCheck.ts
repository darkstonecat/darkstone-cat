"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type UsernameCheckState = "idle" | "checking" | "found" | "not_found" | "failed";

type Checker = (username: string) => Promise<{ status: "found" | "not_found" | "failed" }>;

/**
 * Advisory on-blur username check. Never blocks anything: `not_found` is a soft
 * warning and `failed` is silent. Results for a value are remembered so that
 * blurring the same value again does not hit the server (failed is not cached,
 * so a retry is possible). A stale answer for an older value is discarded.
 */
export function useUsernameCheck(check: Checker) {
  const [state, setState] = useState<UsernameCheckState>("idle");
  const [checked, setChecked] = useState("");
  const cache = useRef(new Map<string, "found" | "not_found">());
  const latest = useRef("");
  const inflight = useRef<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reset = useCallback(() => {
    latest.current = "";
    setState("idle");
  }, []);

  const run = useCallback(
    async (raw: string) => {
      const value = raw.trim().replace(/^@+/, "");
      latest.current = value;
      if (!value) {
        setState("idle");
        return;
      }
      setChecked(value);
      const cached = cache.current.get(value.toLowerCase());
      if (cached) {
        setState(cached);
        return;
      }
      if (inflight.current === value) return;
      inflight.current = value;
      setState("checking");
      let status: "found" | "not_found" | "failed";
      try {
        status = (await check(value)).status;
      } catch {
        status = "failed";
      }
      if (inflight.current === value) inflight.current = null;
      if (!mounted.current || latest.current !== value) return;
      if (status !== "failed") cache.current.set(value.toLowerCase(), status);
      setState(status);
    },
    [check]
  );

  return { state, checked, run, reset };
}

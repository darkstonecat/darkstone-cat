"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { toRole, type Role } from "@/lib/auth/roles";

type AuthState = {
  user: User | null;
  /** Unknown values from the database are null. Display only: the server enforces access. */
  role: Role | null;
  loading: boolean;
};

/**
 * Reads the Supabase session directly from browser cookies.
 * Instant, synchronous — bypasses Supabase's Navigator Lock and initializePromise.
 */
function readSessionCookie(): { user: User } | null {
  if (typeof document === "undefined") return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;

  const projectRef = new URL(url).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  // Parse document.cookie into a map
  const cookies: Record<string, string> = {};
  for (const c of document.cookie.split(";")) {
    const eq = c.indexOf("=");
    if (eq < 0) continue;
    cookies[c.substring(0, eq).trim()] = c.substring(eq + 1);
  }

  // Single cookie or chunked (name.0, name.1, ...)
  let raw = cookies[storageKey] ?? "";
  if (!raw) {
    const chunks: string[] = [];
    for (let i = 0; ; i++) {
      const chunk = cookies[`${storageKey}.${i}`];
      if (chunk === undefined) break;
      chunks.push(chunk);
    }
    raw = chunks.join("");
  }
  if (!raw) return null;

  try {
    let decoded = decodeURIComponent(raw);

    // @supabase/ssr encodes as "base64-" + base64url(JSON)
    if (decoded.startsWith("base64-")) {
      const b64 = decoded
        .substring(7)
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
      const binary = atob(padded);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      decoded = new TextDecoder().decode(bytes);
    }

    const session = JSON.parse(decoded);
    if (session?.user) return { user: session.user as User };
  } catch {
    // Cookie malformed or encoding changed — fall through
  }
  return null;
}

export function useAuthUser(): AuthState {
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    // ── Async helpers ──
    async function fetchRole(
      userId: string
    ): Promise<Role | null> {
      try {
        const { data, error } = await supabase
          .from("members")
          .select("role")
          .eq("id", userId)
          .single();
        if (error) return null;
        return toRole(data?.role);
      } catch {
        return null;
      }
    }

    // ── Instant path: read cookie directly (no locks, no network) ──
    // Microtask avoids synchronous setState-in-effect while still resolving
    // before the next browser paint.
    const cookieSession = readSessionCookie();
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      if (cookieSession?.user) {
        setState({ user: cookieSession.user, role: null, loading: false });
        const role = await fetchRole(cookieSession.user.id);
        if (!cancelled) {
          setState((prev) =>
            prev.user?.id === cookieSession.user.id
              ? { ...prev, role }
              : prev
          );
        }
      } else {
        setState({ user: null, role: null, loading: false });
      }
    });

    // ── Reactive path: onAuthStateChange for sign in/out/refresh ──
    // IMPORTANT: This callback must be synchronous (not async) to avoid a
    // deadlock with Supabase's Navigator Lock. _notifyAllSubscribers awaits
    // all async callbacks; if fetchRole (which needs getSession → lock) runs
    // inside an awaited callback while the lock is held by the triggering
    // operation (e.g. updateUser), it creates a circular wait.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      if (session?.user) {
        setState((prev) => ({
          user: session.user,
          role: prev.user?.id === session.user.id ? prev.role : null,
          loading: false,
        }));
        fetchRole(session.user.id).then((role) => {
          if (!cancelled) {
            setState({ user: session.user, role, loading: false });
          }
        });
      } else {
        setState({ user: null, role: null, loading: false });
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return state;
}

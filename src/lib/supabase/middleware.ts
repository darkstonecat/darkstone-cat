import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";

/**
 * Longest time a request waits for the session check. getUser() normally answers in well under
 * a second, but when Supabase is unreachable (paused project, outage) auth-js keeps retrying a
 * token refresh for about 25 s, and the proxy runs on every page. Past this limit the request
 * is treated as anonymous: public pages render as for a visitor and protected routes redirect to
 * /login (the proxy fails closed on a null user), so a timeout never grants access.
 */
export const SESSION_CHECK_TIMEOUT_MS = 3_000;

const TIMED_OUT = Symbol("timed-out");

export async function updateSession(
  request: NextRequest,
  response: NextResponse
): Promise<{ response: NextResponse; user: User | null }> {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Mirror cookies on the request (for downstream SSR reads)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Mirror cookies on the response (sent to the browser)
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Use getUser() — validates JWT against Supabase Auth.
  // Do NOT use getSession() — it only reads the local JWT without validation.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<typeof TIMED_OUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMED_OUT), SESSION_CHECK_TIMEOUT_MS);
  });

  try {
    const result = await Promise.race([supabase.auth.getUser(), timeout]);
    if (result === TIMED_OUT) {
      console.warn(`[auth] session check timed out after ${SESSION_CHECK_TIMEOUT_MS} ms`);
      return { response, user: null };
    }
    return { response, user: result.data.user };
  } catch {
    // Never log the error: it can carry token details.
    console.warn("[auth] session check failed");
    return { response, user: null };
  } finally {
    clearTimeout(timer);
  }
}

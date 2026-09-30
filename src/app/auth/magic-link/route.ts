import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const DEFAULT_TARGET = "/profile";

/**
 * Accepts only same-origin relative paths ("/profile", "/es/about?x=1").
 * Rejects absolute URLs, protocol-relative ("//host"), backslashes, schemes
 * and control characters. Anything else falls back to `/profile`.
 */
function safeRedirectPath(raw: string | null, origin: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return DEFAULT_TARGET;
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return DEFAULT_TARGET;
  try {
    const parsed = new URL(raw, origin);
    if (parsed.origin !== origin) return DEFAULT_TARGET;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return DEFAULT_TARGET;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const baseUrl = new URL("/", request.url).origin;
  const errorUrl = `${baseUrl}/login?magic=error`;

  if (!token_hash || type !== "email") {
    return NextResponse.redirect(errorUrl);
  }

  const target = safeRedirectPath(searchParams.get("redirect"), baseUrl);
  // Session cookies are kept (unlike /auth/confirm): the link signs the member in.
  const response = NextResponse.redirect(`${baseUrl}${target}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({ token_hash, type: "email" });

  if (error) {
    return NextResponse.redirect(errorUrl);
  }

  return response;
}

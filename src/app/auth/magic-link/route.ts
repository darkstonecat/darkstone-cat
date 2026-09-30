import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  MAGIC_REDIRECT_COOKIE,
  MAGIC_REDIRECT_PATH,
  safeRedirectPath,
} from "@/lib/safe-redirect";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const baseUrl = new URL("/", request.url).origin;

  // Destination stored by LoginForm when the link was requested (the email
  // template only carries token_hash and type). Re-validated: cookies are user input.
  const cookieTarget = safeRedirectPath(
    request.cookies.get(MAGIC_REDIRECT_COOKIE)?.value,
    baseUrl,
    ""
  );
  const localeMatch = cookieTarget.match(/^\/(es|en)(?=[/?#]|$)/);
  const errorUrl = `${baseUrl}${localeMatch ? localeMatch[0] : ""}/login?magic=error`;

  const fail = () => {
    const res = NextResponse.redirect(errorUrl);
    res.cookies.delete({ name: MAGIC_REDIRECT_COOKIE, path: MAGIC_REDIRECT_PATH });
    return res;
  };

  if (!token_hash || type !== "email") return fail();

  const explicit = searchParams.get("redirect");
  const target =
    explicit !== null
      ? safeRedirectPath(explicit, baseUrl)
      : cookieTarget || safeRedirectPath(null, baseUrl);
  // Session cookies are kept (unlike /auth/confirm): the link signs the member in.
  const response = NextResponse.redirect(`${baseUrl}${target}`);

  response.cookies.delete({ name: MAGIC_REDIRECT_COOKIE, path: MAGIC_REDIRECT_PATH });

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

  if (error) return fail();

  return response;
}

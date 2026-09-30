import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { safeRedirectPath } from "@/lib/safe-redirect";

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

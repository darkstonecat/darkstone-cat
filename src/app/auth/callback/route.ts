import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// The recovery email (resetPasswordForEmail) is the only one that points here.
const ALLOWED_TYPES = ["recovery"] as const;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const baseUrl = new URL("/", request.url).origin;

  if (!token_hash || !type || !(ALLOWED_TYPES as readonly string[]).includes(type)) {
    return NextResponse.redirect(`${baseUrl}/login?recovery=error`);
  }

  const response = NextResponse.redirect(`${baseUrl}/reset-password`);

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

  const { error } = await supabase.auth.verifyOtp({ token_hash, type: "recovery" });

  if (error) {
    return NextResponse.redirect(`${baseUrl}/login?recovery=error`);
  }

  return response;
}

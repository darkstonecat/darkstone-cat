import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Types the confirmation templates send: sign-up confirmation (`email` in the
// current Supabase docs, `signup` in older templates) and email-change
// confirmation. Never `recovery`, `magiclink` or `invite`: those have their own
// routes or are not used, and this route discards the session it creates.
const ALLOWED_TYPES = ["signup", "email", "email_change"] as const;
type ConfirmType = (typeof ALLOWED_TYPES)[number];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");

  const baseUrl = new URL("/", request.url).origin;

  if (!token_hash || !type || !(ALLOWED_TYPES as readonly string[]).includes(type)) {
    return NextResponse.redirect(`${baseUrl}/login?confirmed=error`);
  }

  // Temporary response — Supabase needs somewhere to write cookies during
  // verification, but we intentionally discard them so no session is created.
  // The email gets confirmed server-side; the user will log in manually.
  const tempResponse = NextResponse.next();

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
            tempResponse.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as ConfirmType });

  if (error) {
    return NextResponse.redirect(`${baseUrl}/login?confirmed=error`);
  }

  // Clean redirect — no session cookies, just the confirmation message
  return NextResponse.redirect(`${baseUrl}/login?confirmed=success`);
}

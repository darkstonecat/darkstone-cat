import { createClient } from "@/lib/supabase/server";
import { composeMemberCard } from "@/lib/member-card/composer";
import { routing } from "@/i18n/routing";

type Locale = (typeof routing.locales)[number];

function parseLocale(value: string | null): Locale {
  return routing.locales.find((l) => l === value) ?? routing.defaultLocale;
}

async function loadLabels(locale: Locale) {
  const messages = (await import(`@/messages/${locale}.json`)).default;
  const { brand, tagline, badge } = messages.profile.card;
  return { brand, tagline, badge, since: messages.profile.hero_since } as const;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: member } = await supabase
    .from("members")
    .select("first_name, last_name, member_number, membership_start_date, card_token, left_on")
    .eq("id", user.id)
    .single();

  // A former member has no valid card (BR-4). Their access token can outlive the leave by up to
  // an hour, so the row's state decides, not the session.
  if (!member || member.left_on !== null) {
    return new Response("Member not found", { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const locale = parseLocale(searchParams.get("locale"));

  const fullName = `${member.first_name} ${member.last_name}`;

  const imageResponse = await composeMemberCard({
    fullName,
    memberNumber: member.member_number,
    membershipStartDate: member.membership_start_date,
    cardToken: member.card_token,
    locale,
    labels: await loadLabels(locale),
  });

  const isPreview = searchParams.get("preview") === "1";

  const headers = new Headers(imageResponse.headers);
  headers.set("Cache-Control", "no-store");

  if (!isPreview) {
    const safeFileName = fullName.replace(/[^a-zA-Z0-9À-ÿ ]/g, "").replace(/\s+/g, "_");
    headers.set(
      "Content-Disposition",
      `attachment; filename="carnet_${safeFileName}.png"`
    );
  }

  return new Response(imageResponse.body, {
    status: 200,
    headers,
  });
}

import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import { getProfileData } from "@/lib/supabase/auth";
import { decrypt } from "@/lib/encryption";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import MemberHero from "@/components/profile/MemberHero";
import ProfileView from "@/components/profile/ProfileView";

export const revalidate = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/profile/details");
  return {
    title: t("profile_details_title"),
    description: t("profile_details_description"),
    alternates,
    robots: { index: false, follow: false },
    openGraph: {
      title: t("profile_details_title"),
      description: t("profile_details_description"),
      url: alternates.canonical,
    },
  };
}

export default async function ProfileDetailsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Auth protection is handled by middleware (PROTECTED_ROUTES).
  // Do NOT redirect to /login here — it creates a loop when the middleware
  // and server component disagree about session state (cookie propagation race).
  const profile = await getProfileData();

  let email = "";
  let phone: string | null = null;
  let dni: string | null = null;
  const member = profile?.member ?? null;

  if (profile) {
    email = profile.email;

    if (member?.phone_encrypted) {
      try {
        phone = decrypt(member.phone_encrypted);
      } catch {
        phone = null;
      }
    }

    if (member?.dni_nie_encrypted) {
      try {
        dni = decrypt(member.dni_nie_encrypted);
      } catch {
        dni = null;
      }
    }
  }

  const tNav = await getTranslations({ locale, namespace: "nav" });
  const t = await getTranslations({ locale, namespace: "metadata" });
  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("profile"), path: "/profile" },
    { name: tNav("profile_details"), path: "/profile/details" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(locale, "/profile/details", t("profile_details_title"), t("profile_details_description"));

  return (
    <main id="main-content" className="relative flex min-h-screen flex-col font-sans selection:bg-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd]) }}
      />
      <NavBar />
      {member && (
        <MemberHero
          firstName={member.first_name}
          lastName={member.last_name}
          memberNumber={member.member_number}
          membershipStartDate={member.membership_start_date}
          active="details"
        />
      )}

      <section className="flex-1 bg-brand-beige pb-20">
        <div className="container mx-auto max-w-4xl px-6 pt-16">
          {member ? (
            <ProfileView
              email={email}
              firstName={member.first_name}
              lastName={member.last_name}
              phone={phone}
              dni={dni}
              postalCode={member.postal_code}
              ludoyaUsername={member.ludoya_username}
              bggUsername={member.bgg_username}
              memberNumber={member.member_number}
              role={member.role}
              newsletterAccepted={member.newsletter_accepted}
              membershipStartDate={member.membership_start_date}
            />
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
              Could not load profile data. Please try refreshing the page.
            </div>
          )}
        </div>
      </section>

      <Footer />
      <ScrollToTop />
    </main>
  );
}

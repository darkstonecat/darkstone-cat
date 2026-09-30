import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import { getProfileData } from "@/lib/supabase/auth";
import { decrypt } from "@/lib/encryption";
import { maskDni, maskPhone } from "@/lib/profile/mask";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import MemberHero from "@/components/profile/MemberHero";
import GamingAccounts from "@/components/profile/GamingAccounts";
import MemberDataCard from "@/components/profile/MemberDataCard";
import NewsletterSwitch from "@/components/profile/NewsletterSwitch";
import AccountActions from "@/components/profile/AccountActions";

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

/** Decrypts on the server and returns only the masked form; the raw value never leaves this function. */
function maskEncrypted(encrypted: string | null, mask: typeof maskDni) {
  if (!encrypted) return null;
  try {
    return mask(decrypt(encrypted));
  } catch {
    return null;
  }
}

export default async function ProfileDetailsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Auth protection is handled by middleware (PROTECTED_ROUTES), see /profile.
  const profile = await getProfileData();
  const member = profile?.member ?? null;

  const tNav = await getTranslations({ locale, namespace: "nav" });
  const tMeta = await getTranslations({ locale, namespace: "metadata" });
  const t = await getTranslations({ locale, namespace: "profile.details" });
  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("profile"), path: "/profile" },
    { name: tNav("profile_details"), path: "/profile/details" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(
    locale,
    "/profile/details",
    tMeta("profile_details_title"),
    tMeta("profile_details_description")
  );

  const cardClass = "rounded-2xl bg-brand-white p-5 sm:p-8";
  const titleClass = "text-[22px] font-bold text-stone-custom";

  return (
    <main id="main-content" className="relative flex min-h-screen flex-col font-sans selection:bg-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd]) }}
      />
      <NavBar />

      {profile && member ? (
        <>
          <MemberHero
            firstName={member.first_name}
            lastName={member.last_name}
            memberNumber={member.member_number}
            membershipStartDate={member.membership_start_date}
            active="details"
          />

          <div className="flex-1 bg-brand-beige px-4 py-6 sm:px-6 md:px-12 md:pt-12 md:pb-20">
            <div className="mx-auto flex max-w-[960px] flex-col gap-4 sm:gap-6">
              <section aria-labelledby="gaming-title" className={cardClass}>
                <h2 id="gaming-title" className={`${titleClass} mb-5`}>
                  {t("gaming_title")}
                </h2>
                <GamingAccounts ludoyaUsername={member.ludoya_username} bggUsername={member.bgg_username} />
              </section>

              <MemberDataCard
                email={profile.email}
                firstName={member.first_name}
                lastName={member.last_name}
                postalCode={member.postal_code}
                dni={maskEncrypted(member.dni_nie_encrypted, maskDni)}
                phone={maskEncrypted(member.phone_encrypted, maskPhone)}
              />

              <section aria-labelledby="comms-title" className={`${cardClass} flex flex-col gap-4`}>
                <h2 id="comms-title" className={titleClass}>
                  {t("comms_title")}
                </h2>
                <NewsletterSwitch initialValue={member.newsletter_accepted} />
              </section>

              <section aria-labelledby="account-title" className={`${cardClass} flex flex-col gap-5`}>
                <h2 id="account-title" className={titleClass}>
                  {t("account_title")}
                </h2>
                <AccountActions email={profile.email} memberNumber={member.member_number} />
              </section>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 bg-brand-beige px-6 pt-40 pb-20">
          <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
            {t("load_error")}
          </div>
        </div>
      )}

      <Footer />
      <ScrollToTop />
    </main>
  );
}

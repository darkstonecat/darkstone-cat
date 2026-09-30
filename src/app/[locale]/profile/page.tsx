import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import { getProfileData } from "@/lib/supabase/auth";
import { getMemberBadges } from "@/lib/supabase/badges";
import { buildProfileChecklist } from "@/lib/profile/completion";
import { buildBadgeItems } from "@/lib/member-home/badge-items";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import HomeHero from "@/components/profile/HomeHero";
import ProfileChecklist from "@/components/profile/ProfileChecklist";
import BadgesSection from "@/components/profile/BadgesSection";
import SessionsSection from "@/components/profile/SessionsSection";
import CalendarSection from "@/components/profile/CalendarSection";
import { parseMonthParam } from "@/lib/member-home/month-grid";

export const revalidate = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/profile");
  return {
    title: t("profile_title"),
    description: t("profile_description"),
    alternates,
    robots: { index: false, follow: false },
    openGraph: {
      title: t("profile_title"),
      description: t("profile_description"),
      url: alternates.canonical,
    },
  };
}

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const { locale } = await params;
  // `?month=YYYY-MM` picks the calendar month; invalid or out-of-range values fall back to the current one.
  const month = parseMonthParam((await searchParams).month, new Date());

  // Auth protection is handled by middleware (PROTECTED_ROUTES).
  // Do NOT redirect to /login here — it creates a loop when the middleware
  // and server component disagree about session state (cookie propagation race).
  const [profile, badges] = await Promise.all([getProfileData(), getMemberBadges()]);
  const member = profile?.member ?? null;

  const tNav = await getTranslations({ locale, namespace: "nav" });
  const t = await getTranslations({ locale, namespace: "metadata" });
  const tHome = await getTranslations({ locale, namespace: "profile.home" });
  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("profile"), path: "/profile" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(locale, "/profile", t("profile_title"), t("profile_description"));

  const checklist = profile
    ? buildProfileChecklist({ emailConfirmed: profile.emailConfirmed, member: profile.member })
    : [];
  const checklistVisible = checklist.some((step) => !step.done);

  return (
    <main id="main-content" className="relative flex min-h-screen flex-col font-sans selection:bg-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd]) }}
      />
      <NavBar />

      {member ? (
        <>
          <HomeHero
            firstName={member.first_name}
            lastName={member.last_name}
            memberNumber={member.member_number}
            membershipStartDate={member.membership_start_date}
          />

          <div className="flex-1 bg-brand-beige px-4 py-6 md:px-12 md:pt-12 md:pb-20">
            <div className="mx-auto flex max-w-[1120px] flex-col gap-5 md:gap-7">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3 md:gap-6">
                {checklistVisible && <ProfileChecklist steps={checklist} />}
                <BadgesSection
                  items={buildBadgeItems(badges)}
                  className={checklistVisible ? "md:col-span-2" : "md:col-span-3"}
                />
              </div>
              <SessionsSection />
              <CalendarSection month={month} />
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 bg-brand-beige px-6 pt-40 pb-20">
          <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
            {tHome("load_error")}
          </div>
        </div>
      )}

      <Footer />
      <ScrollToTop />
    </main>
  );
}

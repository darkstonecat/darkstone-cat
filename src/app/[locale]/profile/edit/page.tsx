import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import { getProfileData } from "@/lib/supabase/auth";
import { decrypt } from "@/lib/encryption";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import AuthHero from "@/components/auth/AuthHero";
import ProfileEditForm from "@/components/profile/ProfileEditForm";

export const revalidate = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/profile/edit");
  return {
    title: t("profile_edit_title"),
    description: t("profile_edit_description"),
    alternates,
    robots: { index: false, follow: false },
    openGraph: {
      title: t("profile_edit_title"),
      description: t("profile_edit_description"),
      url: alternates.canonical,
    },
  };
}

export default async function ProfileEditPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const profile = await getProfileData();

  const tNav = await getTranslations({ locale, namespace: "nav" });
  const t = await getTranslations({ locale, namespace: "metadata" });
  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("profile"), path: "/profile" },
    { name: tNav("profile_edit"), path: "/profile/edit" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(locale, "/profile/edit", t("profile_edit_title"), t("profile_edit_description"));

  if (!profile) {
    return (
      <main id="main-content" className="relative flex min-h-screen flex-col font-sans selection:bg-stone-300">
        <NavBar />
        <AuthHero titleKey="edit_title" subtitleKey="edit_subtitle" namespace="profile" />
        <section className="flex-1 bg-brand-beige pb-20">
          <div className="container mx-auto max-w-4xl px-6 pt-16">
            <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
              Could not load profile data. Please try refreshing the page.
            </div>
          </div>
        </section>
        <Footer />
        <ScrollToTop />
      </main>
    );
  }

  const { email, member } = profile;

  let phone: string | null = null;
  let dni: string | null = null;

  if (member.phone_encrypted) {
    try {
      phone = decrypt(member.phone_encrypted, member.id);
    } catch {
      phone = null;
    }
  }

  if (member.dni_nie_encrypted) {
    try {
      dni = decrypt(member.dni_nie_encrypted, member.id);
    } catch {
      dni = null;
    }
  }

  return (
    <main id="main-content" className="relative flex min-h-screen flex-col font-sans selection:bg-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd]) }}
      />
      <NavBar />
      <AuthHero titleKey="edit_title" subtitleKey="edit_subtitle" namespace="profile" />

      <section className="flex-1 bg-brand-beige pb-20">
        <div className="container mx-auto max-w-4xl px-6 pt-16">
          <ProfileEditForm
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
          />
        </div>
      </section>

      <Footer />
      <ScrollToTop />
    </main>
  );
}

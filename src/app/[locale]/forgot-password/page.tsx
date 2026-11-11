import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd, serializeJsonLd } from "@/lib/seo";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import AuthHero from "@/components/auth/AuthHero";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const revalidate = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/forgot-password");
  return {
    title: t("forgot_password_title"),
    description: t("forgot_password_description"),
    alternates,
    robots: { index: false, follow: false },
    openGraph: {
      title: t("forgot_password_title"),
      description: t("forgot_password_description"),
      url: alternates.canonical,
    },
  };
}

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const t = await getTranslations({ locale, namespace: "metadata" });
  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("forgot_password"), path: "/forgot-password" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(locale, "/forgot-password", t("forgot_password_title"), t("forgot_password_description"));

  return (
    <main id="main-content" className="relative flex min-h-screen flex-col font-sans selection:bg-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd([breadcrumbJsonLd, webPageJsonLd]) }}
      />
      <NavBar />
      <AuthHero titleKey="forgot_title" subtitleKey="forgot_subtitle" />

      <section className="flex-1 bg-brand-beige pb-20">
        <div className="container mx-auto max-w-4xl px-6 pt-16">
          <ForgotPasswordForm />
        </div>
      </section>

      <Footer />
      <ScrollToTop />
    </main>
  );
}

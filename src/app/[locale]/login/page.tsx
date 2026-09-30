import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import AuthHero from "@/components/auth/AuthHero";
import LoginForm from "@/components/auth/LoginForm";
import LoginSignupCard from "@/components/auth/LoginSignupCard";

export const revalidate = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/login");
  return {
    title: t("login_title"),
    description: t("login_description"),
    alternates,
    robots: { index: false, follow: false },
    openGraph: {
      title: t("login_title"),
      description: t("login_description"),
      url: alternates.canonical,
    },
  };
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const t = await getTranslations({ locale, namespace: "metadata" });
  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("login"), path: "/login" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(locale, "/login", t("login_title"), t("login_description"));

  return (
    <main id="main-content" className="relative flex min-h-screen flex-col font-sans selection:bg-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd]) }}
      />
      <NavBar />
      <AuthHero titleKey="login_title" subtitleKey="login_subtitle" />

      <section className="flex-1 bg-brand-beige py-8 md:py-16">
        <div className="mx-auto grid w-full max-w-[1040px] grid-cols-1 gap-6 px-4 md:grid-cols-2 md:gap-10 md:px-12">
          <LoginForm />
          <LoginSignupCard />
        </div>
      </section>

      <Footer />
      <ScrollToTop />
    </main>
  );
}

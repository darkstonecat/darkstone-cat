import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import RegisterFlow from "@/components/auth/RegisterFlow";

export const revalidate = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/register");
  return {
    title: t("register_title"),
    description: t("register_description"),
    alternates,
    robots: { index: false, follow: false },
    openGraph: {
      title: t("register_title"),
      description: t("register_description"),
      url: alternates.canonical,
    },
  };
}

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const t = await getTranslations({ locale, namespace: "metadata" });
  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("register"), path: "/register" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(locale, "/register", t("register_title"), t("register_description"));

  return (
    <main id="main-content" className="relative flex min-h-screen flex-col font-sans selection:bg-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd]) }}
      />
      <NavBar />
      <RegisterFlow />

      <Footer />
      <ScrollToTop />
    </main>
  );
}

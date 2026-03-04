import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import ContactHero from "@/components/contact/ContactHero";
import ContactForm from "@/components/contact/ContactForm";
import ContactInfo from "@/components/contact/ContactInfo";

export const revalidate = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/contact");
  return {
    title: t("contact_title"),
    description: t("contact_description"),
    alternates,
    openGraph: {
      title: t("contact_title"),
      description: t("contact_description"),
      url: alternates.canonical,
      images: [{ url: `${alternates.canonical}/opengraph-image`, width: 1200, height: 630, alt: t("contact_title") }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@darkstonecat",
      creator: "@darkstonecat",
      title: t("contact_title"),
      description: t("contact_description"),
    },
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [tNav, t] = await Promise.all([
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "metadata" }),
  ]);
  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("contact"), path: "/contact" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(locale, "/contact", t("contact_title"), t("contact_description"));

  return (
    <main id="main-content" className="relative flex min-h-screen flex-col font-sans selection:bg-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd]) }}
      />
      <NavBar />
      <ContactHero />

      {/* Content */}
      <section className="flex-1 bg-brand-beige pb-20">
        <div className="container mx-auto grid max-w-4xl gap-16 pt-16 px-6 md:grid-cols-3">
          <ContactForm />
          <ContactInfo />
        </div>
      </section>

      <Footer />
      <ScrollToTop />
    </main>
  );
}

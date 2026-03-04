import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getBreadcrumbJsonLd } from "@/lib/seo";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import ContactHero from "@/components/contact/ContactHero";
import ContactForm from "@/components/contact/ContactForm";
import ContactInfo from "@/components/contact/ContactInfo";

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
    },
    twitter: {
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
  const tNav = await getTranslations({ locale, namespace: "nav" });
  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("contact"), path: "/contact" },
  ]);

  return (
    <main id="main-content" className="relative flex min-h-screen flex-col font-sans selection:bg-stone-300">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
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

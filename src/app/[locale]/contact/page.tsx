import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAlternates, getOgImageUrl, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
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
      images: [{ url: getOgImageUrl(locale), width: 1200, height: 630, alt: t("contact_title") }],
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

// Same limit as the subject field (ContactForm.tsx, src/app/api/contact/route.ts).
const MAX_SUBJECT = 150;

/** `?subject=` prefill (spec V-7, M-2): plain text only, one line, length-limited. */
function prefilledSubject(value: string | string[] | undefined): string | undefined {
  if (typeof value !== "string") return undefined;
  const clean = [...value.replace(/[\u0000-\u001f\u007f]+/g, " ").trim()].slice(0, MAX_SUBJECT).join("");
  return clean || undefined;
}

export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ subject?: string | string[] }>;
}) {
  const { locale } = await params;
  const defaultSubject = prefilledSubject((await searchParams).subject);
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
          <ContactForm defaultSubject={defaultSubject} />
          <ContactInfo />
        </div>
      </section>

      <Footer />
      <ScrollToTop />
    </main>
  );
}

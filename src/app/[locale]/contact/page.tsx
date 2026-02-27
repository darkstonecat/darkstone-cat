import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
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
  return {
    title: t("contact_title"),
    description: t("contact_description"),
  };
}

export default function ContactPage() {
  return (
    <main className="relative flex min-h-screen flex-col font-sans selection:bg-stone-300">
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

import { type Metadata } from "next";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import ContactHero from "@/components/contact/ContactHero";
import ContactForm from "@/components/contact/ContactForm";
import ContactInfo from "@/components/contact/ContactInfo";

export const metadata: Metadata = {
  title: "Contacte — Darkstone Catalunya",
  description:
    "Contacta amb l'Associació Darkstone Catalunya. Escriu-nos per qualsevol dubte o suggeriment.",
};

export default function ContactPage() {
  return (
    <main className="relative min-h-screen font-sans selection:bg-stone-300">
      <NavBar />
      <ContactHero />

      {/* Content */}
      <section className="bg-brand-beige pb-20">
        <div className="container mx-auto grid max-w-4xl gap-16 px-6 md:grid-cols-2">
          <ContactForm />
          <ContactInfo />
        </div>
      </section>

      <Footer />
      <ScrollToTop />
    </main>
  );
}

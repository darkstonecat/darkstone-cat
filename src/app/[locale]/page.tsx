import NavBar from "@/components/NavBar";
import ScrollProgress from "@/components/ScrollProgress";
import PageIntro from "@/components/PageIntro";
import Hero from "@/components/Hero";
import About from "@/components/About";
import Activities from "@/components/Activities";
import Schedule from "@/components/Schedule";
import JoinUs from "@/components/JoinUs";
import Location from "@/components/Location";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";

export default function HomePage() {
  return (
    <main className="relative min-h-screen font-sans selection:bg-stone-300">
        <PageIntro />
        <ScrollProgress />
        <NavBar />
        <Hero />
        <About />
        <Activities />
        <Schedule />
        <JoinUs />
        <Location />
        <Footer />
        <ScrollToTop />
    </main>
  );
}

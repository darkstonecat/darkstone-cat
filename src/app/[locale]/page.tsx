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
import SectionDivider from "@/components/SectionDivider";

export default function HomePage() {
  return (
    <main className="relative min-h-screen font-sans selection:bg-stone-300">
        <PageIntro />
        <ScrollProgress />
        <NavBar />
        <Hero />
        <About />
        <SectionDivider topColor="#EEE8DC" bottomColor="#1C1917" variant="wave" overlap />
        <Activities />
        <Schedule />
        <SectionDivider topColor="#1C1917" bottomColor="#EEE8DC" variant="curve" flip />
        <JoinUs />
        <SectionDivider topColor="#EEE8DC" bottomColor="#1C1917" variant="tilt" />
        <Location />
        <Footer />
        <ScrollToTop />
    </main>
  );
}

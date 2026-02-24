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
        <div className="relative z-10 -mt-[40vh]">
          <SectionDivider topColor="transparent" bottomColor="#1C1917" variant="wave" animated />
          <About />
        </div>
        <div className="relative z-20 -mt-[15vh]">
          <SectionDivider topColor="transparent" bottomColor="#EEE8DC" variant="wave" animated />
          <Activities />
        </div>
        <SectionDivider topColor="#EEE8DC" bottomColor="#1C1917" variant="wave" animated />
        <Schedule />
        <SectionDivider topColor="#1C1917" bottomColor="#EEE8DC" variant="curve" flip />
        <JoinUs />
        <SectionDivider topColor="#EEE8DC" bottomColor="#1C1917" variant="flat" />
        <Location />
        <Footer />
        <ScrollToTop />
    </main>
  );
}

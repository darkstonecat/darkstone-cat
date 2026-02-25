import NavBar from "@/components/NavBar";
import ScrollProgress from "@/components/ScrollProgress";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import Hero from "@/components/home/Hero";
import About from "@/components/home/About";
import Activities from "@/components/home/Activities";
import Schedule from "@/components/home/Schedule";
import JoinUs from "@/components/home/JoinUs";
import Location from "@/components/home/Location";
import SectionDivider from "@/components/home/SectionDivider";

export default function HomePage() {
  return (
    <main className="relative min-h-screen font-sans selection:bg-stone-300">
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
        <Location />
        <Footer />
        <ScrollToTop />
    </main>
  );
}

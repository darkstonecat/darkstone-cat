import { fetchAboutStats } from "@/lib/about-stats";
import AboutStats from "./AboutStats";

/**
 * Server component that loads the /about counts. The page renders it inside a
 * `<Suspense>` boundary, so the rest of the page streams first and the numbers
 * replace the fallback when they arrive.
 */
export default async function AboutStatsLoader() {
  const { gameCount, memberCount } = await fetchAboutStats();
  return <AboutStats gameCount={gameCount} memberCount={memberCount} />;
}

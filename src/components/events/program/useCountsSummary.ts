import { useTranslations } from "next-intl";
import type { ProgramCounts } from "@/lib/events/program";

const PARTS = [
  ["plays", "summary_plays"],
  ["tournaments", "summary_tournaments"],
  ["activities", "summary_activities"],
  ["demos", "summary_demos"],
] as const;

/** "4 partides · 3 tornejos · 2 activitats": only the kinds present, as separate parts. */
export function useCountsSummary() {
  const t = useTranslations("events.program");
  return (counts: ProgramCounts): string[] => PARTS.filter(([key]) => counts[key] > 0).map(([key, message]) => t(message, { count: counts[key] }));
}

"use client";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { scrubAnalyticsEvent } from "@/lib/analytics-scrub";

/** Vercel Web Analytics + Speed Insights with the card verify token scrubbed from every URL. */
export default function VercelMonitoring() {
  return (
    <>
      <Analytics beforeSend={scrubAnalyticsEvent} />
      <SpeedInsights beforeSend={scrubAnalyticsEvent} />
    </>
  );
}

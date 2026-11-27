import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

// Placeholders shown while /events waits for Ludoya (see EventsContent). They
// keep the size of what replaces them; `animate-pulse` stops under reduced motion.

/** One banner-sized block in the dark header (most weeks show at least one special). */
export function BannerSkeleton() {
  return <div aria-hidden="true" className="min-h-24 animate-pulse rounded-[18px] bg-stone-800 sm:min-h-28" />;
}

/** The desktop sidebar calendar card. */
export function CalendarSkeleton() {
  return (
    <div aria-hidden="true" className="hidden flex-col gap-2.5 rounded-[20px] bg-brand-white p-4 lg:flex">
      <div className="mx-auto h-6 w-36 animate-pulse rounded-md bg-stone-200" />
      <div className="grid grid-cols-7 gap-[3px]">
        {Array.from({ length: 42 }, (_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-md bg-stone-100" />
        ))}
      </div>
      <div className="h-4 w-48 animate-pulse rounded bg-stone-100" />
    </div>
  );
}

/** The mobile day strip and three event cards, with the one loading announcement. */
export function TimelineSkeleton() {
  const t = useTranslations("events");
  return (
    <div role="status" className="flex flex-col">
      <span className="sr-only">{t("loading")}</span>
      <div aria-hidden="true" className="mb-7 flex gap-2 overflow-hidden lg:hidden">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="h-20 w-16 shrink-0 animate-pulse rounded-2xl bg-stone-white-base/70" />
        ))}
      </div>
      <div aria-hidden="true" className="mb-3 h-5 w-40 animate-pulse rounded bg-stone-white-base/70" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          aria-hidden="true"
          className={cn("mb-4 animate-pulse rounded-[22px] bg-stone-white-base/60", i === 0 ? "h-72" : "h-36")}
        />
      ))}
    </div>
  );
}

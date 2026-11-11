import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  CHAIRS_MAX_DESKTOP,
  CHAIRS_MAX_MOBILE,
  seatCounter,
  type SeatInput,
  type SeatKind,
} from "@/lib/events/seat-counter";

const CHAIR_STROKE: Record<Exclude<SeatKind, "taken">, string> = {
  needed: "#B54F00",
  free: "#78716C",
};

const SEGMENT_CLASS: Record<SeatKind, string> = {
  taken: "bg-stone-custom",
  needed: "bg-[#F0C29C]",
  free: "bg-[#BDB7B0]",
};

function Chair({ kind }: { kind: SeatKind }) {
  if (kind === "taken") {
    return (
      <svg data-seat="taken" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" className="shrink-0">
        <path d="M7 3h10v9H7z" fill="#1C1917" />
        <path d="M5 12h14v3H5z" fill="#1C1917" />
        <path d="M6.5 15v6M17.5 15v6" stroke="#1C1917" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg
      data-seat={kind}
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={CHAIR_STROKE[kind]}
      strokeWidth="1.7"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M7 3h10v9H7z" />
      <path d="M5 12h14v3H5z" />
      <path d="M6.5 15v6M17.5 15v6" strokeLinecap="round" />
    </svg>
  );
}

function Chairs({ play, max, variant }: { play: SeatInput; max: number; variant: "mobile" | "desktop" }) {
  const { chairs, truncated } = seatCounter(play, max);
  return (
    <span
      data-chairs={variant}
      className={cn(
        "min-w-0 flex-nowrap items-center gap-px overflow-hidden",
        variant === "mobile" ? "flex md:hidden" : "hidden md:flex"
      )}
    >
      {chairs.map((kind, i) => (
        <Chair key={i} kind={kind} />
      ))}
      {truncated && <span className="px-0.5 text-[15px] leading-none font-extrabold text-stone-600">…</span>}
    </span>
  );
}

function PeopleIcon() {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1C1917" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14.2a5 5 0 0 1 5.5 5" />
    </svg>
  );
}

/**
 * Seat pill on top of a play cover: chairs (up to 8 seats), one segment per
 * seat (9-20), a bar (more) or a people icon (no limit), always on one line
 * with the counter on the right. Screen readers get one label for the whole pill.
 */
export default function SeatPill({ play, className }: { play: SeatInput; className?: string }) {
  const t = useTranslations("events.seats");
  const counter = seatCounter(play, CHAIRS_MAX_DESKTOP);
  const { aria } = counter;

  const label =
    aria.kind === "open"
      ? aria.needed > 0
        ? t("aria_open_needed", { taken: aria.taken, needed: aria.needed })
        : t("aria_open", { taken: aria.taken })
      : aria.needed > 0
        ? t("aria_seats_needed", { taken: aria.taken, capacity: aria.capacity, needed: aria.needed })
        : t("aria_seats", { taken: aria.taken, capacity: aria.capacity });

  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "flex flex-nowrap items-center justify-between gap-1.5 rounded-xl bg-[rgba(250,250,249,0.96)] px-2 py-[5px] whitespace-nowrap text-stone-custom shadow-[0_1px_3px_rgba(28,25,23,0.25)]",
        className
      )}
    >
      {counter.mode === "chairs" && (
        <>
          <Chairs play={play} max={CHAIRS_MAX_MOBILE} variant="mobile" />
          <Chairs play={play} max={CHAIRS_MAX_DESKTOP} variant="desktop" />
        </>
      )}
      {counter.mode === "segments" && (
        <span aria-hidden="true" className="flex flex-1 gap-0.5">
          {counter.segments.map((kind, i) => (
            <span key={i} data-segment={kind} className={cn("h-2.5 flex-1 rounded-[2px]", SEGMENT_CLASS[kind])} />
          ))}
        </span>
      )}
      {counter.mode === "bar" && (
        <span aria-hidden="true" className="flex h-2.5 flex-1 overflow-hidden rounded-full bg-[#BDB7B0]">
          <span data-bar-fill className="h-full bg-stone-custom" style={{ width: `${counter.fillPercent}%` }} />
        </span>
      )}
      {counter.mode === "open" && <PeopleIcon />}
      <strong aria-hidden="true" className="shrink-0 text-sm whitespace-nowrap">
        {counter.capacity === null ? t("count_open", { count: counter.taken }) : `${counter.taken}/${counter.capacity}`}
      </strong>
    </div>
  );
}

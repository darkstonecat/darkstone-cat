import { useTranslations } from "next-intl";
import type { ItemView } from "@/lib/events/agenda-format";
import { CHAIRS_MAX_DESKTOP, seatCounter } from "@/lib/events/seat-counter";
import { cn } from "@/lib/utils";
import SeatPill from "../SeatPill";
import CoverFrame from "./CoverFrame";
import ItemBadge from "./ItemBadge";

type Cta = "join" | "queue" | "tournament" | "tickets" | "info";

function ctaOf(item: ItemView): { cta: Cta; full: boolean } {
  if (item.kind !== "play" && item.kind !== "tournament") return { cta: "info", full: false };
  const { full } = seatCounter(item, CHAIRS_MAX_DESKTOP);
  if (full) return { cta: "queue", full };
  if (item.kind === "tournament") return { cta: item.tickets ? "tickets" : "tournament", full };
  return { cta: "join", full };
}

/**
 * One item of an event's program: a play, a tournament, an activity or a demo.
 * 3:4 cover with the seat pill (plays and tournaments) and the kind badge on
 * top, the time, title and zone on the dark strip, then the Ludoya button.
 * `dark` switches the button colours for the special-event card; `hideZone`
 * drops the zone from the subtitle where a group heading already names it.
 */
export default function ItemCard({ item, dark = false, hideZone = false }: { item: ItemView; dark?: boolean; hideZone?: boolean }) {
  const t = useTranslations("events");
  const { cta, full } = ctaOf(item);
  const seated = item.kind === "play" || item.kind === "tournament";
  const title = item.kind === "play" ? (item.gameName ?? item.title) : item.title;
  // The game name leads (as before); a play's own title and its zone go below it.
  const ownTitle = title !== item.title ? item.title : null;
  const subtitle = [ownTitle, hideZone ? null : item.zone].filter(Boolean).join(" · ") || null;
  const label = { join: t("play.join"), queue: t("play.queue"), tournament: t("program.cta_tournament"), tickets: t("program.cta_tickets"), info: t("program.cta_info") }[cta];
  const outlined = full;

  return (
    <li className="flex flex-col gap-2" data-item-kind={item.kind}>
      <CoverFrame
        href={item.ludoyaUrl}
        coverUrl={item.coverUrl}
        title={title}
        time={item.time}
        subtitle={subtitle}
        sizes="(min-width: 768px) 200px, 45vw"
        top={
          <>
            {seated && <SeatPill play={item} className="self-stretch" />}
            <ItemBadge item={item} />
          </>
        }
      />
      <a
        href={item.ludoyaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex min-h-11 items-center justify-center rounded-xl text-[13px] font-bold transition-colors",
          dark
            ? outlined
              ? "border border-stone-500 text-stone-white-hover hover:bg-white/5"
              : "bg-stone-white-hover text-stone-custom hover:bg-white"
            : outlined
              ? "border border-stone-400 text-stone-custom hover:bg-stone-custom/5"
              : "bg-stone-custom text-white hover:bg-stone-800"
        )}
      >
        {label}
        <span aria-hidden="true">&nbsp;↗</span>
        <span className="sr-only"> {t("program.item_new_tab", { title })}</span>
      </a>
    </li>
  );
}

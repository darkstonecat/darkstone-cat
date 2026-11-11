import Image from "next/image";
import { useTranslations } from "next-intl";
import { MdOutlineCasino } from "react-icons/md";
import { cn } from "@/lib/utils";
import type { AgendaPlay } from "@/lib/events/agenda-view";
import { CHAIRS_MAX_DESKTOP, seatCounter } from "@/lib/events/seat-counter";
import SeatPill from "./SeatPill";

/**
 * One play of a session: 3:4 cover with the seat pill on top and the time and
 * game on a dark strip, then the status line and the Ludoya sign-up link.
 * `time` comes formatted from the server (Node and browser ICU can differ).
 */
export default function PlayCard({ play, time }: { play: AgendaPlay; time: string }) {
  const tSeats = useTranslations("events.seats");
  const tPlay = useTranslations("events.play");
  const { status, full } = seatCounter(play, CHAIRS_MAX_DESKTOP);

  const statusText =
    status.kind === "needed" || status.kind === "free"
      ? tSeats(`status_${status.kind}`, { count: status.count })
      : tSeats(`status_${status.kind}`);

  return (
    <li className="flex flex-col gap-2">
      <div className="relative aspect-[3/4] overflow-hidden rounded-[14px] bg-stone-custom">
        {play.coverUrl ? (
          <Image
            src={play.coverUrl}
            alt=""
            fill
            quality={60}
            sizes="(min-width: 768px) 200px, 45vw"
            className="object-cover"
          />
        ) : (
          <span data-cover-placeholder aria-hidden="true" className="absolute inset-0 flex items-center justify-center text-stone-white-base/50">
            <MdOutlineCasino size={40} />
          </span>
        )}
        <SeatPill play={play} className="absolute top-2 right-2 left-2" />
        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-[3px] bg-[rgba(28,25,23,0.8)] p-2.5 text-stone-white-hover">
          <span className="text-[11px] font-bold text-brand-orange-light">{time}</span>
          <span className="text-sm leading-tight font-extrabold">{play.gameName}</span>
        </div>
      </div>
      <span className={cn("text-xs font-bold", full ? "text-stone-600" : "text-brand-orange-text")}>{statusText}</span>
      <a
        href={play.ludoyaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex min-h-11 items-center justify-center rounded-xl text-[13px] font-bold transition-colors",
          full
            ? "border border-stone-400 text-stone-custom hover:bg-stone-custom/5"
            : "bg-stone-custom text-white hover:bg-stone-800"
        )}
      >
        {full ? tPlay("queue") : tPlay("join")}
        <span aria-hidden="true">&nbsp;↗</span>
        <span className="sr-only"> {tPlay("new_tab", { game: play.gameName })}</span>
      </a>
    </li>
  );
}

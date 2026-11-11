import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Dashed tile that closes an event's grid: propose a play on Ludoya. `first`
 * changes the hint when the event has no plays yet.
 */
export default function ProposeTile({ href, first, dark = false }: { href: string; first: boolean; dark?: boolean }) {
  const t = useTranslations("events");
  return (
  <li className="flex flex-col gap-2">
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      // Hover and keyboard focus share one look: solid orange border, tinted fill, bigger "+".
      className={cn(
        "group flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-[14px] border-2 border-dashed p-3 text-center transition-colors",
        "hover:border-solid hover:border-brand-orange focus-visible:border-solid focus-visible:border-brand-orange",
        dark
          ? "border-stone-600 text-brand-orange-light hover:bg-white/5 focus-visible:bg-white/5"
          : "border-[#E9B98F] text-brand-orange-text hover:bg-brand-orange/5 focus-visible:bg-brand-orange/5"
      )}
    >
      <span
        aria-hidden="true"
        className="text-[32px] font-light transition-transform duration-200 group-hover:scale-125 group-focus-visible:scale-125"
      >
        +
      </span>
      <strong className={cn("text-sm", dark ? "text-stone-white-hover" : "text-stone-custom")}>{t("propose_title")}</strong>
      <span className={cn("text-xs", dark ? "text-stone-white-base" : "text-stone-600")}>{first ? t("propose_hint_first") : t("propose_hint")}</span>
      <span className="sr-only">{t("new_tab")}</span>
    </a>
  </li>
  );
}

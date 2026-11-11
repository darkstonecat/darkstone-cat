import { useTranslations } from "next-intl";
import { MdOutlineEmojiEvents } from "react-icons/md";
import type { ProgramItem } from "@/lib/events/program";
import { cn } from "@/lib/utils";

/**
 * Kind badge on a cover: "Torneig · Sistema suís" (orange), "Activitat",
 * "Demo", or "Partida" (only where plays mix with other kinds, `showPlay`).
 */
export default function ItemBadge({ item, showPlay = false }: { item: ProgramItem; showPlay?: boolean }) {
  const t = useTranslations("events.program");
  if (item.kind === "play" && !showPlay) return null;

  const label =
    item.kind === "tournament"
      ? item.format
        ? t("badge_tournament_format", { format: t(`format.${item.format}`) })
        : t("badge_tournament")
      : t(`badge_${item.kind}`);

  return (
    <span
      data-item-badge={item.kind}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] leading-none font-extrabold",
        item.kind === "tournament" ? "bg-brand-orange text-white" : "bg-[rgba(250,250,249,0.96)] text-stone-custom"
      )}
    >
      {item.kind === "tournament" && <MdOutlineEmojiEvents aria-hidden="true" size={13} />}
      {label}
    </span>
  );
}

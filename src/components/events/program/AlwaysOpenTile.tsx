import { useTranslations } from "next-intl";
import type { ItemView } from "@/lib/events/agenda-format";
import { cn } from "@/lib/utils";
import CoverFrame from "./CoverFrame";
import ItemBadge from "./ItemBadge";

/** A square tile of the always-open block: cover, kind badge and the name as the link. */
export default function AlwaysOpenTile({ item, dark = false }: { item: ItemView; dark?: boolean }) {
  const t = useTranslations("events.program");
  return (
    <li className="flex flex-col gap-1.5" data-item-kind={item.kind}>
      <CoverFrame
        href={item.ludoyaUrl}
        coverUrl={item.coverUrl}
        shape="square"
        sizes="(min-width: 768px) 140px, 30vw"
        top={<ItemBadge item={item} showPlay />}
      />
      <a
        href={item.ludoyaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("text-[13px] leading-tight font-bold hover:underline", dark ? "text-stone-white-hover" : "text-stone-custom")}
      >
        {item.title}
        <span className="sr-only"> {t("item_new_tab", { title: item.title })}</span>
      </a>
    </li>
  );
}

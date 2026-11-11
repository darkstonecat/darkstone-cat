import { useTranslations } from "next-intl";
import { MdOutlineSchedule } from "react-icons/md";
import type { ProgramView } from "@/lib/events/agenda-format";
import { cn } from "@/lib/utils";
import AlwaysOpenTile from "./AlwaysOpenTile";
import CollapsibleSection from "./CollapsibleSection";

/**
 * Items without hours (always-open demos, stands, undated plays), grouped by
 * zone with "other activities" last. Collapsible, open by default.
 */
export default function AlwaysOpenSection({ program, dark = false }: { program: ProgramView; dark?: boolean }) {
  const t = useTranslations("events.program");
  const total = program.alwaysOpen.reduce((sum, group) => sum + group.items.length, 0);
  if (total === 0) return null;

  return (
    <CollapsibleSection
      title={program.multiDay ? t("always_open_event") : t("always_open_day")}
      summary={t("summary_items", { count: total })}
      dark={dark}
    >
      <div className="flex flex-col gap-4">
        <p className="flex flex-wrap items-center gap-2.5 text-[13px]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-white-hover px-3 py-1 font-extrabold text-stone-custom">
            <MdOutlineSchedule aria-hidden="true" size={14} />
            {t("always_open_pill")}
          </span>
          <span className={dark ? "text-stone-400" : "text-stone-600"}>{t("always_open_hint")}</span>
        </p>
        {program.alwaysOpen.map((group) => (
          <div key={group.zone ?? "other"} data-always-open-group className="flex flex-col gap-2.5">
            <p className="flex items-baseline gap-2 text-[15px] font-bold">
              {group.zone ?? t("other_activities")}
              <span className={cn("text-xs font-normal", dark ? "text-stone-400" : "text-stone-600")}>{t("summary_items", { count: group.items.length })}</span>
            </p>
            <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-[repeat(auto-fill,minmax(120px,1fr))]">
              {group.items.map((item) => (
                <AlwaysOpenTile key={item.id} item={item} dark={dark} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </CollapsibleSection>
  );
}

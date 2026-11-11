import { useTranslations } from "next-intl";
import { MdOutlineSchedule } from "react-icons/md";
import type { ProgramView } from "@/lib/events/agenda-format";
import { cn } from "@/lib/utils";
import CollapsibleSection from "./CollapsibleSection";
import { PROGRAM_GRID } from "./grid";
import ItemCard from "./ItemCard";
import ProgramRow from "./ProgramRow";

/**
 * Items without hours (always-open demos, stands, undated plays), grouped by
 * zone with "other activities" last, on the same full cards as the timed items
 * so they weigh the same. When the event goes by start time, each group sits in
 * a row with the always-open mark where the time would be, so its cards keep
 * the size of the timed ones. Collapsible, open by default.
 */
export default function AlwaysOpenSection({ program, dark = false }: { program: ProgramView; dark?: boolean }) {
  const t = useTranslations("events.program");
  const total = program.alwaysOpen.reduce((sum, group) => sum + group.items.length, 0);
  if (total === 0) return null;
  const rows = program.days.some((day) => day.mode === "slots");
  const accent = dark ? "text-brand-orange-light" : "text-brand-orange-text";

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
        {program.alwaysOpen.map((group) => {
          const content = (
            <>
              <p className="flex items-baseline gap-2 text-[15px] font-bold">
                {group.zone ?? t("other_activities")}
                <span className={cn("text-xs font-normal", dark ? "text-stone-400" : "text-stone-600")}>{t("summary_items", { count: group.items.length })}</span>
              </p>
              <ul className={PROGRAM_GRID}>
                {group.items.map((item) => (
                  <ItemCard key={item.id} item={item} dark={dark} hideZone />
                ))}
              </ul>
            </>
          );
          return rows ? (
            <ProgramRow key={group.zone ?? "other"} data-always-open-group asideOnMobile={false} aside={<MdOutlineSchedule aria-hidden="true" size={24} className={accent} />}>
              {content}
            </ProgramRow>
          ) : (
            <div key={group.zone ?? "other"} data-always-open-group className="flex flex-col gap-2.5">
              {content}
            </div>
          );
        })}
      </div>
    </CollapsibleSection>
  );
}

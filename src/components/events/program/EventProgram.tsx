import type { ReactNode } from "react";
import type { ProgramView } from "@/lib/events/agenda-format";
import AlwaysOpenSection from "./AlwaysOpenSection";
import CollapsibleSection from "./CollapsibleSection";
import DayItems from "./DayItems";
import { PROGRAM_GRID } from "./grid";
import { useCountsSummary } from "./useCountsSummary";

/**
 * Everything inside one event, the same for sessions and specials: the timed
 * items (one collapsible section per day for a multi-day event, otherwise the
 * day directly), then the always-open block. `trailing` (the "propose a play"
 * tile) closes the last day, or stands alone when there are no timed items.
 */
export default function EventProgram({ program, dark = false, trailing }: { program: ProgramView; dark?: boolean; trailing?: ReactNode }) {
  const summary = useCountsSummary();
  const lastDay = program.days.length - 1;

  return (
    <div className="flex flex-col gap-4">
      {program.days.length === 0 && trailing && <ul className={PROGRAM_GRID}>{trailing}</ul>}
      {program.multiDay
        ? program.days.map((day, index) => (
            <CollapsibleSection key={day.day} title={day.title} summary={summary(day.counts).join(" · ")} dark={dark}>
              <DayItems day={day} dark={dark} trailing={index === lastDay ? trailing : undefined} />
            </CollapsibleSection>
          ))
        : program.days.map((day, index) => <DayItems key={day.day} day={day} dark={dark} trailing={index === lastDay ? trailing : undefined} />)}
      <AlwaysOpenSection program={program} dark={dark} />
    </div>
  );
}

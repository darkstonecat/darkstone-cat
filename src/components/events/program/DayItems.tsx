import type { ReactNode } from "react";
import type { DayView } from "@/lib/events/agenda-format";
import { cn } from "@/lib/utils";
import { PROGRAM_GRID as GRID } from "./grid";
import ItemCard from "./ItemCard";
import ProgramRow from "./ProgramRow";

/**
 * The timed items of one day: a single grid, or one row per start time in slots
 * mode. `trailing` (the "propose a play" tile) closes the last grid.
 */
export default function DayItems({ day, dark = false, trailing }: { day: DayView; dark?: boolean; trailing?: ReactNode }) {
  if (day.mode === "grid") {
    return (
      <ul className={GRID}>
        {day.groups[0]?.items.map((item) => <ItemCard key={item.id} item={item} dark={dark} />)}
        {trailing}
      </ul>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      {day.groups.map((group, index) => (
        <ProgramRow
          key={group.startsAt}
          data-program-slot
          aside={
            <p className={cn("text-xl font-extrabold", dark ? "text-brand-orange-light" : "text-brand-orange-text")}>
              <time dateTime={group.startsAt ?? undefined}>{group.time}</time>
            </p>
          }
        >
          <ul className={GRID}>
            {group.items.map((item) => <ItemCard key={item.id} item={item} dark={dark} />)}
            {index === day.groups.length - 1 && trailing}
          </ul>
        </ProgramRow>
      ))}
    </div>
  );
}

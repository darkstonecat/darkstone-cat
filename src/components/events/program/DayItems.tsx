import type { ReactNode } from "react";
import type { DayView } from "@/lib/events/agenda-format";
import { cn } from "@/lib/utils";
import ItemCard from "./ItemCard";

const GRID = "grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(170px,1fr))]";

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
        <div key={group.startsAt} data-program-slot className="flex flex-col gap-2.5 sm:flex-row sm:gap-4">
          <p className={cn("shrink-0 text-xl font-extrabold sm:w-16 sm:pt-1", dark ? "text-brand-orange-light" : "text-brand-orange-text")}>
            <time dateTime={group.startsAt ?? undefined}>{group.time}</time>
          </p>
          <ul className={cn(GRID, "min-w-0 flex-1")}>
            {group.items.map((item) => <ItemCard key={item.id} item={item} dark={dark} />)}
            {index === day.groups.length - 1 && trailing}
          </ul>
        </div>
      ))}
    </div>
  );
}

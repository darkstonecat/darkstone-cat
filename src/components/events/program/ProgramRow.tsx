import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A program row: a narrow left column (a start time, or the always-open mark)
 * beside the content. Every row of an event shares it, so the card grids next
 * to it have the same width and the cards the same size. On mobile the column
 * goes on top, or is left out with `asideOnMobile={false}`.
 */
export default function ProgramRow({
  aside,
  asideOnMobile = true,
  children,
  ...data
}: { aside: ReactNode; asideOnMobile?: boolean; children: ReactNode } & Record<`data-${string}`, boolean | undefined>) {
  return (
    <div {...data} className="flex flex-col gap-2.5 sm:flex-row sm:gap-4">
      <div data-program-aside className={cn("shrink-0 sm:block sm:w-16 sm:pt-1", !asideOnMobile && "hidden")}>
        {aside}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">{children}</div>
    </div>
  );
}

"use client";

import { useId, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { MdExpandLess, MdExpandMore } from "react-icons/md";
import { cn } from "@/lib/utils";

interface CollapsibleSectionProps {
  title: ReactNode;
  /** Short line next to the title ("4 partides · 3 tornejos"). */
  summary?: ReactNode;
  defaultOpen?: boolean;
  dark?: boolean;
  children: ReactNode;
}

/**
 * A program section the visitor can fold: a day of a multi-day event or the
 * always-open block. Open by default; the button names the section and says
 * whether it hides or shows it (`aria-expanded`, `aria-controls`).
 */
export default function CollapsibleSection({ title, summary, defaultOpen = true, dark = false, children }: CollapsibleSectionProps) {
  const t = useTranslations("events.program");
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const Icon = open ? MdExpandLess : MdExpandMore;

  return (
    <section className={cn("overflow-hidden rounded-2xl", dark ? "bg-[#231F1D]" : "bg-stone-100")}>
      <h4>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((value) => !value)}
          className="flex min-h-14 w-full cursor-pointer flex-wrap items-center gap-x-2.5 gap-y-0.5 px-3 py-2 text-left sm:px-4"
        >
          <span className="text-[17px] font-extrabold">{title}</span>
          {summary && <span className={cn("text-[13px] font-normal", dark ? "text-stone-400" : "text-stone-600")}>{summary}</span>}
          <span className={cn("ml-auto inline-flex items-center gap-1 text-[13px] font-bold", dark ? "text-stone-white-base" : "text-stone-600")}>
            {open ? t("hide") : t("show")}
            <Icon aria-hidden="true" size={18} />
          </span>
        </button>
      </h4>
      <div id={panelId} hidden={!open} className="px-2.5 pt-1 pb-3 sm:px-4 sm:pb-4">
        {children}
      </div>
    </section>
  );
}

import type { ReactNode } from "react";
import { MdInfoOutline, MdLock, MdWarningAmber } from "react-icons/md";
import { cn } from "@/lib/utils";

export type NoticeKind = "info" | "warning" | "blocked";

const STYLES: Record<NoticeKind, string> = {
  info: "bg-stone-custom/5 text-stone-custom",
  warning: "bg-amber-100 text-amber-900",
  blocked: "bg-brand-red/6 text-red-900",
};

const ICONS = { info: MdInfoOutline, warning: MdWarningAmber, blocked: MdLock } as const;

/** Banner with a leading icon: the meaning never relies on colour alone. `blocked` is announced as an alert. */
export default function Notice({
  kind = "info",
  children,
  className,
}: {
  kind?: NoticeKind;
  children: ReactNode;
  className?: string;
}) {
  const Icon = ICONS[kind];
  return (
    <div
      data-kind={kind}
      role={kind === "blocked" ? "alert" : undefined}
      className={cn("flex items-start gap-3 rounded-xl px-4 py-3.5 text-sm", STYLES[kind], className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

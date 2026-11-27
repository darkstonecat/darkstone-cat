import type { ReactNode } from "react";
import { MdCheckCircleOutline, MdErrorOutline } from "react-icons/md";
import { cn } from "@/lib/utils";

type NoticeKind = "success" | "error";

const STYLES: Record<NoticeKind, string> = {
  success: "bg-emerald-50 text-emerald-900",
  error: "bg-brand-red/6 text-red-900",
};

/** Visible result of a member action: a tinted box with an icon, so the meaning never relies on colour. */
export function NoticeBox({
  kind,
  children,
  testId,
  className,
}: {
  kind: NoticeKind;
  children: ReactNode;
  testId?: string;
  className?: string;
}) {
  const Icon = kind === "success" ? MdCheckCircleOutline : MdErrorOutline;
  return (
    <div
      data-testid={testId}
      data-kind={kind}
      className={cn("flex items-start gap-3 rounded-xl px-4 py-3.5 text-sm leading-relaxed", STYLES[kind], className)}
    >
      <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

/**
 * Feedback right under the buttons that triggered it. Both live regions stay mounted, so
 * screen readers register them before their content appears: success is announced politely,
 * an error as an alert. Empty regions take no space.
 */
export default function ActionNotice({
  success,
  error,
  testId,
}: {
  success?: ReactNode;
  error?: ReactNode;
  testId?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div aria-live="polite">
        {success ? (
          <NoticeBox kind="success" testId={testId}>
            {success}
          </NoticeBox>
        ) : null}
      </div>
      <div role="alert">
        {error ? (
          <NoticeBox kind="error" testId={testId ? `${testId}-error` : undefined}>
            {error}
          </NoticeBox>
        ) : null}
      </div>
    </div>
  );
}

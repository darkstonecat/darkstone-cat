import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type LiveMessagesProps = {
  /** Non-urgent feedback (saved, checking...). Announced politely. */
  status?: ReactNode;
  /** Failure feedback. Announced assertively. */
  error?: ReactNode;
  statusClassName?: string;
  errorClassName?: string;
  className?: string;
};

/**
 * Two live regions that are always mounted, so screen readers register them
 * before their text changes: a polite one for status, an alert for errors.
 * Both share one grid cell and reserve two lines of height, so showing or
 * clearing a message never resizes the surrounding card.
 */
export default function LiveMessages({
  status,
  error,
  statusClassName,
  errorClassName,
  className,
}: LiveMessagesProps) {
  return (
    <div className={cn("grid min-h-10 *:col-start-1 *:row-start-1", className)}>
      <p aria-live="polite" className={cn("text-[13px]", status ? statusClassName : undefined)}>
        {status}
      </p>
      <p role="alert" className={cn("text-[13px] font-medium", error ? errorClassName : undefined)}>
        {error}
      </p>
    </div>
  );
}

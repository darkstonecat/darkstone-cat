"use client";

import { useId, type ButtonHTMLAttributes } from "react";
import { adminButtonClass, type AdminButtonVariant } from "./adminButtons";

type ReasonButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className"> & {
  variant?: AdminButtonVariant;
  /** Visible explanation shown (and linked with aria-describedby) while the button is disabled. */
  reason: string;
  className?: string;
};

/** "Disabled button with reason": the reason is plain text under the button, never only a tooltip. */
export default function ReasonButton({
  variant = "secondary",
  reason,
  disabled,
  className,
  children,
  ...rest
}: ReasonButtonProps) {
  const reasonId = useId();
  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        {...rest}
        disabled={disabled}
        aria-describedby={disabled ? reasonId : undefined}
        className={adminButtonClass(variant, className)}
      >
        {children}
      </button>
      {disabled && (
        <p id={reasonId} className="text-[13px] text-stone-custom/65">
          {reason}
        </p>
      )}
    </div>
  );
}

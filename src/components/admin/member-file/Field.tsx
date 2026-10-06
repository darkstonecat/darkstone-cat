import type { ReactNode } from "react";

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs text-stone-custom/65">{label}</dt>
      <dd className="break-words text-base text-stone-custom">{children}</dd>
      {hint && <p className="text-xs text-stone-custom/65">{hint}</p>}
    </div>
  );
}

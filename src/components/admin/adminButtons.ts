import { cn } from "@/lib/utils";

export type AdminButtonVariant = "primary" | "secondary" | "danger";

/** Mockup button styles (README §4: primary dark, secondary outlined, destructive red). 44 px touch target. */
export function adminButtonClass(variant: AdminButtonVariant, className?: string) {
  return cn(
    "inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold transition-colors",
    "disabled:cursor-not-allowed disabled:opacity-50",
    variant === "primary" && "bg-stone-custom text-brand-white enabled:hover:bg-stone-custom/85",
    variant === "danger" && "bg-brand-red text-brand-white enabled:hover:bg-brand-red/90",
    variant === "secondary" &&
      "border border-stone-custom/15 bg-brand-white text-stone-custom enabled:hover:bg-stone-custom/5",
    className,
  );
}

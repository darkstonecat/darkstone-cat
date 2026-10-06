import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export type StatusChipKind =
  | "active"
  | "left"
  | "valid"
  | "invalid"
  | "error"
  | "board"
  | "superadmin";

const LIGHT: Record<StatusChipKind, string> = {
  active: "bg-green-100 text-green-700",
  valid: "bg-green-100 text-green-700",
  left: "bg-stone-custom/7 text-stone-custom/80",
  invalid: "bg-stone-custom/7 text-stone-custom/80",
  error: "bg-brand-red/10 text-brand-red",
  board: "bg-brand-orange/12 text-brand-orange-text",
  superadmin: "bg-stone-custom text-brand-white",
};

/** Chips on the dark member header; kinds not listed fall back to the light style. */
const DARK: Partial<Record<StatusChipKind, string>> = {
  active: "bg-green-500/18 text-green-300",
  valid: "bg-green-500/18 text-green-300",
  board: "bg-brand-orange-light/20 text-brand-orange-light",
  superadmin: "bg-brand-white text-stone-custom",
};

type StatusChipProps = {
  kind: StatusChipKind;
  /** Overrides the default text, e.g. "Baixa des de 5/10/2026". The text always carries the state. */
  label?: string;
  /** Style for the dark header background. */
  onDark?: boolean;
  className?: string;
};

export default function StatusChip({ kind, label, onDark = false, className }: StatusChipProps) {
  const t = useTranslations("admin");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold",
        (onDark && DARK[kind]) || LIGHT[kind],
        className,
      )}
    >
      {label ?? t(`chip_${kind}`)}
    </span>
  );
}

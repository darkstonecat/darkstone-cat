import { BADGE_ICONS } from "@/components/badges/badgeIcons";
import type { BadgeIconKey } from "@/lib/badges/catalogue";
import { cn } from "@/lib/utils";

type BadgeCircleProps = {
  icon: BadgeIconKey;
  /** `earned` and `locked` look like "Les teves insígnies"; `auto` marks the derived tenure badge. */
  look?: "earned" | "locked" | "auto";
  size?: "md" | "lg";
  className?: string;
};

/** The member-side badge circle (`BadgesSection`), in the two sizes the admin screens use. Decorative. */
export default function BadgeCircle({ icon, look = "earned", size = "md", className }: BadgeCircleProps) {
  const Icon = BADGE_ICONS[icon] ?? BADGE_ICONS.star;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full",
        size === "lg" ? "size-[72px]" : "size-14",
        look === "earned" &&
          (size === "lg"
            ? "bg-stone-custom text-brand-orange-light shadow-[0_0_0_4px_var(--color-brand-white),0_0_0_6px_var(--color-brand-orange)]"
            : "bg-stone-custom text-brand-orange-light shadow-[0_0_0_3px_var(--color-brand-white),0_0_0_5px_var(--color-brand-orange)]"),
        look === "locked" && "border-2 border-dashed border-stone-custom/30 text-stone-custom/45",
        look === "auto" && "bg-brand-beige text-stone-custom",
        className,
      )}
    >
      <Icon size={size === "lg" ? 32 : 26} />
    </span>
  );
}

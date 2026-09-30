import { useTranslations } from "next-intl";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export type MemberTab = "home" | "details" | "card";

const TABS: { key: MemberTab; href: "/profile" | "/profile/details" | "/profile/card"; label: string }[] = [
  { key: "home", href: "/profile", label: "tab_home" },
  { key: "details", href: "/profile/details", label: "tab_details" },
  { key: "card", href: "/profile/card", label: "tab_card" },
];

/** Sub-navigation of the member area (Inici / Perfil / Carnet), shown inside the dark hero. */
export default function MemberTabs({ active, className }: { active: MemberTab; className?: string }) {
  const t = useTranslations("profile");

  return (
    <nav aria-label={t("tabs_label")} className={className}>
      <ul className="flex flex-wrap gap-2">
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full px-[18px] text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-brand-white text-stone-custom"
                    : "border border-brand-white/20 text-brand-white hover:bg-brand-white/10"
                )}
              >
                {t(tab.label)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

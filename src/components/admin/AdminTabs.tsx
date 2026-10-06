"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export type AdminTabKey = "overview" | "members" | "activity" | "procedures" | "tools" | "roles";

type AdminTab = { key: AdminTabKey; href: string; superadminOnly?: boolean };

/** Order as in the mockups (README §4): Resum, Socis, Activitat, Procediments, Eines, Rols. */
export const ADMIN_TABS: readonly AdminTab[] = [
  { key: "overview", href: "/admin" },
  { key: "members", href: "/admin/members" },
  { key: "activity", href: "/admin/activity" },
  { key: "procedures", href: "/admin/procedures" },
  { key: "tools", href: "/admin/tools" },
  { key: "roles", href: "/admin/roles", superadminOnly: true },
];

export function visibleAdminTabs(isSuperadmin: boolean) {
  return ADMIN_TABS.filter((tab) => !tab.superadminOnly || isSuperadmin);
}

/** The tab a path belongs to (nested paths such as a member file belong to their section). */
export function activeAdminTab(pathname: string): AdminTabKey | null {
  const match = ADMIN_TABS.filter((tab) =>
    tab.href === "/admin" ? pathname === "/admin" : pathname === tab.href || pathname.startsWith(`${tab.href}/`),
  );
  return match.length ? match[match.length - 1].key : null;
}

/**
 * Pill tabs of the admin panel. Board members see five, superadmins six (Rols).
 * Desktop: one equal-width row; mobile: three columns, two rows (README §5).
 */
export default function AdminTabs({ isSuperadmin }: { isSuperadmin: boolean }) {
  const t = useTranslations("admin");
  const pathname = usePathname();
  const active = activeAdminTab(pathname);
  const tabs = visibleAdminTabs(isSuperadmin);

  return (
    <nav aria-label={t("tabs_label")} className="mt-8">
      <ul
        className={cn(
          "grid w-full grid-cols-3 gap-2",
          isSuperadmin ? "md:w-[780px] md:grid-cols-6" : "md:w-[650px] md:grid-cols-5",
        )}
      >
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex min-h-11 w-full items-center justify-center rounded-full px-2 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-brand-white text-stone-custom"
                    : "border border-brand-white/20 text-brand-white hover:bg-brand-white/10",
                )}
              >
                {t(`tab_${tab.key}`)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

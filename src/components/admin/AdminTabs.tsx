"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/routing";
import { cn } from "@/lib/utils";

export type AdminTabKey = "overview" | "members" | "activity" | "badges" | "benefits" | "procedures" | "tools" | "roles";

type AdminTab = { key: AdminTabKey; href: string; superadminOnly?: boolean };

/**
 * Order as in the mockups (README §4, badge catalogue S7.1, member benefits S7): Resum, Socis,
 * Activitat, Insígnies, Beneficis, Procediments, Eines, Rols.
 */
export const ADMIN_TABS: readonly AdminTab[] = [
  { key: "overview", href: "/admin" },
  { key: "members", href: "/admin/members" },
  { key: "activity", href: "/admin/activity" },
  { key: "badges", href: "/admin/badges" },
  { key: "benefits", href: "/admin/benefits" },
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
 * Pill tabs of the admin panel. Board members see seven, superadmins eight (Rols).
 * Desktop: one equal-width row (from `md` for seven, `lg` for eight); narrower: three columns
 * (README §5), four for superadmins so eight tabs make two full rows.
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
          isSuperadmin
            ? "grid-cols-4 lg:w-[1040px] lg:max-w-full lg:grid-cols-8"
            : "md:w-[910px] md:max-w-full md:grid-cols-7",
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

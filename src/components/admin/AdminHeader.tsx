"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/routing";
import { isSuperadmin } from "@/lib/auth/roles";
import { activeAdminSection } from "./nav/adminNav";
import AdminSectionSwitcher from "./nav/AdminSectionSwitcher";

type AdminHeaderProps = {
  memberName: string;
  /** Raw role of the signed-in member. */
  role: string;
};

/**
 * Compact dark admin header (docs/features/admin-panel/navigation.md §3): eyebrow, the section
 * title and the signed-in line. Below `lg` the section switcher replaces the visible title (the
 * `h1` stays for assistive tech) and the role moves into the eyebrow.
 */
export default function AdminHeader({ memberName, role }: AdminHeaderProps) {
  const t = useTranslations("admin");
  const pathname = usePathname();
  const superadmin = isSuperadmin(role);
  const title = t(`tab_${activeAdminSection(pathname) ?? "overview"}`);
  const roleLabel = t(superadmin ? "role_superadmin" : "role_board");

  return (
    <section className="bg-stone-custom px-4 pt-28 pb-6 text-brand-white sm:px-6 md:pt-[130px] lg:pb-10">
      <div className="mx-auto max-w-[1312px]">
        <p className="text-xs font-bold tracking-[0.2em] text-brand-white/65 uppercase">
          {t("header_eyebrow")}
          <span className="lg:hidden">
            {" · "}
            <span className="text-brand-orange-light">{roleLabel}</span>
          </span>
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight max-lg:sr-only md:text-5xl">{title}</h1>
        <p className="mt-2 hidden text-base text-brand-white/65 lg:block">
          {t("header_signed_in_as")} <strong className="font-semibold text-brand-white">{memberName}</strong>
          {" · "}
          <span className="font-semibold text-brand-orange-light">{roleLabel}</span>
        </p>
        <AdminSectionSwitcher isSuperadmin={superadmin} />
      </div>
    </section>
  );
}

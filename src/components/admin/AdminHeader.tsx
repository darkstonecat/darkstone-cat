"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "@/i18n/routing";
import { isSuperadmin } from "@/lib/auth/roles";
import AdminTabs, { activeAdminTab } from "./AdminTabs";

type AdminHeaderProps = {
  memberName: string;
  /** Raw role of the signed-in member; the legacy `admin` role counts as board. */
  role: string;
};

/** Dark admin header (README §4): eyebrow, view title, "signed in as" line and the tabs. */
export default function AdminHeader({ memberName, role }: AdminHeaderProps) {
  const t = useTranslations("admin");
  const pathname = usePathname();
  const superadmin = isSuperadmin(role);
  const title = t(`tab_${activeAdminTab(pathname) ?? "overview"}`);

  return (
    <section className="bg-stone-custom px-4 pt-32 pb-10 text-brand-white sm:px-6 md:px-12 md:pt-[150px] md:pb-16">
      <div className="mx-auto max-w-[1120px]">
        <p className="text-xs font-bold tracking-[0.2em] text-brand-white/65 uppercase">
          {t("header_eyebrow")}
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight md:text-6xl">{title}</h1>
        <p className="mt-3 text-base text-brand-white/65 md:text-lg">
          {t("header_signed_in_as")}{" "}
          <strong className="font-semibold text-brand-white">{memberName}</strong>
          {" · "}
          <span className="font-semibold text-brand-orange-light">
            {t(superadmin ? "role_superadmin" : "role_board")}
          </span>
        </p>
        <AdminTabs isSuperadmin={superadmin} />
      </div>
    </section>
  );
}

import { useTranslations } from "next-intl";

/** Skeleton while the list loads: same width as the page, a toolbar block and a few rows. */
export default function AdminMembersLoading() {
  const t = useTranslations("admin.members");
  return (
    <div aria-busy="true" className="mx-auto flex max-w-[1120px] flex-col gap-6 px-4 pt-10 sm:px-6 md:pt-16">
      <p className="sr-only" role="status">
        {t("loading")}
      </p>
      <div className="h-40 animate-pulse rounded-2xl bg-brand-white" />
      <div className="flex flex-col gap-px overflow-hidden rounded-2xl bg-brand-white">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-16 animate-pulse bg-stone-custom/5" />
        ))}
      </div>
    </div>
  );
}

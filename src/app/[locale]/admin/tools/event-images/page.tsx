import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MdArrowBack } from "react-icons/md";
import { Link } from "@/i18n/routing";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import { requireRole } from "@/lib/admin/guard";
import { fetchUpcomingEvents } from "@/lib/ludoya";
import EventImagesContent from "@/components/events/EventImagesContent";

export const revalidate = false;

// Provisional path (open decision D-G); /events/images redirects here (next.config.ts).
const PATH = "/admin/tools/event-images";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, PATH);
  return {
    title: t("event_images_title"),
    description: t("event_images_description"),
    alternates,
    robots: { index: false, follow: false },
  };
}

export default async function EventImagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Board members and superadmins only; anyone else gets the 404 page.
  await requireRole("board", PATH);

  const [eventsResult, tNav, tMeta, t] = await Promise.all([
    fetchUpcomingEvents(),
    getTranslations({ locale, namespace: "nav" }),
    getTranslations({ locale, namespace: "metadata" }),
    getTranslations({ locale, namespace: "event_images" }),
  ]);

  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("admin"), path: "/admin" },
    { name: tNav("admin_tools"), path: "/admin/tools" },
    { name: tMeta("event_images_title"), path: PATH },
  ]);
  const webPageJsonLd = getWebPageJsonLd(
    locale,
    PATH,
    tMeta("event_images_title"),
    tMeta("event_images_description")
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd]),
        }}
      />
      <div className="mx-auto flex max-w-[1120px] flex-col gap-2 px-4 pt-10 sm:px-6 md:pt-16">
        <Link
          href="/admin/tools"
          className="inline-flex min-h-11 w-fit items-center gap-1 text-sm font-semibold text-brand-orange-text"
        >
          <MdArrowBack aria-hidden="true" className="size-4" />
          {t("back")}
        </Link>
        <h2 className="text-[22px] font-bold text-stone-custom">{t("title")}</h2>
        <p className="text-stone-custom/80">{t("subtitle")}</p>
      </div>
      <EventImagesContent
        regularEvents={eventsResult.regularEvents}
        specialEvents={eventsResult.specialEvents}
        locale={locale}
      />
    </>
  );
}

import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MdChevronLeft, MdOutlineBadge, MdOutlineFileDownload, MdOutlineQrCode2 } from "react-icons/md";
import { Link } from "@/i18n/routing";
import { getAlternates, getBreadcrumbJsonLd, getWebPageJsonLd } from "@/lib/seo";
import { getCurrentMember } from "@/lib/supabase/auth";
import { buildCardVerifyUrl } from "@/lib/member-card/verify-url";
import { buildQrMatrix } from "@/lib/member-card/qr";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";
import MemberTabs from "@/components/profile/MemberTabs";
import CardFace from "@/components/profile/CardFace";
import CardDownloadButton from "@/components/profile/CardDownloadButton";
import CardQrOverlay from "@/components/profile/CardQrOverlay";
import QrCodeSvg from "@/components/profile/QrCodeSvg";

export const revalidate = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  const alternates = getAlternates(locale, "/profile/card");
  return {
    title: t("profile_card_title"),
    description: t("profile_card_description"),
    alternates,
    robots: { index: false, follow: false },
    openGraph: {
      title: t("profile_card_title"),
      description: t("profile_card_description"),
      url: alternates.canonical,
    },
  };
}

export default async function ProfileCardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Auth protection is handled by middleware (PROTECTED_ROUTES), see /profile.
  const member = await getCurrentMember();

  const tNav = await getTranslations({ locale, namespace: "nav" });
  const tMeta = await getTranslations({ locale, namespace: "metadata" });
  const t = await getTranslations({ locale, namespace: "profile.card" });
  const breadcrumbJsonLd = getBreadcrumbJsonLd(locale, [
    { name: tNav("profile"), path: "/profile" },
    { name: tNav("profile_card"), path: "/profile/card" },
  ]);
  const webPageJsonLd = getWebPageJsonLd(
    locale,
    "/profile/card",
    tMeta("profile_card_title"),
    tMeta("profile_card_description")
  );

  const fullName = member ? `${member.first_name} ${member.last_name}` : "";
  const matrix = member ? buildQrMatrix(buildCardVerifyUrl(member.card_token)) : null;

  const infoCards = [
    { key: "activities", Icon: MdOutlineBadge },
    { key: "qr", Icon: MdOutlineQrCode2 },
    { key: "handy", Icon: MdOutlineFileDownload },
  ] as const;

  return (
    <main id="main-content" className="relative flex min-h-dvh flex-col bg-stone-custom font-sans selection:bg-stone-300 md:bg-transparent">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([breadcrumbJsonLd, webPageJsonLd]) }}
      />
      <NavBar />

      {member && matrix ? (
        <>
          {/* Mobile: focused page (real NavBar kept), portrait card, pinned download */}
          <div className="flex flex-1 flex-col px-5 pt-24 text-brand-white md:hidden">
            <div className="flex items-center justify-between pb-2">
              <Link
                href="/profile"
                aria-label={t("back")}
                className="flex size-11 items-center justify-center rounded-full bg-brand-white/10"
              >
                <MdChevronLeft aria-hidden="true" size={24} />
              </Link>
              <h1 className="text-[17px] font-bold">{t("title")}</h1>
              <span aria-hidden="true" className="size-11" />
            </div>
            <div className="flex flex-col gap-6 pt-5">
              <CardFace
                variant="portrait"
                fullName={fullName}
                memberNumber={member.member_number}
                membershipStartDate={member.membership_start_date}
                qr={<CardQrOverlay matrix={matrix} memberNumber={member.member_number} />}
              />
              <p className="text-center text-sm leading-normal text-brand-white/65">{t("note")}</p>
            </div>
            <div className="sticky bottom-0 mt-auto bg-stone-custom pt-4 pb-6">
              <CardDownloadButton className="[&>button]:w-full" />
            </div>
          </div>

          {/* Desktop: dark hero with tilted landscape card */}
          <section className="hidden bg-stone-custom px-12 pt-32 pb-[72px] text-brand-white md:block">
            <div className="mx-auto flex max-w-[1120px] flex-col items-start justify-between gap-14 xl:flex-row xl:items-center">
              <div className="flex flex-col gap-3.5">
                <p className="text-[13px] font-semibold tracking-[0.3em] text-brand-white/65 uppercase">{t("eyebrow")}</p>
                <h1 className="text-5xl font-bold tracking-tight lg:text-6xl">{t("title")}</h1>
                <p className="max-w-[440px] text-lg leading-normal text-brand-white/65">{t("intro")}</p>
                <MemberTabs active="card" className="pt-2.5" />
                <CardDownloadButton className="mt-5 self-start" />
              </div>
              <div className="self-center py-4">
                <CardFace
                  variant="landscape"
                  className="-rotate-2"
                  fullName={fullName}
                  memberNumber={member.member_number}
                  membershipStartDate={member.membership_start_date}
                  qr={
                    <div className="shrink-0 rounded-xl bg-brand-white p-2">
                      <QrCodeSvg
                        matrix={matrix}
                        quiet={1}
                        label={t("qr_alt", { number: member.member_number })}
                        className="size-[150px]"
                      />
                    </div>
                  }
                />
              </div>
            </div>
          </section>

          <section className="hidden flex-1 bg-brand-beige px-12 pt-12 pb-[72px] md:block">
            <div className="mx-auto grid max-w-[1120px] grid-cols-3 gap-6">
              {infoCards.map(({ key, Icon }) => (
                <div key={key} className="flex flex-col gap-3 rounded-2xl bg-brand-white p-7">
                  <Icon aria-hidden="true" size={22} className="text-brand-orange-text" />
                  <h2 className="text-lg font-bold text-stone-custom">{t(`info_${key}_title`)}</h2>
                  <p className="text-sm leading-relaxed text-stone-custom/70">{t(`info_${key}_text`)}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        <div className="flex-1 bg-brand-beige px-6 pt-40 pb-20">
          <div className="mx-auto max-w-2xl rounded-xl border border-red-200 bg-red-50 px-6 py-4 text-sm text-red-700">
            {t("load_error")}
          </div>
        </div>
      )}

      <div className="hidden md:block">
        <Footer />
      </div>
      <ScrollToTop />
    </main>
  );
}

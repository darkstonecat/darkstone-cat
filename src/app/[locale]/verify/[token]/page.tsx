import { type Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MdCancel, MdCheckCircle } from "react-icons/md";
import { Link } from "@/i18n/routing";
import { verifyCardToken } from "@/lib/supabase/verify-card";
import NavBar from "@/components/NavBar";
import Footer from "@/components/Footer";
import ScrollToTop from "@/components/ScrollToTop";

// Always evaluated per request: a regenerated token or a removed member must stop verifying at once.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });
  // No canonical/alternates/openGraph url: the path contains the card token.
  return {
    title: t("verify_title"),
    description: t("verify_description"),
    robots: { index: false, follow: false },
  };
}

export default async function VerifyCardPage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>;
}) {
  const { locale, token } = await params;
  const t = await getTranslations({ locale, namespace: "verify" });
  const result = await verifyCardToken(token);

  return (
    <main id="main-content" className="relative flex min-h-dvh flex-col font-sans selection:bg-stone-300">
      <NavBar />

      <section className="bg-stone-custom px-4 pt-32 pb-12 text-brand-white sm:px-6 md:px-12">
        <div className="mx-auto flex max-w-[960px] flex-col gap-3.5">
          <p className="text-[13px] font-semibold tracking-[0.3em] text-brand-white/65 uppercase">{t("eyebrow")}</p>
          <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
            {result.valid ? t("valid_title") : t("invalid_title")}
          </h1>
        </div>
      </section>

      <section className="flex-1 bg-brand-beige px-4 py-10 sm:px-6 md:px-12 md:pb-20">
        <div className="mx-auto flex max-w-[960px] flex-col gap-6">
          <div className="flex items-start gap-4 rounded-2xl bg-brand-white p-6 sm:p-8">
            {result.valid ? (
              <MdCheckCircle aria-hidden="true" size={32} className="shrink-0 text-green-700" />
            ) : (
              <MdCancel aria-hidden="true" size={32} className="shrink-0 text-brand-red" />
            )}
            <div className="flex flex-col gap-2">
              {result.valid ? (
                <>
                  <p className="text-sm text-stone-custom/70">{t("valid_text")}</p>
                  <p className="text-lg text-stone-custom">
                    {t("number_label")}{" "}
                    <strong className="font-mono font-bold text-brand-orange-text">{result.memberNumber}</strong>
                  </p>
                </>
              ) : (
                <p className="text-sm leading-relaxed text-stone-custom/70">{t("invalid_text")}</p>
              )}
            </div>
          </div>
          <p className="text-sm leading-relaxed text-stone-custom/70">{t("note")}</p>
          <Link
            href="/"
            className="inline-flex min-h-11 items-center self-start rounded-xl bg-stone-custom px-6 text-sm font-semibold text-brand-white transition-colors hover:bg-stone-custom/90"
          >
            {t("home")}
          </Link>
        </div>
      </section>

      <Footer />
      <ScrollToTop />
    </main>
  );
}

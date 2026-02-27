
import { type Metadata } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import '@/styles/globals.css';
import SmoothScroll from "@/components/SmoothScroll";
import CookieConsentProvider from "@/components/CookieConsentProvider";
import CookieBanner from "@/components/CookieBanner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import GoogleAnalytics from "@/components/GoogleAnalytics";

const localeToOg: Record<string, string> = {
  ca: "ca_ES",
  es: "es_ES",
  en: "en_US",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    title: t("home_title"),
    description: t("home_description"),
    icons: [{ rel: "icon", url: "/favicon.ico" }],
    metadataBase: new URL("https://darkstone.cat"),
    openGraph: {
      title: t("home_og_title"),
      description: t("home_og_description"),
      url: "https://darkstone.cat",
      siteName: "Darkstone Catalunya",
      locale: localeToOg[locale] ?? "ca_ES",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: t("home_og_title"),
      description: t("home_og_description"),
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Darkstone Catalunya",
  alternateName: "Associació de jugadors i jugadores de jocs de taula i rol Darkstone Catalunya",
  url: "https://darkstone.cat",
  logo: "https://darkstone.cat/images/darkstone_logo_768px.png",
  description:
    "Associació sense ànim de lucre dedicada als jocs de taula i jocs de rol a Terrassa.",
  foundingDate: "2024-09-14",
  address: {
    "@type": "PostalAddress",
    streetAddress: "Plaça del Tint, 4",
    addressLocality: "Terrassa",
    addressRegion: "Barcelona",
    postalCode: "08224",
    addressCountry: "ES",
  },
  sameAs: [
    "https://instagram.com/darkstone.cat",
    "https://x.com/darkstonecat",
    "https://t.me/darkstonecat",
    "https://app.ludoya.com/darkstonecat",
  ],
};

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
}) {
  const { locale } = await params;

  if (!['ca', 'es', 'en'].includes(locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <NextIntlClientProvider messages={messages}>
          <SmoothScroll>
            <CookieConsentProvider>
              {children}
              <CookieBanner />
              <GoogleAnalytics />
              <Analytics />
              <SpeedInsights />
            </CookieConsentProvider>
          </SmoothScroll>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

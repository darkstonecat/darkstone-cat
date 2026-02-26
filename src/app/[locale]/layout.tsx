
import { type Metadata } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import '@/styles/globals.css';
import SmoothScroll from "@/components/SmoothScroll";
import CookieConsentProvider from "@/components/CookieConsentProvider";
import CookieBanner from "@/components/CookieBanner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import GoogleAnalytics from "@/components/GoogleAnalytics";

export const metadata: Metadata = {
  title: "Darkstone Catalunya — Associació de jocs de taula i rol",
  description:
    "Associació sense ànim de lucre dedicada als jocs de taula i jocs de rol a Terrassa. Veniu a jugar cada divendres i dissabte!",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  metadataBase: new URL("https://darkstone.cat"),
  openGraph: {
    title: "Darkstone Catalunya",
    description:
      "Associació de jocs de taula i rol a Terrassa. Espai per compartir l'afició, jugar i fomentar la llengua catalana.",
    url: "https://darkstone.cat",
    siteName: "Darkstone Catalunya",
    locale: "ca_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Darkstone Catalunya",
    description:
      "Associació de jocs de taula i rol a Terrassa.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Darkstone Catalunya",
  alternateName: "Associació de jugadors i jugadores de jocs de taula i rol Darkstone Catalunya",
  url: "https://darkstone.cat",
  logo: "https://darkstone.cat/images/darkstone_logo.png",
  description:
    "Associació sense ànim de lucre dedicada als jocs de taula i jocs de rol a Terrassa.",
  foundingDate: "2024-09-14",
  address: {
    "@type": "PostalAddress",
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

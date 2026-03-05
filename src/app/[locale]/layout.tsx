
import { type Metadata } from "next";
import { Suspense } from "react";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import '@/styles/globals.css';
import SmoothScroll from "@/components/SmoothScroll";
import CookieConsentProvider from "@/components/CookieConsentProvider";
import CookieBanner from "@/components/CookieBanner";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import GoogleAnalytics from "@/components/GoogleAnalytics";
import SkipLink from "@/components/SkipLink";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata" });

  return {
    title: {
      default: t("home_title"),
      template: `%s | Darkstone Catalunya`,
    },
    description: t("home_description"),
    icons: [{ rel: "icon", url: "/favicon.ico" }],
    metadataBase: new URL("https://www.darkstone.cat"),
    openGraph: {
      siteName: "Darkstone Catalunya",
      type: "website",
      images: [{
        url: locale === "ca"
          ? "https://www.darkstone.cat/opengraph-image/og"
          : `https://www.darkstone.cat/${locale}/opengraph-image/og`,
        width: 1200,
        height: 630,
        type: "image/png",
      }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@darkstonecat",
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

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

  const [messages, t] = await Promise.all([
    getMessages(),
    getTranslations({ locale, namespace: "metadata" }),
  ]);

  const orgId = "https://www.darkstone.cat/#organization";
  const placeId = "https://www.darkstone.cat/#place";

  const address = {
    "@type": "PostalAddress",
    streetAddress: "Plaça del Tint, 4",
    addressLocality: "Terrassa",
    addressRegion: "Barcelona",
    postalCode: "08224",
    addressCountry: "ES",
  };

  const sameAs = [
    "https://instagram.com/darkstone.cat",
    "https://www.facebook.com/profile.php?id=61560270602862",
    "https://x.com/darkstonecat",
    "https://t.me/darkstonecat",
    "https://app.ludoya.com/darkstonecat",
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        additionalType: "https://schema.org/NGO",
        name: "Darkstone Catalunya",
        alternateName: "Associació de jugadors i jugadores de jocs de taula i rol Darkstone Catalunya",
        url: "https://www.darkstone.cat",
        logo: "https://www.darkstone.cat/images/darkstone_logo_768px.webp",
        image: "https://www.darkstone.cat/images/darkstone_logo_768px.webp",
        description: t("home_description"),
        foundingDate: "2024-09-14",
        email: "darkstone.cat@gmail.com",
        address,
        location: { "@id": placeId },
        sameAs,
        openingHoursSpecification: [
          {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: "Friday",
            opens: "17:00",
            closes: "21:00",
          },
          {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: "Saturday",
            opens: "10:00",
            closes: "14:00",
          },
        ],
      },
      {
        "@type": "Place",
        "@id": placeId,
        name: "Darkstone Catalunya",
        address,
        geo: {
          "@type": "GeoCoordinates",
          latitude: 41.5637,
          longitude: 2.0089,
        },
      },
      {
        "@type": "Event",
        name: `Darkstone Catalunya — ${t("event_friday_name")}`,
        description: t("home_description"),
        startDate: "2024-09-14",
        eventSchedule: {
          "@type": "Schedule",
          repeatFrequency: "P1W",
          byDay: "https://schema.org/Friday",
          startTime: "17:00",
          endTime: "21:00",
        },
        location: { "@id": placeId },
        organizer: { "@id": orgId },
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        isAccessibleForFree: true,
      },
      {
        "@type": "Event",
        name: `Darkstone Catalunya — ${t("event_saturday_name")}`,
        description: t("home_description"),
        startDate: "2024-09-14",
        eventSchedule: {
          "@type": "Schedule",
          repeatFrequency: "P1W",
          byDay: "https://schema.org/Saturday",
          startTime: "10:00",
          endTime: "14:00",
        },
        location: { "@id": placeId },
        organizer: { "@id": orgId },
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        isAccessibleForFree: true,
      },
    ],
  };

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#1C1917" />
        <link rel="preconnect" href="https://cf.geekdo-images.com" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <noscript>
          <div style={{ padding: "1rem", backgroundColor: "#B54F00", color: "#fff", textAlign: "center", fontSize: "0.875rem" }}>
            This site requires JavaScript for interactive features like navigation, filters and forms.
          </div>
        </noscript>
        <NextIntlClientProvider messages={messages}>
          <SmoothScroll>
            <CookieConsentProvider>
              <SkipLink />
              {children}
              <Suspense>
                <CookieBanner />
                <GoogleAnalytics />
                <Analytics />
                <SpeedInsights />
              </Suspense>
            </CookieConsentProvider>
          </SmoothScroll>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

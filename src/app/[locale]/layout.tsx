
import { type Metadata } from "next";
import { Suspense } from "react";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { getOgImageUrl, ORG_ID } from '@/lib/seo';
import { SESSIONS, getSession, VENUE_POSTAL_ADDRESS } from '@/lib/venue';
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
    icons: [{ rel: "icon", url: "/favicon.ico" }],
    metadataBase: new URL("https://www.darkstone.cat"),
    openGraph: {
      siteName: "Darkstone Catalunya",
      type: "website",
      images: [{ url: getOgImageUrl(locale), width: 1200, height: 630, type: "image/png" }],
    },
    twitter: {
      card: "summary_large_image",
      site: "@darkstonecat",
    },
  };
}

// Computed at module level (outside render) — refreshed on each ISR revalidation
const EVENT_END_DATE = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

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

  const orgId = ORG_ID;
  const placeId = "https://www.darkstone.cat/#place";

  const address = VENUE_POSTAL_ADDRESS;

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
        alternateName: "Associació de jocs de taula i rol a Terrassa — Darkstone Catalunya",
        url: "https://www.darkstone.cat",
        logo: "https://www.darkstone.cat/images/darkstone_logo_768px.webp",
        image: "https://www.darkstone.cat/images/darkstone_logo_768px.webp",
        description: t("home_description"),
        foundingDate: "2024-09-14",
        email: "darkstone.cat@gmail.com",
        address,
        location: { "@id": placeId },
        areaServed: {
          "@type": "City",
          name: "Terrassa",
          containedInPlace: {
            "@type": "AdministrativeArea",
            name: "Barcelona",
          },
        },
        knowsLanguage: ["ca", "es", "en"],
        sameAs,
        openingHoursSpecification: SESSIONS.map((session) => ({
          "@type": "OpeningHoursSpecification",
          dayOfWeek: session.schemaDay,
          opens: session.opens,
          closes: session.closes,
        })),
      },
      {
        "@type": "WebSite",
        "@id": "https://www.darkstone.cat/#website",
        name: "Darkstone Catalunya",
        url: "https://www.darkstone.cat",
        publisher: { "@id": orgId },
        inLanguage: ["ca", "es", "en"],
        potentialAction: {
          "@type": "SearchAction",
          target: "https://www.darkstone.cat/ludoteca?q={search_term_string}",
          "query-input": "required name=search_term_string",
        },
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
        endDate: EVENT_END_DATE,
        eventSchedule: {
          "@type": "Schedule",
          repeatFrequency: "P1W",
          byDay: "https://schema.org/Friday",
          startTime: getSession("friday").opens,
          endTime: getSession("friday").closes,
        },
        location: { "@id": placeId },
        organizer: { "@id": orgId },
        performer: { "@id": orgId },
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        image: "https://www.darkstone.cat/images/darkstone_logo_768px.webp",
        url: "https://www.darkstone.cat/events",
        isAccessibleForFree: true,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "EUR",
          availability: "https://schema.org/InStock",
          validFrom: "2024-09-14",
          url: "https://www.darkstone.cat/events",
        },
      },
      {
        "@type": "Event",
        name: `Darkstone Catalunya — ${t("event_saturday_name")}`,
        description: t("home_description"),
        startDate: "2024-09-14",
        endDate: EVENT_END_DATE,
        eventSchedule: {
          "@type": "Schedule",
          repeatFrequency: "P1W",
          byDay: "https://schema.org/Saturday",
          startTime: getSession("saturday").opens,
          endTime: getSession("saturday").closes,
        },
        location: { "@id": placeId },
        organizer: { "@id": orgId },
        performer: { "@id": orgId },
        eventStatus: "https://schema.org/EventScheduled",
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        image: "https://www.darkstone.cat/images/darkstone_logo_768px.webp",
        url: "https://www.darkstone.cat/events",
        isAccessibleForFree: true,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "EUR",
          availability: "https://schema.org/InStock",
          validFrom: "2024-09-14",
          url: "https://www.darkstone.cat/events",
        },
      },
    ],
  };

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#1C1917" />
        <meta name="version" content={`${process.env.NEXT_PUBLIC_BUILD_DATE} | ${process.env.NEXT_PUBLIC_BUILD_VERSION}`} />
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

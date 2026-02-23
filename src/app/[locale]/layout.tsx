
import { type Metadata } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import '@/styles/globals.css';
import SmoothScroll from "@/components/SmoothScroll";

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
        <NextIntlClientProvider messages={messages}>
          <SmoothScroll>
            {children}
          </SmoothScroll>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

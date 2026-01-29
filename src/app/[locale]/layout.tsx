
import { type Metadata } from "next";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import '@/styles/globals.css';
import SmoothScroll from "@/components/SmoothScroll";
import FixedBackground from "@/components/FixedBackground";
import ThemeProvider from "@/components/ThemeProvider";

export const metadata: Metadata = {
  title: "Darkstone Cat",
  description: "Darkstone Catalunya",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
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
        <FixedBackground />
        <NextIntlClientProvider messages={messages}>
          <ThemeProvider>
            <SmoothScroll>
              {children}
            </SmoothScroll>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

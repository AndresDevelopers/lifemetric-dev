/* eslint-disable @next/next/no-page-custom-font */
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import "./globals.css";
import Navigation from "@/components/Navigation";
import ChatWidget from "@/components/ChatWidget";
import { LocaleProvider } from "@/components/providers/LocaleProvider";
import PwaRegistrar from "@/components/PwaRegistrar";
import { getSessionPaciente } from "@/actions/data";
import { resolveAppBaseUrl } from "@/lib/url";
import {
  LOCALE_COOKIE_NAME,
  LOCALE_EXPLICIT_COOKIE_NAME,
  inferLocaleFromRequest,
} from "@/lib/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const appName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || "Lifemetric";
  const faviconUrl = process.env.NEXT_PUBLIC_APP_FAVICON_URL?.trim() || "/favicon.ico";
  const appBaseUrl = resolveAppBaseUrl(process.env.NEXT_PUBLIC_BASE_URL);
  return {
    metadataBase: appBaseUrl,
    title: {
      default: appName,
      template: `%s | ${appName}`,
    },
    description: "Sistema clínico para diabéticos",
    applicationName: appName,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: faviconUrl,
      shortcut: faviconUrl,
      apple: faviconUrl,
    },
    openGraph: {
      images: [{ url: faviconUrl }],
    },
    twitter: {
      images: [faviconUrl],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const locale = inferLocaleFromRequest({
    cookieLocale: cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    explicitCookie: cookieStore.get(LOCALE_EXPLICIT_COOKIE_NAME)?.value,
    acceptLanguage: headerStore.get("accept-language"),
    country: headerStore.get("x-vercel-ip-country") ?? headerStore.get("cf-ipcountry"),
    city: headerStore.get("x-vercel-ip-city") ?? headerStore.get("cf-ipcity"),
  });

  const user = await getSessionPaciente();

  return (
    <html lang={locale} className="antialiased light">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-body min-h-screen flex flex-col md:flex-row bg-[var(--color-surface-container-low)]">
        <LocaleProvider initialLocale={locale}>
          <Navigation userName={user ?? undefined} />
          <main className="flex-1 w-full relative">
            {children}
            {user && <ChatWidget />}
            <PwaRegistrar />
          </main>
        </LocaleProvider>
      </body>
    </html>
  );
}

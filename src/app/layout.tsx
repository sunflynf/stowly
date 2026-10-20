import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Providers } from "@/components/providers/providers";
import { currentThemePreference } from "@/lib/preferences";
import { THEME_TOKENS, themeColor, themeCss } from "@/lib/themes";
import "./globals.css";

const font = Be_Vietnam_Pro({
  variable: "--font-be-vietnam-pro",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("app");
  return {
    title: { default: t("name"), template: `%s · ${t("name")}` },
    description: t("tagline"),
    applicationName: t("name"),
    appleWebApp: { capable: true, title: t("name"), statusBarStyle: "default" },
    icons: {
      icon: [{ url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" }],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const theme = await currentThemePreference();
  return {
    // "auto" follows the device: Stowly teal in light mode, Dark in dark mode.
    themeColor:
      theme === "auto"
        ? [
            { media: "(prefers-color-scheme: light)", color: themeColor("teal") },
            { media: "(prefers-color-scheme: dark)", color: themeColor("dark") },
          ]
        : themeColor(theme),
    colorScheme: theme === "auto" ? "light dark" : THEME_TOKENS[theme].scheme,
    width: "device-width",
    initialScale: 1,
    viewportFit: "cover",
  };
}

const THEME_CSS = themeCss();

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [locale, theme] = await Promise.all([getLocale(), currentThemePreference()]);
  return (
    <html lang={locale} data-theme={theme} className={`${font.variable} h-full antialiased`}>
      <head>
        {/* Theme colours (src/lib/themes.ts), server-rendered so the first paint is right. */}
        <style id="stowly-themes" dangerouslySetInnerHTML={{ __html: THEME_CSS }} />
      </head>
      <body className="min-h-full">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

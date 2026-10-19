import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WifiOff } from "lucide-react";
import { RetryButton } from "./retry-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("offlinePage");
  return { title: t("title") };
}

// Precached by the service worker and shown when a page cannot be loaded offline.
export default async function OfflinePage() {
  const t = await getTranslations("offlinePage");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <WifiOff className="size-10 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      <p className="max-w-sm text-muted-foreground">{t("body")}</p>
      <RetryButton label={t("retry")} />
    </main>
  );
}

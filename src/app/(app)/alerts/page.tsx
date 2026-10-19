import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AlertsPage } from "@/components/alerts/alerts-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("alerts");
  return { title: t("title") };
}

export default function Page() {
  return <AlertsPage />;
}

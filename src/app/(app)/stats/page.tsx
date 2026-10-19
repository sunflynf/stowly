import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SpendingPage } from "@/components/stats/spending-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("stats");
  return { title: t("title") };
}

export default function Page() {
  return <SpendingPage />;
}

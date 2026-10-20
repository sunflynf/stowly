import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { MaintenancePage } from "@/components/maintenance/maintenance-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("maintenance");
  return { title: t("title") };
}

export default function Page() {
  return <MaintenancePage />;
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ImportWizard } from "@/components/import/import-wizard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("importPage");
  return { title: t("title") };
}

export default function ImportPage() {
  return <ImportWizard />;
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { TrashPage } from "@/components/trash/trash-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("trash");
  return { title: t("title") };
}

export default function Page() {
  return <TrashPage />;
}

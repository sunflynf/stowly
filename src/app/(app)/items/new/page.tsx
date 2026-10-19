import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { QuickAdd } from "./quick-add";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("item");
  return { title: t("newTitle") };
}

export default function NewItemPage() {
  return <QuickAdd />;
}

import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SuggestionsPage } from "@/components/suggestions/suggestions-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("suggestions");
  return { title: t("title") };
}

export default function Page() {
  return <SuggestionsPage />;
}

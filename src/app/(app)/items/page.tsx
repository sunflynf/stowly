import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ItemsBrowser } from "@/components/search/items-browser";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("items");
  return { title: t("title") };
}

export default function ItemsPage() {
  return (
    <Suspense>
      <ItemsBrowser />
    </Suspense>
  );
}

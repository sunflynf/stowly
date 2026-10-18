import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ShoppingList } from "@/components/shopping/shopping-list";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("shopping");
  return { title: t("title") };
}

export default function ShoppingPage() {
  return <ShoppingList />;
}

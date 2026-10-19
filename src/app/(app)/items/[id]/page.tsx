import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ItemDetailView } from "./item-detail";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("item");
  return { title: t("detailTitle") };
}

export default async function ItemPage({ params }: PageProps<"/items/[id]">) {
  const { id } = await params;
  return <ItemDetailView id={id} />;
}

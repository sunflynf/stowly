import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EditItem } from "./edit-item";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("item");
  return { title: t("editTitle") };
}

export default async function EditItemPage({ params }: PageProps<"/items/[id]/edit">) {
  const { id } = await params;
  return <EditItem id={id} />;
}

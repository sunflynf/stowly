import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LabelSheet } from "@/components/labels/label-sheet";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("labels");
  return { title: t("title") };
}

export default async function LabelsPage({ searchParams }: PageProps<"/locations/labels">) {
  const { ids } = await searchParams;
  const initial = typeof ids === "string" ? ids.split(",").filter(Boolean).slice(0, 200) : [];
  return <LabelSheet initialIds={initial} />;
}

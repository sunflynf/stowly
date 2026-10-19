import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { WarrantyClaim } from "@/components/documents/warranty-claim";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("documents");
  return { title: t("claimWarranty") };
}

export default async function WarrantyPage({ params }: PageProps<"/items/[id]/warranty">) {
  const { id } = await params;
  return <WarrantyClaim id={id} />;
}

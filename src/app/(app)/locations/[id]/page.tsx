import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LocationDetail } from "@/components/locations/location-detail";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("locations");
  return { title: t("title") };
}

export default async function LocationPage({ params }: PageProps<"/locations/[id]">) {
  const { id } = await params;
  return <LocationDetail id={id} />;
}

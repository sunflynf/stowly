import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LocationsManager } from "@/components/locations/locations-manager";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("locations");
  return { title: t("title") };
}

export default function LocationsPage() {
  return <LocationsManager />;
}

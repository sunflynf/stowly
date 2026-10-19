import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GroupsPage } from "@/components/groups/groups-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("groups");
  return { title: t("title") };
}

export default function Page() {
  return <GroupsPage />;
}

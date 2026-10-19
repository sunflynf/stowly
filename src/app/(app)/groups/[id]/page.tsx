import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GroupDetail } from "@/components/groups/group-detail";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("groups");
  return { title: t("title") };
}

export default async function Page({ params }: PageProps<"/groups/[id]">) {
  const { id } = await params;
  return <GroupDetail id={id} />;
}

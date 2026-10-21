import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoansPage } from "@/components/loans/loans-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("loans");
  return { title: t("pageTitle") };
}

export default function Page() {
  return <LoansPage />;
}

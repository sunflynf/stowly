import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { InsuranceReport } from "@/components/reports/insurance-report";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("insurance");
  return { title: t("title") };
}

export default function Page() {
  return (
    <Suspense>
      <InsuranceReport />
    </Suspense>
  );
}

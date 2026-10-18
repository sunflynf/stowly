"use client";

import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/app-shell/page-header";
import { ItemForm } from "@/components/items/item-form";

export function QuickAdd() {
  const t = useTranslations("item");
  const params = useSearchParams();
  // Allows prefilled links, e.g. from a location: /items/new?location=<id>
  const location = params.get("location") ?? "";
  const name = params.get("name") ?? "";
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("newTitle")} back />
      <ItemForm mode="quick" initial={{ location_id: location, name }} />
    </div>
  );
}

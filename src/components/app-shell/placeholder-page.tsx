"use client";

import { useTranslations } from "next-intl";
import type { NavKey } from "./nav-config";
import { PageHeader } from "./page-header";

export function PlaceholderPage({ titleKey }: { titleKey: NavKey }) {
  const t = useTranslations();
  return (
    <>
      <PageHeader title={t(`nav.${titleKey}`)} />
      <p className="rounded-[var(--radius-lg)] border border-dashed border-input bg-card p-8 text-center text-muted-foreground">
        {t("placeholder.body")}
      </p>
    </>
  );
}

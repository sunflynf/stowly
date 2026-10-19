"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import type { ItemStatus } from "@/lib/status";

export function useStatusLabel() {
  const t = useTranslations("status");
  return (status: ItemStatus, short = false) => {
    const values = { days: status.values.days ?? 0, months: status.values.months ?? 0 };
    if (short && status.key === "warranty_ending") return t("warranty_ending_short", values);
    return t(status.key, values);
  };
}

export function StatusBadge({ status, short, className }: { status: ItemStatus; short?: boolean; className?: string }) {
  const label = useStatusLabel();
  return (
    <Badge tone={status.tone} className={className}>
      {label(status, short)}
    </Badge>
  );
}

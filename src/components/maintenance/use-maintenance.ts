"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { qk } from "@/lib/queries/keys";
import type { IntervalUnit } from "@/lib/validation/maintenance";

/** Tasks, their alerts, dashboard counts and item history all change together. */
export function useInvalidateMaintenance() {
  const qc = useQueryClient();
  return (itemId?: string | null) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.maintenance }),
      qc.invalidateQueries({ queryKey: qk.stats }),
      ...(itemId ? [qc.invalidateQueries({ queryKey: qk.itemEvents(itemId) })] : []),
    ]);
}

/** "Mỗi 3 tháng" / "Every 3 months". */
export function useIntervalLabel() {
  const t = useTranslations("maintenance");
  return (count: number, unit: IntervalUnit) => t("every", { count, unit });
}

"use client";

import { useTranslations } from "next-intl";
import { useFormats } from "@/lib/hooks/use-format";
import type { GroupStats } from "@/lib/queries/groups";
import { cn } from "@/lib/utils";

/** Total vs shared threshold, as text plus a bar (never colour alone). */
export function GroupMeter({ group, className }: { group: GroupStats; className?: string }) {
  const t = useTranslations("groups");
  const f = useFormats();
  const min = group.min_quantity;
  const low = min !== null && group.total <= min;
  const ratio = min ? Math.min(1, group.total / (min * 2)) : 1;
  const unit = group.unit ? ` ${group.unit}` : "";
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-2 text-sm">
        <span className="text-muted-foreground">{t("total")}</span>
        <span className={cn("font-semibold tabular-nums", low && (group.total === 0 ? "text-danger-foreground" : "text-warning-foreground"))}>
          {min !== null
            ? t("totalOf", { total: f.quantity(group.total) + unit, threshold: f.quantity(min) })
            : `${f.quantity(group.total)}${unit} · ${t("noThreshold")}`}
        </span>
      </div>
      {min !== null && (
        <span
          role="meter"
          aria-valuemin={0}
          aria-valuemax={min * 2}
          aria-valuenow={group.total}
          aria-label={t("meter", { name: group.name, total: f.quantity(group.total), threshold: f.quantity(min) })}
          className="mt-1.5 block h-2 overflow-hidden rounded-full bg-muted"
        >
          <span
            className={cn("block h-full rounded-full", !low ? "bg-primary" : group.total === 0 ? "bg-danger-solid" : "bg-warning-solid")}
            style={{ width: `${Math.max(ratio * 100, group.total > 0 ? 4 : 0)}%` }}
          />
        </span>
      )}
    </div>
  );
}

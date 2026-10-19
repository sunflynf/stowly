"use client";

import Link from "next/link";
import { ItemThumb } from "@/components/items/item-thumb";
import { StatusBadge } from "@/components/items/status-badge";
import { replaceMonths, type AlertRow } from "@/lib/queries/alerts";
import { useCategories, useLabels } from "@/lib/queries/taxonomy";
import { alertStatus } from "@/lib/status";

export function useAlertHelpers() {
  const labels = useLabels();
  const { data: categories = [] } = useCategories();
  return {
    status: (a: AlertRow) => alertStatus({ ...a, months: a.kind === "replace_due" ? replaceMonths(a) : null }),
    subtitle: (a: AlertRow) => {
      const category = categories.find((c) => c.id === a.category_id);
      return [labels.path(a.location_path, a.location_path_en), category ? labels.category(category) : ""].filter(Boolean).join(" · ");
    },
  };
}

/** Compact alert row: thumbnail, name, place · category, status badge. */
export function AlertLine({ alert, thumbUrl, short }: { alert: AlertRow; thumbUrl?: string; short?: boolean }) {
  const h = useAlertHelpers();
  return (
    <Link href={`/items/${alert.item_id}`} className="flex min-h-16 items-center gap-3 py-2.5 hover:bg-muted/40">
      <ItemThumb name={alert.name} url={thumbUrl} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{alert.name}</span>
        <span className="block truncate text-sm text-muted-foreground">{h.subtitle(alert)}</span>
      </span>
      <StatusBadge status={h.status(alert)} short={short} />
    </Link>
  );
}

"use client";

import Link from "next/link";
import { useTimeZone, useTranslations } from "next-intl";
import { ItemThumb } from "@/components/items/item-thumb";
import { QuantityStepper } from "@/components/items/quantity-stepper";
import { StatusBadge } from "@/components/items/status-badge";
import { todayIn } from "@/lib/dates";
import { usePhotoUrls } from "@/lib/queries/items";
import type { SearchRow } from "@/lib/queries/search";
import { useCategories, useLabels } from "@/lib/queries/taxonomy";
import { itemStatus } from "@/lib/status";

function useRowHelpers(rows: SearchRow[]) {
  const t = useTranslations("item");
  const labels = useLabels();
  const { data: categories = [] } = useCategories();
  const { data: urls = {} } = usePhotoUrls(rows.map((r) => r.thumb_path));
  const today = todayIn(useTimeZone() ?? "Asia/Ho_Chi_Minh");
  return {
    category: (r: SearchRow) => {
      const c = categories.find((x) => x.id === r.category_id);
      return c ? labels.category(c) : t("fields.noCategory");
    },
    location: (r: SearchRow) => labels.path(r.location_path, r.location_path_en) || "—",
    thumb: (r: SearchRow) => (r.thumb_path ? urls[r.thumb_path] : undefined),
    status: (r: SearchRow) => itemStatus(r, r.alert_kinds, today),
    low: (r: SearchRow) => r.min_quantity !== null && r.quantity <= r.min_quantity,
  };
}

/** Desktop table. */
export function ItemTable({ rows }: { rows: SearchRow[] }) {
  const t = useTranslations("items.columns");
  const h = useRowHelpers(rows);
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="bg-muted/70 text-sm text-muted-foreground">
          <th scope="col" className="px-5 py-3 font-medium">{t("item")}</th>
          <th scope="col" className="px-3 py-3 font-medium">{t("location")}</th>
          <th scope="col" className="px-3 py-3 font-medium">{t("quantity")}</th>
          <th scope="col" className="px-5 py-3 font-medium">{t("status")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-t border-border hover:bg-muted/40">
            <td className="px-5 py-3">
              <Link href={`/items/${r.id}`} className="group flex items-center gap-3">
                <ItemThumb name={r.name} url={h.thumb(r)} />
                <span className="min-w-0">
                  <span className="block font-semibold group-hover:underline">{r.name}</span>
                  <span className="block text-sm text-muted-foreground">{h.category(r)}</span>
                </span>
              </Link>
            </td>
            <td className="px-3 py-3 text-[15px]">{h.location(r)}</td>
            <td className="px-3 py-3">
              <QuantityStepper id={r.id} name={r.name} quantity={r.quantity} low={h.low(r)} />
            </td>
            <td className="px-5 py-3">
              <StatusBadge status={h.status(r)} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Phone list. */
export function ItemList({ rows }: { rows: SearchRow[] }) {
  const h = useRowHelpers(rows);
  return (
    <ul className="flex flex-col">
      {rows.map((r) => (
        <li key={r.id} className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-0">
          <Link href={`/items/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <ItemThumb name={r.name} url={h.thumb(r)} />
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 font-semibold break-words">{r.name}</span>
              <span className="block truncate text-sm text-muted-foreground">{h.location(r)}</span>
              <StatusBadge status={h.status(r)} short className="mt-1" />
            </span>
          </Link>
          <QuantityStepper id={r.id} name={r.name} quantity={r.quantity} low={h.low(r)} />
        </li>
      ))}
    </ul>
  );
}

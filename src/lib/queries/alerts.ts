"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { AlertKind } from "@/lib/types";
import { qk } from "./keys";

export interface AlertRow {
  item_id: string;
  name: string;
  quantity: number;
  unit: string | null;
  min_quantity: number | null;
  replace_after_months: number | null;
  category_id: string | null;
  location_path: string | null;
  location_path_en: string | null;
  kind: AlertKind;
  severity: number;
  due_date: string | null;
  days_left: number | null;
  snoozed: boolean;
  snoozed_until: string | null;
  thumb_path: string | null;
}

export const STOCK_KINDS: readonly AlertKind[] = ["out_of_stock", "low_stock"];

/** Most urgent first: severity, then soonest due. */
export function byUrgency(a: AlertRow, b: AlertRow) {
  return b.severity - a.severity || (a.days_left ?? 0) - (b.days_left ?? 0) || a.name.localeCompare(b.name);
}

const fetchPage = (from: number) =>
  getSupabaseBrowser().from("item_alerts").select("*").order("item_id").order("kind").range(from, from + 999);

/** All currently raised alerts (the item_alerts view is the single source of truth). */
export function useAlerts() {
  return useQuery({
    queryKey: qk.alerts,
    queryFn: async (): Promise<AlertRow[]> => {
      // Page past PostgREST's 1000-row response cap; large inventories can have more alerts.
      const data: Awaited<ReturnType<typeof fetchPage>>["data"] & object = [];
      for (let from = 0; ; from += 1000) {
        const { data: page, error } = await fetchPage(from);
        if (error) throw error;
        data.push(...page);
        if (page.length < 1000 || from >= 20_000) break;
      }
      return data
        .map((r) => ({
          item_id: r.item_id!,
          name: r.name!,
          quantity: Number(r.quantity ?? 0),
          unit: r.unit,
          min_quantity: r.min_quantity === null ? null : Number(r.min_quantity),
          replace_after_months: r.replace_after_months,
          category_id: r.category_id,
          location_path: r.location_path,
          location_path_en: r.location_path_en,
          kind: r.kind!,
          severity: r.severity ?? 1,
          due_date: r.due_date,
          days_left: r.days_left,
          snoozed: Boolean(r.snoozed),
          snoozed_until: r.snoozed_until,
          thumb_path: r.thumb_path,
        }))
        .sort(byUrgency);
    },
  });
}

/** One row per item: its most urgent alert. */
export function mostUrgentPerItem(rows: AlertRow[]): AlertRow[] {
  const seen = new Set<string>();
  return [...rows].sort(byUrgency).filter((r) => (seen.has(r.item_id) ? false : (seen.add(r.item_id), true)));
}

/** Months in use for a replace_due alert (configured interval + time past due). */
export function replaceMonths(row: Pick<AlertRow, "replace_after_months" | "days_left">): number {
  return (row.replace_after_months ?? 0) + Math.floor(Math.max(0, -(row.days_left ?? 0)) / 30.44);
}

import "server-only";
import type { ServerSupabase } from "@/lib/actions/auth-guard";

const PAGE = 1000;

/** Reads every row of a table for the signed-in user (RLS), paging past PostgREST's row cap. */
export async function fetchAll<T>(
  run: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/** CSV cell: quoted, and neutralised against spreadsheet formula injection. */
export function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let s = Array.isArray(value) ? value.join("; ") : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  // BOM so Excel opens UTF-8 (Vietnamese) correctly.
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

export async function exportItems(supabase: ServerSupabase) {
  return fetchAll((from, to) =>
    supabase
      .from("items")
      .select(
        "id, name, quantity, unit, min_quantity, condition, purchase_date, purchase_price, purchase_place, expiry_date, opened_date, warranty_until, replace_after_months, last_replaced_at, notes, attributes, barcode, archived_at, created_at, updated_at, category:categories(name, name_en), location:locations(path_text), group:item_groups(name), item_tags(tag:tags(name))",
      )
      .order("created_at")
      .range(from, to),
  );
}

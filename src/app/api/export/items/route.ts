import { NextResponse } from "next/server";
import { requireUser } from "@/lib/actions/auth-guard";
import { exportItems, toCsv } from "@/lib/export";

export const dynamic = "force-dynamic";

/** CSV export of all items (one row per item), readable in Excel / Google Sheets. */
export async function GET() {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const items = await exportItems(auth.supabase);
  const header = [
    "name", "category", "location", "quantity", "unit", "min_quantity", "condition", "purchase_date", "purchase_price",
    "purchase_place", "expiry_date", "opened_date", "warranty_until", "replace_after_months", "last_replaced_at", "tags",
    "notes", "attributes", "archived", "created_at", "id",
  ];
  const rows = items.map((i) => [
    i.name,
    i.category?.name ?? "",
    i.location?.path_text ?? "",
    i.quantity,
    i.unit,
    i.min_quantity,
    i.condition,
    i.purchase_date,
    i.purchase_price,
    i.purchase_place,
    i.expiry_date,
    i.opened_date,
    i.warranty_until,
    i.replace_after_months,
    i.last_replaced_at,
    i.item_tags.map((t) => t.tag?.name).filter(Boolean),
    i.notes,
    Object.keys(i.attributes as object).length ? JSON.stringify(i.attributes) : "",
    i.archived_at ? "yes" : "",
    i.created_at,
    i.id,
  ]);
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stowly-items-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

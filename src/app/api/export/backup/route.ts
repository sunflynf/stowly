import { NextResponse } from "next/server";
import { requireUser } from "@/lib/actions/auth-guard";
import { fetchAll } from "@/lib/export";

export const dynamic = "force-dynamic";

const TABLES = [
  "profiles",
  "categories",
  "locations",
  "items",
  "item_photos",
  "tags",
  "item_tags",
  "item_events",
  "shopping_list",
  "alert_snoozes",
] as const;

/** Full JSON backup of everything the user owns (photos are listed by storage path). */
export async function GET() {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const data: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    data[table] = await fetchAll((from, to) => auth.supabase.from(table).select("*").range(from, to));
  }
  // Derived columns are rebuilt by triggers on import.
  data.items = data.items.map((row) => {
    const { search_vector: _v, search_text: _t, name_norm: _n, ...rest } = row as Record<string, unknown>;
    return rest;
  });

  const date = new Date().toISOString().slice(0, 10);
  const body = JSON.stringify({ format: "stowly-backup", version: 1, exported_at: new Date().toISOString(), data }, null, 2);
  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="stowly-backup-${date}.json"`,
      "Cache-Control": "no-store",
    },
  });
}

"use server";

import { z } from "zod";
import { DUPLICATE_MODES, importRowSchema } from "@/lib/import/rows";
import { normalizeText } from "@/lib/text";
import type { Database } from "@/lib/database.types";
import type { ItemRow } from "@/lib/types";
import { emptyItemForm, itemInputSchema, type ItemFormValues, type ItemInput } from "@/lib/validation/item";
import { requireUser, type ServerSupabase } from "./auth-guard";
import { fail, ok, validationFail, type ActionResult } from "./result";

const inputSchema = z.object({
  rows: z.array(importRowSchema).min(1).max(200),
  mode: z.enum(DUPLICATE_MODES),
});

export type ImportStatus = "created" | "updated" | "skipped" | "error";
export interface ImportRowResult {
  status: ImportStatus;
  id?: string;
  /** Field names that failed validation, or "db" for a database error. */
  errors?: string[];
}

type ItemUpdate = Database["public"]["Tables"]["items"]["Update"];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PATH_SEPARATOR = /\s*(?:›|>|\/|\\)\s*/;
const norm = (s: string) => normalizeText(s);

type Named = { id: string; name: string; name_en?: string | null };
const matches = (row: Named, key: string) => norm(row.name) === key || (row.name_en ? norm(row.name_en) === key : false);

/** Per-call caches so a 200-row chunk needs only a handful of queries. */
async function loadContext(supabase: ServerSupabase) {
  const [categories, locations, groups, tags] = await Promise.all([
    supabase.from("categories").select("id, name, name_en, sort_order"),
    supabase.from("locations").select("id, parent_id, name, name_en"),
    supabase.from("item_groups").select("id, name"),
    supabase.from("tags").select("id, name"),
  ]);
  return {
    categories: categories.data ?? [],
    locations: locations.data ?? [],
    groups: groups.data ?? [],
    tags: new Map((tags.data ?? []).map((t) => [t.name.toLocaleLowerCase(), t.id])),
  };
}
type Context = Awaited<ReturnType<typeof loadContext>>;

async function resolveCategory(supabase: ServerSupabase, ctx: Context, name: string): Promise<string | null> {
  const key = norm(name);
  if (!key) return null;
  const found = ctx.categories.find((c) => matches(c, key));
  if (found) return found.id;
  const sort = Math.max(0, ...ctx.categories.map((c) => c.sort_order)) + 10;
  const { data } = await supabase.from("categories").insert({ name: name.trim().slice(0, 80), sort_order: sort }).select("id, name, name_en, sort_order").single();
  if (!data) return null;
  ctx.categories.push(data);
  return data.id;
}

/** "Phòng ngủ › Tủ quần áo" (also ">" or "/"): finds each level, creating missing ones. */
async function resolveLocation(supabase: ServerSupabase, ctx: Context, path: string): Promise<string | null> {
  const parts = path.split(PATH_SEPARATOR).map((p) => p.trim()).filter(Boolean).slice(0, 6);
  let parent: string | null = null;
  for (const part of parts) {
    const key = norm(part);
    let node: Context["locations"][number] | undefined = ctx.locations.find((l) => l.parent_id === parent && matches(l, key));
    if (!node) {
      const { data }: { data: Context["locations"][number] | null } = await supabase
        .from("locations")
        .insert({ name: part.slice(0, 80), parent_id: parent })
        .select("id, parent_id, name, name_en")
        .single();
      if (!data) return null;
      ctx.locations.push(data);
      node = data;
    }
    parent = node.id;
  }
  return parent;
}

async function resolveGroup(supabase: ServerSupabase, ctx: Context, name: string): Promise<string | null> {
  const key = norm(name);
  if (!key) return null;
  const found = ctx.groups.find((g) => norm(g.name) === key);
  if (found) return found.id;
  const { data } = await supabase.from("item_groups").insert({ name: name.trim().slice(0, 80) }).select("id, name").single();
  if (!data) return null;
  ctx.groups.push(data);
  return data.id;
}

async function ensureTags(supabase: ServerSupabase, ctx: Context, names: string[]) {
  const missing = [...new Set(names.map((n) => n.trim()).filter((n) => n && !ctx.tags.has(n.toLocaleLowerCase())))];
  if (!missing.length) return;
  const { data } = await supabase.from("tags").insert(missing.map((name) => ({ name: name.slice(0, 40) }))).select("id, name");
  (data ?? []).forEach((t) => ctx.tags.set(t.name.toLocaleLowerCase(), t.id));
}

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** Existing item → form strings, so an update can be validated as a whole. */
function itemToForm(item: ItemRow): ItemFormValues {
  return {
    ...emptyItemForm,
    name: item.name,
    category_id: item.category_id ?? "",
    location_id: item.location_id ?? "",
    group_id: item.group_id ?? "",
    quantity: str(item.quantity),
    unit: str(item.unit),
    min_quantity: str(item.min_quantity),
    condition: item.condition,
    purchase_date: str(item.purchase_date),
    purchase_price: str(item.purchase_price),
    purchase_place: str(item.purchase_place),
    expiry_date: str(item.expiry_date),
    opened_date: str(item.opened_date),
    warranty_until: str(item.warranty_until),
    replace_after_months: str(item.replace_after_months),
    last_replaced_at: str(item.last_replaced_at),
    notes: str(item.notes),
    barcode: str(item.barcode),
    attributes: Object.fromEntries(Object.entries((item.attributes ?? {}) as Record<string, unknown>).map(([k, v]) => [k, str(v)])),
    tags: [],
  };
}

const FORM_KEYS = [
  "name", "quantity", "unit", "min_quantity", "condition", "purchase_date", "purchase_price", "purchase_place",
  "expiry_date", "opened_date", "warranty_until", "replace_after_months", "last_replaced_at", "notes", "barcode",
] as const;

/**
 * Imports up to 200 rows. Rows with an `id` you own update that item; otherwise
 * a duplicate (same barcode, or same name in the same location) is updated,
 * skipped or created again according to `mode`. Updates only touch columns
 * present in the file. Missing categories, location paths, groups and tags are created.
 */
export async function importItemsAction(input: unknown): Promise<ActionResult<{ results: ImportRowResult[] }>> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { rows, mode } = parsed.data;
  const { supabase } = auth;
  const ctx = await loadContext(supabase);

  // Candidates for duplicate matching, fetched in bulk.
  const ids = rows.map((r) => r.id ?? "").filter((id) => UUID.test(id));
  const barcodes = rows.map((r) => r.barcode?.trim() ?? "").filter(Boolean);
  const names = [...new Set(rows.map((r) => norm(r.name ?? "")).filter(Boolean))];
  const [byIds, byBarcodes, byNames] = await Promise.all([
    ids.length ? supabase.from("items").select("*").in("id", ids) : Promise.resolve({ data: [] as ItemRow[] }),
    barcodes.length ? supabase.from("items").select("*").in("barcode", barcodes) : Promise.resolve({ data: [] as ItemRow[] }),
    names.length && mode !== "create" ? supabase.from("items").select("*").in("name_norm", names) : Promise.resolve({ data: [] as ItemRow[] }),
  ]);

  await ensureTags(supabase, ctx, rows.flatMap((r) => r.tags ?? []));

  const results: ImportRowResult[] = [];
  const claimed = new Set<string>();
  const creates: { index: number; payload: Omit<ItemInput, "tags"> & { archived_at: string | null }; tags: string[] | undefined }[] = [];
  const updates: { index: number; id: string; payload: ItemUpdate & { id: string; name: string }; tags: string[] | undefined }[] = [];

  for (const [index, row] of rows.entries()) {
    try {
      const categoryId = row.category !== undefined ? await resolveCategory(supabase, ctx, row.category) : undefined;
      const locationId = row.location !== undefined ? await resolveLocation(supabase, ctx, row.location) : undefined;
      const groupId = row.group !== undefined ? await resolveGroup(supabase, ctx, row.group) : undefined;

      // Each existing item is matched by at most one row, so identical rows in a
      // file (two "Pin AA" in one drawer) stay separate items.
      let existing: ItemRow | undefined;
      if (row.id && UUID.test(row.id)) existing = byIds.data?.find((i) => i.id === row.id!.toLowerCase() && !claimed.has(i.id));
      if (!existing && mode !== "create") {
        if (row.barcode?.trim()) {
          existing = byBarcodes.data?.find((i) => i.barcode === row.barcode!.trim() && !i.archived_at && !claimed.has(i.id));
        }
        if (!existing && row.name) {
          const key = norm(row.name);
          existing = byNames.data?.find(
            (i) =>
              i.name_norm === key &&
              !i.archived_at &&
              !claimed.has(i.id) &&
              (locationId === undefined || i.location_id === locationId),
          );
        }
      }
      if (existing) claimed.add(existing.id);
      if (existing && mode === "skip" && !(row.id && UUID.test(row.id))) {
        results[index] = { status: "skipped", id: existing.id };
        continue;
      }

      const base = existing ? itemToForm(existing) : { ...emptyItemForm };
      const form: ItemFormValues = { ...base };
      for (const key of FORM_KEYS) if (row[key] !== undefined) (form[key] as string) = row[key]!;
      if (row.condition === "" || (!existing && !row.condition)) form.condition = existing?.condition ?? "good";
      if (!existing && !row.quantity) form.quantity = "1";
      if (categoryId !== undefined) form.category_id = categoryId ?? "";
      if (locationId !== undefined) form.location_id = locationId ?? "";
      if (groupId !== undefined) form.group_id = groupId ?? "";
      if (row.attributes !== undefined) {
        const attrs = row.attributes ? (JSON.parse(row.attributes) as Record<string, unknown>) : {};
        form.attributes = Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, str(v)]));
      }

      const valid = itemInputSchema.safeParse(form);
      if (!valid.success) {
        results[index] = { status: "error", errors: [...new Set(valid.error.issues.map((i) => String(i.path[0])))] };
        continue;
      }
      const { tags: _tags, ...data } = valid.data;
      const archived_at = row.archived === undefined ? (existing?.archived_at ?? null) : row.archived ? (existing?.archived_at ?? new Date().toISOString()) : null;

      if (existing) {
        // Only columns present in the file are written.
        const update: ItemUpdate = { archived_at };
        for (const key of FORM_KEYS) if (row[key] !== undefined) (update as Record<string, unknown>)[key] = data[key];
        if (row.condition !== undefined) update.condition = data.condition;
        if (categoryId !== undefined) update.category_id = data.category_id;
        if (locationId !== undefined) update.location_id = data.location_id;
        if (groupId !== undefined) update.group_id = data.group_id;
        if (row.attributes !== undefined) update.attributes = data.attributes;
        updates.push({ index, id: existing.id, payload: { ...update, id: existing.id, name: data.name }, tags: row.tags });
      } else {
        creates.push({ index, payload: { ...data, archived_at }, tags: row.tags });
      }
    } catch {
      results[index] = { status: "error", errors: ["db"] };
    }
  }

  // Updates in one upsert: every row of a file has the same mapped columns, so
  // only those columns are written. Fall back to one by one to isolate a bad row.
  if (updates.length) {
    const { error } = await supabase.from("items").upsert(updates.map((u) => u.payload), { onConflict: "id" });
    if (!error) updates.forEach((u) => (results[u.index] = { status: "updated", id: u.id }));
    else {
      for (const u of updates) {
        const { id, ...payload } = u.payload;
        const { error: oneError } = await supabase.from("items").update(payload).eq("id", id);
        results[u.index] = oneError ? { status: "error", errors: ["db"] } : { status: "updated", id };
      }
    }
    // Only touch tag links that actually change (re-imports usually keep them).
    const withTags = updates.filter((u) => u.tags !== undefined && results[u.index]?.status === "updated");
    if (withTags.length) {
      const { data: current } = await supabase.from("item_tags").select("item_id, tag_id").in("item_id", withTags.map((u) => u.id));
      const have = new Map<string, Set<string>>();
      (current ?? []).forEach((l) => (have.get(l.item_id) ?? have.set(l.item_id, new Set()).get(l.item_id)!).add(l.tag_id));
      const toAdd: { item_id: string; tag_id: string }[] = [];
      for (const u of withTags) {
        const want = new Set((u.tags ?? []).map((n) => ctx.tags.get(n.trim().toLocaleLowerCase())).filter((x): x is string => Boolean(x)));
        const existingTags = have.get(u.id) ?? new Set<string>();
        const remove = [...existingTags].filter((t) => !want.has(t));
        if (remove.length) await supabase.from("item_tags").delete().eq("item_id", u.id).in("tag_id", remove);
        want.forEach((tag_id) => !existingTags.has(tag_id) && toAdd.push({ item_id: u.id, tag_id }));
      }
      if (toAdd.length) await supabase.from("item_tags").upsert(toAdd, { onConflict: "item_id,tag_id", ignoreDuplicates: true });
    }
  }

  // New items in one insert (order is preserved); fall back to one by one to isolate a bad row.
  if (creates.length) {
    const { data, error } = await supabase.from("items").insert(creates.map((c) => c.payload)).select("id");
    const insertedIds: (string | null)[] = [];
    if (!error && data) insertedIds.push(...data.map((d) => d.id));
    else {
      for (const c of creates) {
        const { data: one } = await supabase.from("items").insert(c.payload).select("id").single();
        insertedIds.push(one?.id ?? null);
      }
    }
    const links: { item_id: string; tag_id: string }[] = [];
    creates.forEach((c, i) => {
      const id = insertedIds[i];
      if (!id) {
        results[c.index] = { status: "error", errors: ["db"] };
        return;
      }
      results[c.index] = { status: "created", id };
      const seen = new Set<string>();
      for (const name of c.tags ?? []) {
        const tagId = ctx.tags.get(name.trim().toLocaleLowerCase());
        if (tagId && !seen.has(tagId)) {
          seen.add(tagId);
          links.push({ item_id: id, tag_id: tagId });
        }
      }
    });
    if (links.length) await supabase.from("item_tags").upsert(links, { onConflict: "item_id,tag_id", ignoreDuplicates: true });
  }

  return ok({ results });
}


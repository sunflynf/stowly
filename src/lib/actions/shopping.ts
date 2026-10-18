"use server";

import { z } from "zod";
import { optionalText, requiredName, requiredNumber, uuid } from "@/lib/validation/common";
import { suggestedBuyQuantity } from "@/lib/shopping";
import { requireUser } from "./auth-guard";
import { fail, mapDbError, ok, validationFail, type ActionResult } from "./result";

const addSchema = z.object({
  item_id: uuid.nullable().optional(),
  name: requiredName(200),
  quantity: requiredNumber(0.001, 1_000_000),
  unit: optionalText(20).optional(),
});

export async function addToShoppingAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsed = addSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  const { data, error } = await auth.supabase.from("shopping_list").insert(parsed.data).select("id").single();
  if (error) return fail(mapDbError(error));
  return ok({ id: data.id });
}

/** Adds every low/out-of-stock item that is not already on the list. */
export async function addLowStockToShoppingAction(): Promise<ActionResult<{ added: number }>> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");

  const [{ data: alerts, error }, { data: open }] = await Promise.all([
    auth.supabase
      .from("item_alerts")
      .select("item_id, name, quantity, min_quantity, unit")
      .in("kind", ["low_stock", "out_of_stock"]),
    auth.supabase.from("shopping_list").select("item_id").eq("done", false).not("item_id", "is", null),
  ]);
  if (error) return fail(mapDbError(error));
  const onList = new Set((open ?? []).map((r) => r.item_id));
  const rows = (alerts ?? [])
    .filter((a) => a.item_id && !onList.has(a.item_id))
    .map((a) => ({
      item_id: a.item_id!,
      name: a.name!,
      unit: a.unit,
      quantity: suggestedBuyQuantity(Number(a.quantity ?? 0), a.min_quantity === null ? null : Number(a.min_quantity)),
    }));
  if (rows.length) {
    const { error: insertError } = await auth.supabase.from("shopping_list").insert(rows);
    if (insertError) return fail(mapDbError(insertError));
  }
  return ok({ added: rows.length });
}

const updateSchema = z.object({
  name: requiredName(200).optional(),
  quantity: requiredNumber(0.001, 1_000_000).optional(),
  done: z.boolean().optional(),
});

export async function updateShoppingAction(id: unknown, input: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsedId = uuid.safeParse(id);
  const parsed = updateSchema.safeParse(input);
  if (!parsedId.success) return validationFail(parsedId.error);
  if (!parsed.success) return validationFail(parsed.error);

  const update = {
    ...parsed.data,
    ...(parsed.data.done === undefined ? {} : { done_at: parsed.data.done ? new Date().toISOString() : null }),
  };
  const { data, error } = await auth.supabase.from("shopping_list").update(update).eq("id", parsedId.data).select("id");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  return ok();
}

/** Marks an entry bought and, for linked items, adds the bought amount to stock. */
export async function markBoughtAction(id: unknown, restock: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsedId = uuid.safeParse(id);
  const parsedRestock = z.boolean().safeParse(restock);
  if (!parsedId.success) return validationFail(parsedId.error);
  if (!parsedRestock.success) return validationFail(parsedRestock.error);

  const { data: row, error } = await auth.supabase
    .from("shopping_list")
    .update({ done: true, done_at: new Date().toISOString() })
    .eq("id", parsedId.data)
    .eq("done", false)
    .select("item_id, quantity")
    .maybeSingle();
  if (error) return fail(mapDbError(error));
  if (!row) return fail("notFound");
  if (parsedRestock.data && row.item_id) {
    const { error: rpcError } = await auth.supabase.rpc("adjust_item_quantity", {
      p_item_id: row.item_id,
      p_delta: Number(row.quantity),
      p_note: "shopping",
    });
    if (rpcError) return fail(mapDbError(rpcError));
  }
  return ok();
}

export async function deleteShoppingAction(id: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsedId = uuid.safeParse(id);
  if (!parsedId.success) return validationFail(parsedId.error);
  const { error } = await auth.supabase.from("shopping_list").delete().eq("id", parsedId.data);
  if (error) return fail(mapDbError(error));
  return ok();
}

export async function clearDoneShoppingAction(): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const { error } = await auth.supabase.from("shopping_list").delete().eq("done", true);
  if (error) return fail(mapDbError(error));
  return ok();
}

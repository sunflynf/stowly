"use server";

import { z } from "zod";
import { addDays, todayIn } from "@/lib/dates";
import { normalizeText } from "@/lib/text";
import { uuid } from "@/lib/validation/common";
import { requireUser } from "./auth-guard";
import { fail, mapDbError, ok, validationFail, type ActionResult } from "./result";

export type SuggestionReason = "idle" | "worn" | "broken" | "duplicate";
const reasonSchema = z.enum(["idle", "worn", "broken", "duplicate"]);

const dismissSchema = z.object({
  itemId: uuid,
  reason: reasonSchema,
  /** "keep" hides it (idle: until another full idle period passes); "snooze" for 30 days. */
  mode: z.enum(["keep", "snooze"]),
});

export async function dismissSuggestionAction(input: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsed = dismissSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { itemId, reason, mode } = parsed.data;

  const { data: profile } = await auth.supabase.from("profiles").select("timezone, unused_after_days").maybeSingle();
  const today = todayIn(profile?.timezone ?? "Asia/Ho_Chi_Minh");
  const until =
    mode === "snooze" ? addDays(today, 30) : reason === "idle" ? addDays(today, profile?.unused_after_days ?? 365) : null;

  const { error } = await auth.supabase
    .from("suggestion_dismissals")
    .upsert({ item_id: itemId, reason, until }, { onConflict: "item_id,reason" });
  if (error) return fail(mapDbError(error));
  return ok();
}

export async function undoDismissAction(input: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsed = z.object({ itemId: uuid, reason: reasonSchema }).safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { error } = await auth.supabase
    .from("suggestion_dismissals")
    .delete()
    .eq("item_id", parsed.data.itemId)
    .eq("reason", parsed.data.reason);
  if (error) return fail(mapDbError(error));
  return ok();
}

/** Gives an item away: condition "given_away" (kept in history, out of the active inventory). */
export async function giveAwayAction(itemId: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsedId = uuid.safeParse(itemId);
  if (!parsedId.success) return validationFail(parsedId.error);
  const { data, error } = await auth.supabase
    .from("items")
    .update({ condition: "given_away", archived_at: new Date().toISOString() })
    .eq("id", parsedId.data)
    .select("id");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  return ok();
}

/**
 * Merges likely double entries (same name, same location) into the oldest one:
 * quantities are added to it (logged as history) and the others are archived.
 */
export async function mergeDuplicatesAction(input: unknown): Promise<ActionResult<{ merged: number }>> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsed = z.object({ primaryId: uuid, duplicateIds: z.array(uuid).min(1).max(50) }).safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { primaryId, duplicateIds } = parsed.data;
  if (duplicateIds.includes(primaryId)) return fail("validation");

  const { data: rows, error } = await auth.supabase
    .from("items")
    .select("id, name, location_id, quantity, archived_at")
    .in("id", [primaryId, ...duplicateIds]);
  if (error) return fail(mapDbError(error));
  const primary = rows.find((r) => r.id === primaryId);
  if (!primary || rows.length !== duplicateIds.length + 1) return fail("notFound");
  const key = normalizeText(primary.name);
  // Only true duplicates: same normalised name and same location, all active.
  if (rows.some((r) => normalizeText(r.name) !== key || r.location_id !== primary.location_id || r.archived_at)) {
    return fail("validation");
  }

  const extra = rows.filter((r) => r.id !== primaryId).reduce((sum, r) => sum + Number(r.quantity), 0);
  if (extra > 0) {
    const { error: rpcError } = await auth.supabase.rpc("adjust_item_quantity", { p_item_id: primaryId, p_delta: extra, p_note: "merge" });
    if (rpcError) return fail(mapDbError(rpcError));
  }
  const { error: archiveError } = await auth.supabase
    .from("items")
    .update({ archived_at: new Date().toISOString() })
    .in("id", duplicateIds);
  if (archiveError) return fail(mapDbError(archiveError));
  return ok({ merged: duplicateIds.length });
}

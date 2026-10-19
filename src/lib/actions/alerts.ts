"use server";

import { z } from "zod";
import { addDays, todayIn } from "@/lib/dates";
import { ALERT_KINDS } from "@/lib/types";
import { optionalDate, uuid } from "@/lib/validation/common";
import { requireUser, type ServerSupabase } from "./auth-guard";
import { fail, mapDbError, ok, validationFail, type ActionResult } from "./result";

const alertRef = z.object({ itemId: uuid, kind: z.enum(ALERT_KINDS) });

async function userToday(supabase: ServerSupabase) {
  const { data } = await supabase.from("profiles").select("timezone").maybeSingle();
  return todayIn(data?.timezone ?? "Asia/Ho_Chi_Minh");
}

export async function snoozeAlertAction(input: unknown, days: unknown = 7): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsed = alertRef.safeParse(input);
  const parsedDays = z.number().int().min(1).max(365).safeParse(days);
  if (!parsed.success) return validationFail(parsed.error);
  if (!parsedDays.success) return validationFail(parsedDays.error);

  const until = addDays(await userToday(auth.supabase), parsedDays.data);
  const { error } = await auth.supabase
    .from("alert_snoozes")
    .upsert({ item_id: parsed.data.itemId, kind: parsed.data.kind, until }, { onConflict: "item_id,kind" });
  if (error) return fail(mapDbError(error));
  return ok();
}

export async function unsnoozeAlertAction(input: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsed = alertRef.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { error } = await auth.supabase
    .from("alert_snoozes")
    .delete()
    .eq("item_id", parsed.data.itemId)
    .eq("kind", parsed.data.kind);
  if (error) return fail(mapDbError(error));
  return ok();
}

const replacedSchema = z.object({ itemId: uuid, newExpiry: optionalDate.optional() });

/**
 * "Mark replaced": records today as the replacement date. For expiring items the
 * expiry date is replaced by the new one (or cleared).
 */
export async function markReplacedAction(input: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsed = replacedSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  const today = await userToday(auth.supabase);
  const update: { last_replaced_at: string; expiry_date?: string | null; opened_date?: null } = { last_replaced_at: today };
  if (parsed.data.newExpiry !== undefined) {
    update.expiry_date = parsed.data.newExpiry;
    update.opened_date = null;
  }
  const { data, error } = await auth.supabase.from("items").update(update).eq("id", parsed.data.itemId).select("id");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  await auth.supabase.from("alert_snoozes").delete().eq("item_id", parsed.data.itemId);
  return ok();
}

/** Lent book came back: clears lent_to / lent_due. */
export async function markReturnedAction(itemId: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsedId = uuid.safeParse(itemId);
  if (!parsedId.success) return validationFail(parsedId.error);

  const { data: item } = await auth.supabase.from("items").select("attributes").eq("id", parsedId.data).maybeSingle();
  if (!item) return fail("notFound");
  const attrs = { ...(item.attributes as Record<string, unknown>) };
  delete attrs.lent_to;
  delete attrs.lent_due;
  const { error } = await auth.supabase.from("items").update({ attributes: attrs as Record<string, string> }).eq("id", parsedId.data);
  if (error) return fail(mapDbError(error));
  return ok();
}

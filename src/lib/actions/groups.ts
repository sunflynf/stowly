"use server";

import { z } from "zod";
import { addDays, todayIn } from "@/lib/dates";
import { optionalNumber, optionalText, requiredName, uuid } from "@/lib/validation/common";
import { requireEditor } from "./auth-guard";
import { fail, mapDbError, ok, validationFail, type ActionResult } from "./result";

const groupSchema = z.object({
  name: requiredName(80),
  unit: optionalText(20),
  min_quantity: optionalNumber(0, 1_000_000),
});

export async function createGroupAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsed = groupSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { data, error } = await auth.supabase.from("item_groups").insert(parsed.data).select("id").single();
  if (error) return fail(mapDbError(error));
  return ok({ id: data.id });
}

export async function updateGroupAction(id: unknown, input: unknown): Promise<ActionResult> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsedId = uuid.safeParse(id);
  const parsed = groupSchema.partial().safeParse(input);
  if (!parsedId.success) return validationFail(parsedId.error);
  if (!parsed.success) return validationFail(parsed.error);
  const { data, error } = await auth.supabase.from("item_groups").update(parsed.data).eq("id", parsedId.data).select("id");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  return ok();
}

/** Deletes the group; its items stay, just ungrouped. */
export async function deleteGroupAction(id: unknown): Promise<ActionResult> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsedId = uuid.safeParse(id);
  if (!parsedId.success) return validationFail(parsedId.error);
  const { data, error } = await auth.supabase.from("item_groups").delete().eq("id", parsedId.data).select("id");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  return ok();
}

const membersSchema = z.object({
  groupId: uuid.nullable(),
  itemIds: z.array(uuid).min(1).max(500),
});

/** Moves items into a group (or out of any group with groupId = null). */
export async function setItemsGroupAction(input: unknown): Promise<ActionResult<{ updated: number }>> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsed = membersSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { data, error } = await auth.supabase
    .from("items")
    .update({ group_id: parsed.data.groupId })
    .in("id", parsed.data.itemIds)
    .select("id");
  if (error) return fail(mapDbError(error));
  return ok({ updated: data.length });
}

/** Snoozes (days > 0) or unsnoozes (days = 0) a group's stock alert. */
export async function snoozeGroupAction(id: unknown, days: unknown): Promise<ActionResult> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsedId = uuid.safeParse(id);
  const parsedDays = z.number().int().min(0).max(365).safeParse(days);
  if (!parsedId.success) return validationFail(parsedId.error);
  if (!parsedDays.success) return validationFail(parsedDays.error);

  let until: string | null = null;
  if (parsedDays.data > 0) {
    const { data: profile } = await auth.supabase.from("profiles").select("timezone").maybeSingle();
    until = addDays(todayIn(profile?.timezone ?? "Asia/Ho_Chi_Minh"), parsedDays.data);
  }
  const { data, error } = await auth.supabase.from("item_groups").update({ snoozed_until: until }).eq("id", parsedId.data).select("id");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  return ok();
}

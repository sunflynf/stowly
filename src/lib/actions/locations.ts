"use server";

import { z } from "zod";
import { optionalText, requiredName, uuid } from "@/lib/validation/common";
import { requireUser } from "./auth-guard";
import { fail, mapDbError, ok, validationFail, type ActionResult } from "./result";

const createSchema = z.object({
  name: requiredName(80),
  parent_id: uuid.nullable(),
});

const updateSchema = z.object({
  name: requiredName(80).optional(),
  name_en: optionalText(80).optional(),
  parent_id: uuid.nullable().optional(),
});

export async function createLocationAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  let sortOrder = 0;
  const siblings = auth.supabase.from("locations").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const { data: last } = await (parsed.data.parent_id ? siblings.eq("parent_id", parsed.data.parent_id) : siblings.is("parent_id", null));
  if (last?.[0]) sortOrder = last[0].sort_order + 10;

  const { data, error } = await auth.supabase
    .from("locations")
    .insert({ name: parsed.data.name, parent_id: parsed.data.parent_id, sort_order: sortOrder })
    .select("id")
    .single();
  if (error) return fail(mapDbError(error));
  return ok({ id: data.id });
}

export async function updateLocationAction(id: unknown, input: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsedId = uuid.safeParse(id);
  const parsed = updateSchema.safeParse(input);
  if (!parsedId.success) return validationFail(parsedId.error);
  if (!parsed.success) return validationFail(parsed.error);
  if (parsed.data.parent_id === parsedId.data) return fail("locationCycle");

  const { data, error } = await auth.supabase.from("locations").update(parsed.data).eq("id", parsedId.data).select("id");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  return ok();
}

/** Deletes an empty location (no items, no sub-locations). */
export async function deleteLocationAction(id: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsedId = uuid.safeParse(id);
  if (!parsedId.success) return validationFail(parsedId.error);

  const [{ count: children }, { count: items }] = await Promise.all([
    auth.supabase.from("locations").select("id", { count: "exact", head: true }).eq("parent_id", parsedId.data),
    auth.supabase.from("items").select("id", { count: "exact", head: true }).eq("location_id", parsedId.data),
  ]);
  if ((children ?? 0) > 0 || (items ?? 0) > 0) return fail("locationNotEmpty");

  const { data, error } = await auth.supabase.from("locations").delete().eq("id", parsedId.data).select("id");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  return ok();
}

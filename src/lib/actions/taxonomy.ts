"use server";

import { z } from "zod";
import { CATEGORY_ICON_NAMES } from "@/lib/category-icons";
import { optionalText, requiredName, uuid } from "@/lib/validation/common";
import { attributeDefsSchema, tagNameSchema } from "@/lib/validation/item";
import { requireEditor } from "./auth-guard";
import { fail, mapDbError, ok, validationFail, type ActionResult } from "./result";


const categorySchema = z.object({
  name: requiredName(80),
  name_en: optionalText(80),
  icon: z.enum(CATEGORY_ICON_NAMES),
  default_attributes: attributeDefsSchema,
});

export async function createCategoryAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsed = categorySchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  const { data: last } = await auth.supabase.from("categories").select("sort_order").order("sort_order", { ascending: false }).limit(1);
  const { data, error } = await auth.supabase
    .from("categories")
    .insert({ ...parsed.data, sort_order: (last?.[0]?.sort_order ?? 0) + 10 })
    .select("id")
    .single();
  if (error) return fail(mapDbError(error));
  return ok({ id: data.id });
}

export async function updateCategoryAction(id: unknown, input: unknown): Promise<ActionResult> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsedId = uuid.safeParse(id);
  const parsed = categorySchema.partial().safeParse(input);
  if (!parsedId.success) return validationFail(parsedId.error);
  if (!parsed.success) return validationFail(parsed.error);

  const { data, error } = await auth.supabase.from("categories").update(parsed.data).eq("id", parsedId.data).select("id");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  return ok();
}

/** Deleting a category leaves its items uncategorised (FK sets null). */
export async function deleteCategoryAction(id: unknown): Promise<ActionResult> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsedId = uuid.safeParse(id);
  if (!parsedId.success) return validationFail(parsedId.error);
  const { data, error } = await auth.supabase.from("categories").delete().eq("id", parsedId.data).select("id");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  return ok();
}

export async function moveCategoryAction(id: unknown, direction: unknown): Promise<ActionResult> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsedId = uuid.safeParse(id);
  const parsedDir = z.enum(["up", "down"]).safeParse(direction);
  if (!parsedId.success) return validationFail(parsedId.error);
  if (!parsedDir.success) return validationFail(parsedDir.error);

  const { data: all, error } = await auth.supabase.from("categories").select("id").order("sort_order").order("created_at");
  if (error) return fail(mapDbError(error));
  const ids = all.map((c) => c.id);
  const index = ids.indexOf(parsedId.data);
  const target = parsedDir.data === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ids.length) return ok();
  [ids[index], ids[target]] = [ids[target], ids[index]];
  for (const [i, cid] of ids.entries()) {
    const { error: e } = await auth.supabase.from("categories").update({ sort_order: (i + 1) * 10 }).eq("id", cid);
    if (e) return fail(mapDbError(e));
  }
  return ok();
}

export async function renameTagAction(id: unknown, name: unknown): Promise<ActionResult> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsedId = uuid.safeParse(id);
  const parsedName = tagNameSchema.safeParse(name);
  if (!parsedId.success) return validationFail(parsedId.error);
  if (!parsedName.success) return validationFail(parsedName.error);
  const { data, error } = await auth.supabase.from("tags").update({ name: parsedName.data }).eq("id", parsedId.data).select("id");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  return ok();
}

export async function deleteTagAction(id: unknown): Promise<ActionResult> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsedId = uuid.safeParse(id);
  if (!parsedId.success) return validationFail(parsedId.error);
  const { data, error } = await auth.supabase.from("tags").delete().eq("id", parsedId.data).select("id");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  return ok();
}

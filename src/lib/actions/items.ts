"use server";

import { z } from "zod";
import { adjustQuantitySchema, itemInputSchema, photoInputSchema, type ItemInput } from "@/lib/validation/item";
import { uuid } from "@/lib/validation/common";
import { requireUser, type ServerSupabase } from "./auth-guard";
import { fail, mapDbError, ok, validationFail, type ActionResult } from "./result";

const PHOTO_BUCKET = "item-photos";

function toRow(input: ItemInput) {
  const { tags: _tags, ...row } = input;
  return row;
}

/** Ensures tags exist (case-insensitive) and makes the item's tag set match `names`. */
async function syncTags(supabase: ServerSupabase, itemId: string, names: string[]) {
  const { data: existing, error } = await supabase.from("tags").select("id, name");
  if (error) return error;
  const byName = new Map(existing.map((t) => [t.name.toLocaleLowerCase(), t.id]));
  const missing = names.filter((n) => !byName.has(n.toLocaleLowerCase()));
  if (missing.length) {
    const { data: created, error: insertError } = await supabase
      .from("tags")
      .insert(missing.map((name) => ({ name })))
      .select("id, name");
    if (insertError) return insertError;
    created.forEach((t) => byName.set(t.name.toLocaleLowerCase(), t.id));
  }
  const wanted = new Set(names.map((n) => byName.get(n.toLocaleLowerCase())!));

  const { data: current, error: currentError } = await supabase.from("item_tags").select("tag_id").eq("item_id", itemId);
  if (currentError) return currentError;
  const have = new Set(current.map((r) => r.tag_id));

  const toRemove = [...have].filter((id) => !wanted.has(id));
  const toAdd = [...wanted].filter((id) => !have.has(id));
  if (toRemove.length) {
    const { error: e } = await supabase.from("item_tags").delete().eq("item_id", itemId).in("tag_id", toRemove);
    if (e) return e;
  }
  if (toAdd.length) {
    const { error: e } = await supabase.from("item_tags").insert(toAdd.map((tag_id) => ({ item_id: itemId, tag_id })));
    if (e) return e;
  }
  return null;
}

export async function createItemAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsed = itemInputSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  const { data, error } = await auth.supabase.from("items").insert(toRow(parsed.data)).select("id").single();
  if (error) return fail(mapDbError(error));
  if (parsed.data.tags.length) {
    const tagError = await syncTags(auth.supabase, data.id, parsed.data.tags);
    if (tagError) return fail(mapDbError(tagError));
  }
  return ok({ id: data.id });
}

export async function updateItemAction(id: unknown, input: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsedId = uuid.safeParse(id);
  const parsed = itemInputSchema.safeParse(input);
  if (!parsedId.success) return validationFail(parsedId.error);
  if (!parsed.success) return validationFail(parsed.error);

  const { data, error } = await auth.supabase
    .from("items")
    .update(toRow(parsed.data))
    .eq("id", parsedId.data)
    .select("id");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  const tagError = await syncTags(auth.supabase, parsedId.data, parsed.data.tags);
  if (tagError) return fail(mapDbError(tagError));
  return ok();
}

const patchSchema = z
  .object({
    condition: itemInputSchema.shape.condition.optional(),
    location_id: itemInputSchema.shape.location_id.optional(),
    min_quantity: itemInputSchema.shape.min_quantity.optional(),
    last_replaced_at: itemInputSchema.shape.last_replaced_at.optional(),
    archived: z.boolean().optional(),
  })
  .strict();

/** Small partial updates used by one-tap actions (move, mark replaced, archive…). */
export async function patchItemAction(id: unknown, input: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsedId = uuid.safeParse(id);
  const parsed = patchSchema.safeParse(input);
  if (!parsedId.success) return validationFail(parsedId.error);
  if (!parsed.success) return validationFail(parsed.error);

  const { archived, ...rest } = parsed.data;
  const update = {
    ...rest,
    ...(archived === undefined ? {} : { archived_at: archived ? new Date().toISOString() : null }),
  };
  if (!Object.keys(update).length) return ok();
  const { data, error } = await auth.supabase.from("items").update(update).eq("id", parsedId.data).select("id");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  return ok();
}

export async function deleteItemAction(id: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsedId = uuid.safeParse(id);
  if (!parsedId.success) return validationFail(parsedId.error);

  const { data: photos } = await auth.supabase
    .from("item_photos")
    .select("storage_path, thumb_path")
    .eq("item_id", parsedId.data);
  const { data, error } = await auth.supabase.from("items").delete().eq("id", parsedId.data).select("id");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  const paths = (photos ?? []).flatMap((p) => [p.storage_path, p.thumb_path].filter((x): x is string => Boolean(x)));
  if (paths.length) await auth.supabase.storage.from(PHOTO_BUCKET).remove(paths);
  return ok();
}

export async function adjustQuantityAction(input: unknown): Promise<ActionResult<{ quantity: number }>> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsed = adjustQuantitySchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  const { data, error } = await auth.supabase.rpc("adjust_item_quantity", {
    p_item_id: parsed.data.id,
    p_delta: parsed.data.delta,
    p_note: parsed.data.note ?? undefined,
  });
  if (error) return fail(mapDbError(error));
  return ok({ quantity: Number(data) });
}

/** Registers a photo the client already uploaded to Storage (under its own folder). */
export async function addPhotoAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsed = photoInputSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { itemId, storagePath, thumbPath } = parsed.data;
  const prefix = `${auth.userId}/${itemId}/`;
  const validName = /^[\w-]+\.(webp|jpe?g|png)$/;
  if (
    !storagePath.startsWith(prefix) ||
    !thumbPath.startsWith(prefix) ||
    !validName.test(storagePath.slice(prefix.length)) ||
    !validName.test(thumbPath.slice(prefix.length))
  ) {
    return fail("validation");
  }

  const { count } = await auth.supabase
    .from("item_photos")
    .select("id", { count: "exact", head: true })
    .eq("item_id", itemId);
  const { data, error } = await auth.supabase
    .from("item_photos")
    .insert({ item_id: itemId, storage_path: storagePath, thumb_path: thumbPath, sort_order: count ?? 0 })
    .select("id")
    .single();
  if (error) {
    await auth.supabase.storage.from(PHOTO_BUCKET).remove([storagePath, thumbPath]);
    return fail(mapDbError(error));
  }
  return ok({ id: data.id });
}

export async function deletePhotoAction(photoId: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsedId = uuid.safeParse(photoId);
  if (!parsedId.success) return validationFail(parsedId.error);

  const { data, error } = await auth.supabase
    .from("item_photos")
    .delete()
    .eq("id", parsedId.data)
    .select("storage_path, thumb_path");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  const paths = data.flatMap((p) => [p.storage_path, p.thumb_path].filter((x): x is string => Boolean(x)));
  await auth.supabase.storage.from(PHOTO_BUCKET).remove(paths);
  return ok();
}

/** Moves a photo to the front (it becomes the thumbnail). */
export async function makeCoverPhotoAction(photoId: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsedId = uuid.safeParse(photoId);
  if (!parsedId.success) return validationFail(parsedId.error);

  const { data: photo } = await auth.supabase.from("item_photos").select("item_id").eq("id", parsedId.data).maybeSingle();
  if (!photo) return fail("notFound");
  const { data: all, error } = await auth.supabase
    .from("item_photos")
    .select("id")
    .eq("item_id", photo.item_id)
    .order("sort_order")
    .order("created_at");
  if (error) return fail(mapDbError(error));
  const ordered = [parsedId.data, ...all.map((p) => p.id).filter((id) => id !== parsedId.data)];
  for (const [index, id] of ordered.entries()) {
    const { error: e } = await auth.supabase.from("item_photos").update({ sort_order: index }).eq("id", id);
    if (e) return fail(mapDbError(e));
  }
  return ok();
}

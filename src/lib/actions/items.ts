"use server";

import { z } from "zod";
import { adjustQuantitySchema, itemInputSchema, photoInputSchema, type ItemInput } from "@/lib/validation/item";
import { uuid } from "@/lib/validation/common";
import { DOCUMENT_BUCKET } from "@/lib/validation/documents";
import { syncTags } from "@/lib/server/tags";
import { requireEditor } from "./auth-guard";
import { fail, mapDbError, ok, validationFail, type ActionResult } from "./result";

const PHOTO_BUCKET = "item-photos";

function toRow(input: ItemInput) {
  const { tags: _tags, ...row } = input;
  return row;
}

export async function createItemAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
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
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
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
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
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
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsedId = uuid.safeParse(id);
  if (!parsedId.success) return validationFail(parsedId.error);

  const [{ data: photos }, { data: documents }] = await Promise.all([
    auth.supabase.from("item_photos").select("storage_path, thumb_path").eq("item_id", parsedId.data),
    auth.supabase.from("item_documents").select("storage_path").eq("item_id", parsedId.data),
  ]);
  const { data, error } = await auth.supabase.from("items").delete().eq("id", parsedId.data).select("id");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  const paths = (photos ?? []).flatMap((p) => [p.storage_path, p.thumb_path].filter((x): x is string => Boolean(x)));
  if (paths.length) await auth.supabase.storage.from(PHOTO_BUCKET).remove(paths);
  if (documents?.length) await auth.supabase.storage.from(DOCUMENT_BUCKET).remove(documents.map((d) => d.storage_path));
  return ok();
}

export async function adjustQuantityAction(input: unknown): Promise<ActionResult<{ quantity: number }>> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
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

/** Registers a photo the client already uploaded to Storage (under the household folder). */
export async function addPhotoAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsed = photoInputSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { itemId, storagePath, thumbPath } = parsed.data;
  const prefix = `${auth.householdId}/${itemId}/`;
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
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
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
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
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

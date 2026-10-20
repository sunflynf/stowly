"use server";

import { uuid } from "@/lib/validation/common";
import { addDocumentSchema, DOCUMENT_BUCKET, DOCUMENT_MAX_BYTES, DOCUMENT_TYPES } from "@/lib/validation/documents";
import { requireEditor } from "./auth-guard";
import { fail, mapDbError, ok, validationFail, type ActionResult } from "./result";

/**
 * Registers a document the client uploaded to Storage. The type and size are
 * read from the stored object, not trusted from the client; the bucket itself
 * also rejects other types and files over 10 MB.
 */
export async function addDocumentAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsed = addDocumentSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { itemId, storagePath, kind, title } = parsed.data;

  const folder = `${auth.householdId}/${itemId}`;
  const name = storagePath.slice(folder.length + 1);
  if (!storagePath.startsWith(`${folder}/`) || !/^[\w-]+\.(pdf|jpg|png|webp)$/.test(name)) return fail("validation");

  const { data: listed } = await auth.supabase.storage.from(DOCUMENT_BUCKET).list(folder, { search: name, limit: 1 });
  const object = listed?.find((o) => o.name === name);
  const mimeType = typeof object?.metadata?.mimetype === "string" ? object.metadata.mimetype : null;
  const size = typeof object?.metadata?.size === "number" ? object.metadata.size : null;
  if (!object || !mimeType || !(mimeType in DOCUMENT_TYPES) || !size || size > DOCUMENT_MAX_BYTES) return fail("validation");

  const { data, error } = await auth.supabase
    .from("item_documents")
    .insert({ item_id: itemId, kind, title, storage_path: storagePath, mime_type: mimeType, size_bytes: size })
    .select("id")
    .single();
  if (error) return fail(mapDbError(error));
  return ok({ id: data.id });
}

export async function deleteDocumentAction(id: unknown): Promise<ActionResult> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsedId = uuid.safeParse(id);
  if (!parsedId.success) return validationFail(parsedId.error);
  const { data, error } = await auth.supabase.from("item_documents").delete().eq("id", parsedId.data).select("storage_path");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  await auth.supabase.storage.from(DOCUMENT_BUCKET).remove(data.map((d) => d.storage_path));
  return ok();
}

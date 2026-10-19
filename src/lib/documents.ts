"use client";

import { addDocumentAction } from "@/lib/actions/documents";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { DOCUMENT_BUCKET, DOCUMENT_MAX_BYTES, DOCUMENT_TYPES, type DocumentKind } from "@/lib/validation/documents";

export class DocumentUploadError extends Error {
  constructor(public code: "documentType" | "documentSize" | "unauthorized") {
    super(code);
  }
}

/** Uploads a warranty card, invoice or manual (PDF or image, up to 10 MB) and registers it on the item. */
export async function uploadItemDocument(itemId: string, file: File, kind: DocumentKind) {
  const ext = DOCUMENT_TYPES[file.type as keyof typeof DOCUMENT_TYPES];
  if (!ext) throw new DocumentUploadError("documentType");
  if (file.size > DOCUMENT_MAX_BYTES) throw new DocumentUploadError("documentSize");

  const supabase = getSupabaseBrowser();
  const { data: householdId } = await supabase.rpc("current_household_id");
  if (!householdId) throw new DocumentUploadError("unauthorized");

  const storagePath = `${householdId}/${itemId}/${crypto.randomUUID()}.${ext}`;
  const bucket = supabase.storage.from(DOCUMENT_BUCKET);
  const { error } = await bucket.upload(storagePath, file, { contentType: file.type, cacheControl: "3600" });
  if (error) throw error;
  const result = await addDocumentAction({ itemId, storagePath, kind, title: file.name });
  if (!result.ok) {
    await bucket.remove([storagePath]);
    throw new Error(result.error);
  }
  return result.data.id;
}

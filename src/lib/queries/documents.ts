"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { DOCUMENT_BUCKET } from "@/lib/validation/documents";
import { qk } from "./keys";

export function useItemDocuments(itemId: string) {
  return useQuery({
    queryKey: qk.itemDocuments(itemId),
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser()
        .from("item_documents")
        .select("id, kind, title, storage_path, mime_type, size_bytes, created_at")
        .eq("item_id", itemId)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}
export type ItemDocument = NonNullable<ReturnType<typeof useItemDocuments>["data"]>[number];

/** Short-lived signed URL to view a document, or to download it under its original name. */
export async function documentUrl(doc: Pick<ItemDocument, "storage_path" | "title">, download = false) {
  const { data, error } = await getSupabaseBrowser()
    .storage.from(DOCUMENT_BUCKET)
    .createSignedUrl(doc.storage_path, 600, download ? { download: doc.title } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const TRASH_DAYS = 30;

/**
 * Removes items that have been in the trash for more than 30 days, with their
 * photo and document files. Run by the hourly cron job (service role).
 */
export async function purgeExpiredTrash(now = new Date()): Promise<{ purged: number; errors: string[] }> {
  const db = getSupabaseAdmin();
  const cutoff = new Date(now.getTime() - TRASH_DAYS * 86_400_000).toISOString();
  const errors: string[] = [];
  let purged = 0;

  for (let round = 0; round < 20; round++) {
    const { data: items, error } = await db.from("items").select("id").not("deleted_at", "is", null).lt("deleted_at", cutoff).limit(200);
    if (error) return { purged, errors: [...errors, error.message] };
    if (!items.length) break;
    const ids = items.map((i) => i.id);

    const [{ data: photos }, { data: docs }] = await Promise.all([
      db.from("item_photos").select("storage_path, thumb_path").in("item_id", ids),
      db.from("item_documents").select("storage_path").in("item_id", ids),
    ]);
    const photoPaths = (photos ?? []).flatMap((p) => [p.storage_path, p.thumb_path].filter((x): x is string => Boolean(x)));
    const docPaths = (docs ?? []).map((d) => d.storage_path);
    if (photoPaths.length) {
      const { error: e } = await db.storage.from("item-photos").remove(photoPaths);
      if (e) errors.push(`photos: ${e.message}`);
    }
    if (docPaths.length) {
      const { error: e } = await db.storage.from("item-documents").remove(docPaths);
      if (e) errors.push(`documents: ${e.message}`);
    }

    const { error: deleteError } = await db.from("items").delete().in("id", ids);
    if (deleteError) return { purged, errors: [...errors, deleteError.message] };
    purged += ids.length;
    if (ids.length < 200) break;
  }
  return { purged, errors };
}

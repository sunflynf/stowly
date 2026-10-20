"use client";

import imageCompression from "browser-image-compression";
import { addPhotoAction } from "@/lib/actions/items";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { PHOTO_BUCKET } from "@/lib/queries/items";

export const MAX_PHOTOS = 5;

const EXT: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

async function compress(file: File, maxSide: number, maxSizeMB: number) {
  const out = await imageCompression(file, {
    maxWidthOrHeight: maxSide,
    maxSizeMB,
    fileType: "image/webp",
    initialQuality: 0.8,
    useWebWorker: true,
  });
  // Older Safari cannot encode WebP and silently returns PNG; re-encode those as JPEG.
  if (out.type === "image/webp" || out.type === "image/jpeg") return out;
  return imageCompression(file, { maxWidthOrHeight: maxSide, maxSizeMB, fileType: "image/jpeg", initialQuality: 0.8 });
}

/** Resizes a photo client-side (1600px main + 320px thumbnail), uploads both and registers them. */
export async function uploadItemPhoto(itemId: string, file: File) {
  const supabase = getSupabaseBrowser();
  // Photos live under the household folder, which members can read and editors write.
  const { data: householdId } = await supabase.rpc("current_household_id");
  if (!householdId) throw new Error("unauthorized");

  const [main, thumb] = await Promise.all([compress(file, 1600, 0.6), compress(file, 320, 0.05)]);
  const id = crypto.randomUUID();
  const storagePath = `${householdId}/${itemId}/${id}.${EXT[main.type] ?? "jpg"}`;
  const thumbPath = `${householdId}/${itemId}/${id}_t.${EXT[thumb.type] ?? "jpg"}`;

  const bucket = supabase.storage.from(PHOTO_BUCKET);
  const [a, b] = await Promise.all([
    bucket.upload(storagePath, main, { contentType: main.type, cacheControl: "31536000" }),
    bucket.upload(thumbPath, thumb, { contentType: thumb.type, cacheControl: "31536000" }),
  ]);
  if (a.error || b.error) {
    await bucket.remove([storagePath, thumbPath]);
    throw a.error ?? b.error;
  }
  const result = await addPhotoAction({ itemId, storagePath, thumbPath });
  if (!result.ok) throw new Error(result.error);
  return result.data.id;
}

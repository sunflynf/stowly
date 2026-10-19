"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { qk } from "./keys";

export const PHOTO_BUCKET = "item-photos";

export function useItem(id: string) {
  return useQuery({
    queryKey: qk.item(id),
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser()
        .from("items")
        .select(
          "*, category:categories(id, name, name_en, icon, default_attributes), location:locations(id, name, name_en, path_text, path_text_en), group:item_groups(id, name), photos:item_photos(id, storage_path, thumb_path, sort_order, created_at), item_tags(tag:tags(id, name))",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const photos = [...data.photos].sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at));
      const tags = data.item_tags.map((it) => it.tag).filter((t): t is { id: string; name: string } => Boolean(t));
      return { ...data, photos, tags };
    },
  });
}
export type ItemDetail = NonNullable<ReturnType<typeof useItem>["data"]>;

export function useItemEvents(id: string) {
  return useQuery({
    queryKey: qk.itemEvents(id),
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser()
        .from("item_events")
        .select("*")
        .eq("item_id", id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });
}

/** Signed URLs for private photos, cached for most of their lifetime. */
export function usePhotoUrls(paths: (string | null | undefined)[]) {
  const clean = [...new Set(paths.filter((p): p is string => Boolean(p)))].sort();
  return useQuery({
    queryKey: qk.photoUrls(clean),
    enabled: clean.length > 0,
    staleTime: 50 * 60_000,
    gcTime: 55 * 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().storage.from(PHOTO_BUCKET).createSignedUrls(clean, 3600);
      if (error) throw error;
      const entries = data.flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : []));
      return Object.fromEntries(entries) as Record<string, string>;
    },
  });
}

export function useItemAlerts(id: string) {
  return useQuery({
    queryKey: [...qk.item(id), "alerts"],
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser()
        .from("item_alerts")
        .select("kind, severity, days_left, due_date, snoozed")
        .eq("item_id", id)
        .order("severity", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useShoppingList() {
  return useQuery({
    queryKey: qk.shopping,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser()
        .from("shopping_list")
        .select("*, item:items(id, name, quantity, unit), group:item_groups(id, name)")
        .order("done")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data.map((r) => ({ ...r, quantity: Number(r.quantity) }));
    },
  });
}
export type ShoppingEntry = NonNullable<ReturnType<typeof useShoppingList>["data"]>[number];

/** An active item with this barcode, if the user already owns one. */
export async function findItemByBarcode(code: string) {
  const { data } = await getSupabaseBrowser()
    .from("items")
    .select("id, name, quantity, unit")
    .eq("barcode", code)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

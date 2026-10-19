"use client";

import { useQuery } from "@tanstack/react-query";
import { useLocale } from "next-intl";
import { useMemo } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { CategoryRow, LocationRow, TagRow } from "@/lib/types";
import { attributeDefsSchema, type AttributeDef } from "@/lib/validation/item";
import { qk } from "./keys";

export type Category = CategoryRow & { attributes: AttributeDef[] };

export function useCategories() {
  return useQuery({
    queryKey: qk.categories,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Category[]> => {
      const { data, error } = await getSupabaseBrowser()
        .from("categories")
        .select("*")
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return data.map((c) => {
        const parsed = attributeDefsSchema.safeParse(c.default_attributes);
        return { ...c, attributes: parsed.success ? parsed.data : [] };
      });
    },
  });
}

export function useLocations() {
  return useQuery({
    queryKey: qk.locations,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<LocationRow[]> => {
      const { data, error } = await getSupabaseBrowser()
        .from("locations")
        .select("*")
        .order("sort_order")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useTags() {
  return useQuery({
    queryKey: qk.tags,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<TagRow[]> => {
      const { data, error } = await getSupabaseBrowser().from("tags").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });
}

/** Display helpers that pick the label for the current locale. */
export function useLabels() {
  const locale = useLocale();
  return useMemo(
    () => ({
      category: (c: Pick<CategoryRow, "name" | "name_en"> | undefined | null) =>
        !c ? "" : locale === "en" && c.name_en ? c.name_en : c.name,
      location: (l: Pick<LocationRow, "name" | "name_en"> | undefined | null) =>
        !l ? "" : locale === "en" && l.name_en ? l.name_en : l.name,
      locationPath: (l: Pick<LocationRow, "path_text" | "path_text_en"> | undefined | null) =>
        !l ? "" : locale === "en" && l.path_text_en ? l.path_text_en : l.path_text,
      path: (vi: string | null | undefined, en: string | null | undefined) =>
        (locale === "en" && en ? en : vi) ?? "",
      attribute: (a: { label_vi: string; label_en: string }) => (locale === "en" ? a.label_en : a.label_vi),
    }),
    [locale],
  );
}

export interface LocationNode extends LocationRow {
  children: LocationNode[];
  depth: number;
}

/** Builds the location tree (roots first, siblings by sort order). */
export function buildLocationTree(rows: LocationRow[]): LocationNode[] {
  const nodes = new Map<string, LocationNode>(rows.map((r) => [r.id, { ...r, children: [], depth: r.path_ids.length - 1 }]));
  const roots: LocationNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parent_id ? nodes.get(node.parent_id) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sort = (list: LocationNode[]) => {
    list.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    list.forEach((n) => sort(n.children));
  };
  sort(roots);
  return roots;
}

/** Depth-first flattening of the tree, handy for pickers. */
export function flattenTree(nodes: LocationNode[]): LocationNode[] {
  return nodes.flatMap((n) => [n, ...flattenTree(n.children)]);
}

export function useLocationCounts() {
  return useQuery({
    queryKey: [...qk.locations, "counts"],
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().rpc("location_counts");
      if (error) throw error;
      return new Map(data.map((r) => [r.location_id, Number(r.item_count)]));
    },
  });
}

export function useTagCounts() {
  return useQuery({
    queryKey: [...qk.tags, "counts"],
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().rpc("tag_counts");
      if (error) throw error;
      return new Map(data.map((r) => [r.tag_id, Number(r.item_count)]));
    },
  });
}

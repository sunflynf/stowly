"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { ALERT_KINDS, ITEM_CONDITIONS, type AlertKind, type ItemCondition } from "@/lib/types";
import { qk } from "./keys";

export const SORTS = ["relevance", "name", "updated", "expiry", "low_stock"] as const;
export type SortKey = (typeof SORTS)[number];
export const PAGE_SIZE = 50;

export interface ItemSearchParams {
  q: string;
  categories: string[];
  location: string | null;
  conditions: ItemCondition[];
  tags: string[];
  group: string | null;
  states: AlertKind[];
  priceMin: number | null;
  priceMax: number | null;
  archived: boolean;
  sort: SortKey;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const list = (v: string | null) => (v ? v.split(",").filter(Boolean) : []);
const num = (v: string | null) => (v && Number.isFinite(Number(v)) ? Number(v) : null);

export function parseItemSearch(sp: URLSearchParams): ItemSearchParams {
  const sort = sp.get("sort");
  const q = (sp.get("q") ?? "").slice(0, 200);
  return {
    q,
    categories: list(sp.get("categories")).filter((c) => UUID.test(c)),
    location: UUID.test(sp.get("location") ?? "") ? sp.get("location") : null,
    conditions: list(sp.get("conditions")).filter((c): c is ItemCondition => (ITEM_CONDITIONS as readonly string[]).includes(c)),
    tags: list(sp.get("tags")).filter((c) => UUID.test(c)),
    group: UUID.test(sp.get("group") ?? "") ? sp.get("group") : null,
    states: list(sp.get("states")).filter((c): c is AlertKind => (ALERT_KINDS as readonly string[]).includes(c)),
    priceMin: num(sp.get("price_min")),
    priceMax: num(sp.get("price_max")),
    archived: sp.get("archived") === "1",
    sort: (SORTS as readonly string[]).includes(sort ?? "") ? (sort as SortKey) : q ? "relevance" : "updated",
  };
}

export function itemSearchToQuery(p: ItemSearchParams): string {
  const sp = new URLSearchParams();
  if (p.q) sp.set("q", p.q);
  if (p.categories.length) sp.set("categories", p.categories.join(","));
  if (p.location) sp.set("location", p.location);
  if (p.conditions.length) sp.set("conditions", p.conditions.join(","));
  if (p.tags.length) sp.set("tags", p.tags.join(","));
  if (p.group) sp.set("group", p.group);
  if (p.states.length) sp.set("states", p.states.join(","));
  if (p.priceMin !== null) sp.set("price_min", String(p.priceMin));
  if (p.priceMax !== null) sp.set("price_max", String(p.priceMax));
  if (p.archived) sp.set("archived", "1");
  const defaultSort = p.q ? "relevance" : "updated";
  if (p.sort !== defaultSort) sp.set("sort", p.sort);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export interface SearchRow {
  id: string;
  name: string;
  quantity: number;
  unit: string | null;
  min_quantity: number | null;
  condition: ItemCondition;
  category_id: string | null;
  location_id: string | null;
  location_path: string | null;
  location_path_en: string | null;
  group_id: string | null;
  expiry_date: string | null;
  warranty_until: string | null;
  purchase_price: number | null;
  updated_at: string;
  thumb_path: string | null;
  alert_kinds: AlertKind[];
}

export interface SearchPage {
  rows: SearchRow[];
  total: number;
  offset: number;
}

export async function fetchSearchPage(p: ItemSearchParams, offset: number, limit = PAGE_SIZE): Promise<SearchPage> {
  const { data, error } = await getSupabaseBrowser().rpc("search_items", {
    p_query: p.q || undefined,
    p_category_ids: p.categories.length ? p.categories : undefined,
    p_location_id: p.location ?? undefined,
    p_conditions: p.conditions.length ? p.conditions : undefined,
    p_tag_ids: p.tags.length ? p.tags : undefined,
    p_group_id: p.group ?? undefined,
    p_states: p.states.length ? p.states : undefined,
    p_price_min: p.priceMin ?? undefined,
    p_price_max: p.priceMax ?? undefined,
    p_archived: p.archived,
    p_sort: p.sort,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return {
    rows: data.map((r) => ({
      ...r,
      quantity: Number(r.quantity),
      min_quantity: r.min_quantity === null ? null : Number(r.min_quantity),
      purchase_price: r.purchase_price === null ? null : Number(r.purchase_price),
      alert_kinds: r.alert_kinds ?? [],
    })),
    total: Number(data[0]?.total_count ?? 0),
    offset,
  };
}

export function useItemSearch(p: ItemSearchParams) {
  return useInfiniteQuery({
    queryKey: qk.itemSearch(p),
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchSearchPage(p, pageParam),
    getNextPageParam: (last) => {
      const next = last.offset + last.rows.length;
      return next < last.total ? next : undefined;
    },
    placeholderData: keepPreviousData,
  });
}

"use client";

import { keepPreviousData, useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { qk } from "./keys";

const money = z.coerce.number();
const spendingSchema = z.object({
  from: z.string(),
  to: z.string(),
  currency: z.string(),
  total: money,
  count: z.number(),
  previous_total: money,
  unpriced: z.number(),
  undated_priced: z.number(),
  by_month: z.array(z.object({ month: z.string(), total: money, count: z.number() })),
  by_category: z.array(z.object({ category_id: z.string().nullable(), total: money, count: z.number() })),
  by_room: z.array(z.object({ location_id: z.string().nullable(), total: money, count: z.number() })),
  top: z.array(z.object({ id: z.string(), name: z.string(), price: money, date: z.string(), category_id: z.string().nullable() })),
});
export type Spending = z.infer<typeof spendingSchema>;

export function useSpending(range: { from: string | null; to: string }) {
  return useQuery({
    queryKey: [...qk.items, "spending", range],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().rpc("spending_stats", {
        p_from: range.from ?? undefined,
        p_to: range.to,
      });
      if (error) throw error;
      return spendingSchema.parse(data);
    },
  });
}

export type SuggestionReason = "idle" | "worn" | "broken" | "duplicate";
const SUGGESTION_PAGE = 30;

export function useSuggestionCounts() {
  return useQuery({
    queryKey: [...qk.items, "suggestions", "counts"],
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().rpc("unused_suggestion_counts");
      if (error) throw error;
      const out: Record<SuggestionReason, number> = { idle: 0, worn: 0, broken: 0, duplicate: 0 };
      data.forEach((r) => (out[r.reason as SuggestionReason] = Number(r.total)));
      return out;
    },
  });
}

/** One reason's suggestions, paged (there can be thousands). */
export function useSuggestions(reason: SuggestionReason) {
  return useInfiniteQuery({
    queryKey: [...qk.items, "suggestions", reason],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await getSupabaseBrowser().rpc("unused_suggestions", {
        p_reason: reason,
        p_limit: SUGGESTION_PAGE,
        p_offset: pageParam,
      });
      if (error) throw error;
      return data.map((r) => ({
        ...r,
        quantity: Number(r.quantity),
        purchase_price: r.purchase_price === null ? null : Number(r.purchase_price),
        reason: r.reason as SuggestionReason,
      }));
    },
    getNextPageParam: (last, pages) => (last.length === SUGGESTION_PAGE ? pages.length * SUGGESTION_PAGE : undefined),
  });
}
export type Suggestion = NonNullable<ReturnType<typeof useSuggestions>["data"]>["pages"][number][number];

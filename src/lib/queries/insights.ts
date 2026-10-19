"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
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

export function useSuggestions() {
  return useQuery({
    queryKey: [...qk.items, "suggestions"],
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().rpc("unused_suggestions");
      if (error) throw error;
      return data.map((r) => ({
        ...r,
        quantity: Number(r.quantity),
        purchase_price: r.purchase_price === null ? null : Number(r.purchase_price),
        reason: r.reason as "idle" | "worn" | "broken" | "duplicate",
      }));
    },
  });
}
export type Suggestion = NonNullable<ReturnType<typeof useSuggestions>["data"]>[number];

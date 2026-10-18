"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { qk } from "./keys";

const statsSchema = z.object({
  total_items: z.number(),
  added_30d: z.number(),
  expiring_30d: z.number(),
  expired: z.number(),
  low_stock: z.number(),
  low_stock_names: z.array(z.string()),
  warranty_ending: z.number(),
  warranty_min_days: z.number().nullable(),
  attention: z.number(),
});
export type DashboardStats = z.infer<typeof statsSchema>;

export function useDashboardStats() {
  return useQuery({
    queryKey: qk.stats,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().rpc("dashboard_stats");
      if (error) throw error;
      return statsSchema.parse(data);
    },
  });
}

export function useCategoryCounts() {
  return useQuery({
    queryKey: qk.categoryCounts,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().rpc("category_counts");
      if (error) throw error;
      return data;
    },
  });
}

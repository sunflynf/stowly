"use client";

import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { qk } from "./keys";

const reportSchema = z.object({
  total: z.coerce.number(),
  count: z.number(),
  unpriced: z.number(),
  rows: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      category_id: z.string().nullable(),
      location_path: z.string().nullable(),
      location_path_en: z.string().nullable(),
      quantity: z.coerce.number(),
      unit: z.string().nullable(),
      purchase_price: z.coerce.number(),
      purchase_date: z.string().nullable(),
      purchase_place: z.string().nullable(),
      warranty_until: z.string().nullable(),
      brand: z.string().nullable(),
      model: z.string().nullable(),
      serial: z.string().nullable(),
      thumb_path: z.string().nullable(),
      documents: z.number(),
    }),
  ),
});
export type InsuranceReportData = z.infer<typeof reportSchema>;

export interface InsuranceFilters {
  min: number | null;
  category: string | null;
  location: string | null;
}

/** Valued items for the insurance report, from insurance_report() (most valuable first). */
export function useInsuranceReport(filters: InsuranceFilters) {
  return useQuery({
    queryKey: [...qk.items, "insurance", filters],
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().rpc("insurance_report", {
        p_min_value: filters.min ?? undefined,
        p_category_ids: filters.category ? [filters.category] : undefined,
        p_location_id: filters.location ?? undefined,
      });
      if (error) throw error;
      return reportSchema.parse(data);
    },
  });
}

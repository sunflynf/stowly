"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { loanOf, type Loan } from "@/lib/validation/loans";
import { qk } from "./keys";

export interface LoanRow extends Loan {
  id: string;
  name: string;
  location_path: string | null;
  location_path_en: string | null;
  thumb_path: string | null;
}

/** Every item currently lent out or borrowed, soonest due first. */
export function useLoans() {
  return useQuery({
    queryKey: qk.loans,
    queryFn: async (): Promise<LoanRow[]> => {
      const { data, error } = await getSupabaseBrowser()
        .from("items")
        .select("id, name, attributes, location:locations(path_text, path_text_en), photos:item_photos(thumb_path, sort_order)")
        .is("archived_at", null)
        .or("attributes->>lent_to.not.is.null,attributes->>borrowed_from.not.is.null")
        .order("name")
        .limit(1000);
      if (error) throw error;
      return data
        .flatMap((i) => {
          const loan = loanOf(i.attributes);
          if (!loan) return [];
          const thumb = [...i.photos].sort((a, b) => a.sort_order - b.sort_order)[0]?.thumb_path ?? null;
          return [{ ...loan, id: i.id, name: i.name, location_path: i.location?.path_text ?? null, location_path_en: i.location?.path_text_en ?? null, thumb_path: thumb }];
        })
        .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999") || a.name.localeCompare(b.name));
    },
  });
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabaseBrowser } from "@/lib/supabase/client";

export interface PickedItem {
  id: string;
  name: string;
}

/** Optional item for a task: type to search your items, pick one, or leave it standalone. */
export function ItemPicker({ id, value, onChange }: { id: string; value: PickedItem | null; onChange: (item: PickedItem | null) => void }) {
  const t = useTranslations("maintenance");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(timer);
  }, [query]);

  const { data: results = [] } = useQuery({
    queryKey: ["items", "picker", debounced],
    enabled: debounced.length >= 2,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().rpc("search_items", { p_query: debounced, p_limit: 8 });
      if (error) throw error;
      return data.map((r) => ({ id: r.id, name: r.name, path: r.location_path }));
    },
  });

  if (value) {
    return (
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-[var(--radius)] border border-input bg-card px-3">
        <span className="truncate font-medium">{value.name}</span>
        <Button type="button" variant="ghost" size="icon" aria-label={t("unlinkItem")} onClick={() => onChange(null)}>
          <X />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <Input id={id} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("itemSearch")} autoComplete="off" />
      {debounced.length >= 2 && (
        <ul className="max-h-56 overflow-y-auto rounded-[var(--radius)] border border-border bg-card" aria-label={t("itemResults")}>
          {results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">{t("itemNone")}</li>
          ) : (
            results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  className="flex min-h-11 w-full flex-col items-start px-3 py-1.5 text-left hover:bg-muted"
                  onClick={() => {
                    onChange({ id: r.id, name: r.name });
                    setQuery("");
                  }}
                >
                  <span className="font-medium">{r.name}</span>
                  {r.path && <span className="text-xs text-muted-foreground">{r.path}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

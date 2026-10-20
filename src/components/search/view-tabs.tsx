"use client";

import { useFormatter, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ItemSearchParams } from "@/lib/queries/search";

export type ItemView = "all" | "expiring" | "stock";

const STOCK_STATES = ["out_of_stock", "low_stock"] as const;
const EXPIRY_STATES = ["expired", "expiring_soon"] as const;

/** The view is derived from the `states` URL param, so dashboard links and old bookmarks keep working. */
export function viewOf(params: Pick<ItemSearchParams, "states">): ItemView {
  if (params.states.some((s) => (STOCK_STATES as readonly string[]).includes(s))) return "stock";
  if (params.states.some((s) => (EXPIRY_STATES as readonly string[]).includes(s))) return "expiring";
  return "all";
}

function patchFor(view: ItemView, params: ItemSearchParams): Partial<ItemSearchParams> {
  // Keep other state filters (e.g. warranty ending) but swap the expiry/stock ones.
  const others = params.states.filter(
    (s) => !(STOCK_STATES as readonly string[]).includes(s) && !(EXPIRY_STATES as readonly string[]).includes(s),
  );
  const staleSort = params.sort === "expiry" || params.sort === "low_stock";
  const fallbackSort = params.q ? "relevance" : "updated";
  if (view === "expiring") return { states: [...EXPIRY_STATES], sort: "expiry" };
  if (view === "stock") return { states: [...STOCK_STATES], sort: "low_stock" };
  return { states: others, sort: staleSort ? fallbackSort : params.sort };
}

/** Segmented control above the list: All / Expiring / Low stock, with counts. */
export function ViewTabs({
  params,
  counts,
  onChange,
}: {
  params: ItemSearchParams;
  counts?: Partial<Record<ItemView, number>>;
  onChange: (patch: Partial<ItemSearchParams>) => void;
}) {
  const t = useTranslations("items.views");
  const format = useFormatter();
  const current = viewOf(params);
  const views: ItemView[] = ["all", "expiring", "stock"];

  return (
    <div role="group" aria-label={t("label")} className="-mx-4 mb-3 flex gap-1 overflow-x-auto px-4 md:mx-0 md:px-0">
      {views.map((v) => {
        const count = counts?.[v];
        const active = v === current;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={active}
            onClick={() => !active && onChange(patchFor(v, params))}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md px-4 text-[15px] font-medium whitespace-nowrap transition-colors",
              active ? "bg-accent font-semibold text-accent-foreground" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t(v)}
            {count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums",
                  active ? "bg-card text-accent-foreground" : "bg-muted text-neutral-foreground",
                )}
              >
                {format.number(count, "integer")}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

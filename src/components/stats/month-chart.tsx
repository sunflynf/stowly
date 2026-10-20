"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { niceTicks } from "@/lib/insights";
import { isoToDate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export interface MonthPoint {
  month: string; // yyyy-MM
  total: number;
  count: number;
}

/**
 * Monthly spending columns: one series, brand teal, thin rounded-cap bars on a
 * hairline grid. Every bar is focusable with a tooltip; only the peak is labelled.
 */
export function MonthChart({ data, currency }: { data: MonthPoint[]; currency: string }) {
  const t = useTranslations("stats");
  const format = useFormatter();
  const [active, setActive] = useState<number | null>(null);

  const max = Math.max(0, ...data.map((d) => d.total));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const peak = data.findIndex((d) => d.total === max && max > 0);
  const compact = (n: number) => format.number(n, { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 });
  const full = (n: number) => format.number(n, { style: "currency", currency, maximumFractionDigits: currency === "VND" ? 0 : 2 });
  const monthLabel = (m: string, long = false) =>
    format.dateTime(isoToDate(`${m}-01`), long ? { month: "long", year: "numeric", timeZone: "UTC" } : { month: "short", timeZone: "UTC" });
  // Thin out x labels on long ranges.
  const every = data.length <= 12 ? 1 : Math.ceil(data.length / 12);

  return (
    <div
      role="group"
      aria-label={peak >= 0 ? t("chartLabel", { month: monthLabel(data[peak].month, true), amount: full(max) }) : t("byMonth")}
      className="relative"
    >
      <div className="relative ml-12 h-56">
        {/* Gridlines + y ticks (recessive hairlines). */}
        {ticks.map((tick) => (
          <div key={tick} className="absolute inset-x-0 border-t border-border" style={{ bottom: `${(tick / top) * 100}%` }} aria-hidden>
            <span className="absolute -top-2 right-full mr-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums">{compact(tick)}</span>
          </div>
        ))}
        <ol className="absolute inset-0 flex items-end gap-[2px]">
          {data.map((d, i) => {
            const h = (d.total / top) * 100;
            return (
              <li key={d.month} className="relative flex h-full flex-1 items-end justify-center">
                <button
                  type="button"
                  className="group flex h-full w-full items-end justify-center outline-none"
                  aria-label={t("barLabel", { month: monthLabel(d.month, true), amount: full(d.total), count: d.count })}
                  onPointerEnter={() => setActive(i)}
                  onPointerLeave={() => setActive((a) => (a === i ? null : a))}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive((a) => (a === i ? null : a))}
                >
                  <span
                    className={cn(
                      "block w-full max-w-6 rounded-t-[4px] bg-primary transition-opacity group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-ring",
                      active !== null && active !== i && "opacity-60",
                    )}
                    style={{ height: d.total > 0 ? `max(${h}%, 2px)` : 0 }}
                  />
                </button>
                {i === peak && active === null && (
                  <span className="pointer-events-none absolute -translate-y-1 text-xs font-semibold whitespace-nowrap" style={{ bottom: `${h}%` }}>
                    {compact(d.total)}
                  </span>
                )}
                {active === i && (
                  <span
                    role="tooltip"
                    className={cn(
                      "pointer-events-none absolute z-10 mb-2 min-w-32 rounded-md border border-border bg-popover px-3 py-2 text-left shadow-lg",
                      i > data.length / 2 ? "right-0" : "left-0",
                    )}
                    style={{ bottom: `${Math.min(h, 75)}%` }}
                  >
                    <span className="block font-semibold tabular-nums">{full(d.total)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {monthLabel(d.month, true)} · {t("purchases", { count: d.count })}
                    </span>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
      <ol className="mt-2 ml-12 flex gap-[2px]" aria-hidden>
        {data.map((d, i) => (
          <li key={d.month} className="flex-1 truncate text-center text-xs text-muted-foreground">
            {i % every === 0 ? monthLabel(d.month) : ""}
          </li>
        ))}
      </ol>
    </div>
  );
}

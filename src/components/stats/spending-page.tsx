"use client";

import Link from "next/link";
import { useFormatter, useTimeZone, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, Table2, BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { isoToDate, todayIn } from "@/lib/dates";
import { useFormats } from "@/lib/hooks/use-format";
import { monthsCovered, percentChange, periodRange, PERIODS, type Period } from "@/lib/insights";
import { useSpending } from "@/lib/queries/insights";
import { useCategories, useLabels, useLocations } from "@/lib/queries/taxonomy";
import { cn } from "@/lib/utils";
import { MonthChart } from "./month-chart";

function Tile({ label, value, hint, className }: { label: string; value: string; hint?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col rounded-[var(--radius-lg)] border border-border bg-card p-4 md:p-5", className)}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="mt-1 truncate text-[26px] leading-tight font-bold md:text-[30px]">{value}</span>
      {hint && <span className="mt-1 text-sm text-muted-foreground">{hint}</span>}
    </div>
  );
}

/** Ranked horizontal bars with value + share (single series, brand teal). */
function RankedBars({ rows, currency, total }: { rows: { key: string; label: string; total: number; count: number; href?: string }[]; currency: string; total: number }) {
  const t = useTranslations("stats");
  const format = useFormatter();
  const max = Math.max(1, ...rows.map((r) => r.total));
  const money = (n: number) => format.number(n, { style: "currency", currency, notation: "compact", maximumFractionDigits: 1 });
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((r) => {
        const pct = total ? Math.round((r.total / total) * 100) : 0;
        const content = (
          <>
            <span className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[15px]">{r.label}</span>
              <span className="shrink-0 text-[15px] font-semibold tabular-nums">{money(r.total)}</span>
            </span>
            <span className="mt-1.5 flex items-center gap-3">
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                <span className="block h-full rounded-full bg-primary" style={{ width: `${(r.total / max) * 100}%` }} />
              </span>
              <span className="shrink-0 text-right text-xs whitespace-nowrap text-muted-foreground">
                {t("share", { pct })} · {t("purchases", { count: r.count })}
              </span>
            </span>
          </>
        );
        return (
          <li key={r.key}>
            {r.href ? (
              <Link href={r.href} className="block rounded-md hover:bg-muted/40">
                {content}
              </Link>
            ) : (
              content
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function SpendingPage() {
  const t = useTranslations("stats");
  const format = useFormatter();
  const f = useFormats();
  const labels = useLabels();
  const timeZone = useTimeZone() ?? "Asia/Ho_Chi_Minh";
  const [period, setPeriod] = useState<Period>("12m");
  const [table, setTable] = useState(false);
  const today = todayIn(timeZone);
  const range = useMemo(() => periodRange(period, today), [period, today]);
  const { data, isPending, isFetching } = useSpending(range);
  const { data: categories = [] } = useCategories();
  const { data: locations = [] } = useLocations();

  const currency = data?.currency ?? "VND";
  const money = (n: number) => format.number(n, { style: "currency", currency, maximumFractionDigits: currency === "VND" ? 0 : 2 });
  const months = data ? monthsCovered(data.from, data.to) : 1;
  const change = data ? percentChange(data.total, data.previous_total) : null;

  const categoryRows = (data?.by_category ?? []).map((c) => {
    const cat = categories.find((x) => x.id === c.category_id);
    return {
      key: c.category_id ?? "none",
      label: cat ? labels.category(cat) : t("noCategory"),
      total: c.total,
      count: c.count,
      href: c.category_id ? `/items?categories=${c.category_id}` : undefined,
    };
  });
  const roomRows = (data?.by_room ?? []).map((r) => {
    const loc = locations.find((x) => x.id === r.location_id);
    return {
      key: r.location_id ?? "none",
      label: loc ? labels.location(loc) : t("noLocation"),
      total: r.total,
      count: r.count,
      href: r.location_id ? `/locations/${r.location_id}` : undefined,
    };
  });

  const missing = data && (data.unpriced > 0 || data.undated_priced > 0) ? t("missing", { unpriced: data.unpriced, undated: data.undated_priced }).trim() : null;

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {/* One filter row above everything it scopes. */}
      <div role="radiogroup" aria-label={t("period")} className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
        {PERIODS.map((p) => (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={period === p}
            onClick={() => setPeriod(p)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-[15px] font-medium",
              period === p ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
            )}
          >
            {t(`periods.${p}`)}
          </button>
        ))}
      </div>

      {isPending || !data ? (
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (
        <div className={cn("flex flex-col gap-5 transition-opacity", isFetching && "opacity-60")} aria-busy={isFetching}>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
            <Tile
              className="col-span-2 md:col-span-1"
              label={t("total")}
              value={money(data.total)}
              hint={
                change === null ? (
                  t("noPrevious")
                ) : (
                  <span className="inline-flex items-center gap-1">
                    {change > 0 ? <ArrowUpRight className="size-4" aria-hidden /> : change < 0 ? <ArrowDownRight className="size-4" aria-hidden /> : <Minus className="size-4" aria-hidden />}
                    {t("vsPrevious", { direction: change > 0 ? "up" : change < 0 ? "down" : "same", pct: Math.abs(change) })}
                  </span>
                )
              }
            />
            <Tile label={t("count")} value={f.integer(data.count)} />
            <Tile label={t("perMonth")} value={money(Math.round(data.total / months))} />
          </div>

          {missing && <p className="text-sm text-muted-foreground">{missing}</p>}

          {data.count === 0 ? (
            <p className="rounded-[var(--radius-lg)] border border-border bg-card p-8 text-center text-muted-foreground">{t("empty")}</p>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>{t("byMonth")}</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setTable((v) => !v)} aria-pressed={table}>
                    {table ? <BarChart3 /> : <Table2 />}
                    {table ? t("showChart") : t("showTable")}
                  </Button>
                </CardHeader>
                <CardContent>
                  {table ? (
                    <table className="w-full text-left text-[15px]">
                      <thead>
                        <tr className="text-sm text-muted-foreground">
                          <th scope="col" className="py-2 font-medium">{t("month")}</th>
                          <th scope="col" className="py-2 text-right font-medium">{t("count")}</th>
                          <th scope="col" className="py-2 text-right font-medium">{t("amount")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.by_month.map((m) => (
                          <tr key={m.month} className="border-t border-border">
                            <th scope="row" className="py-2 font-normal">
                              {format.dateTime(isoToDate(`${m.month}-01`), { month: "long", year: "numeric", timeZone: "UTC" })}
                            </th>
                            <td className="py-2 text-right tabular-nums">{f.integer(m.count)}</td>
                            <td className="py-2 text-right tabular-nums">{money(m.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <MonthChart data={data.by_month} currency={currency} />
                  )}
                </CardContent>
              </Card>

              <div className="grid gap-5 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("byCategory")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RankedBars rows={categoryRows} currency={currency} total={data.total} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>{t("byRoom")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <RankedBars rows={roomRows} currency={currency} total={data.total} />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{t("top")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="flex flex-col">
                    {data.top.map((item, i) => {
                      const cat = categories.find((c) => c.id === item.category_id);
                      return (
                        <li key={item.id} className="border-b border-border last:border-0">
                          <Link href={`/items/${item.id}`} className="flex min-h-12 items-center gap-3 py-2 hover:bg-muted/40">
                            <span className="w-6 shrink-0 text-sm text-muted-foreground tabular-nums">{i + 1}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate font-medium">{item.name}</span>
                              <span className="text-sm text-muted-foreground">
                                {f.date(item.date)}
                                {cat ? ` · ${labels.category(cat)}` : ""}
                              </span>
                            </span>
                            <span className="shrink-0 font-semibold tabular-nums">{money(item.price)}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ol>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </>
  );
}

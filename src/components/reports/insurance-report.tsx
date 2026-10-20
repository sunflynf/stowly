"use client";

import { useFormatter, useNow, useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Printer } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ItemThumb } from "@/components/items/item-thumb";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormats } from "@/lib/hooks/use-format";
import { useHousehold, useHouseholdName } from "@/lib/queries/household";
import { usePhotoUrls } from "@/lib/queries/items";
import { useInsuranceReport, type InsuranceReportData } from "@/lib/queries/reports";
import { useProfile } from "@/lib/queries/stats";
import { buildLocationTree, flattenTree, useCategories, useLabels, useLocations } from "@/lib/queries/taxonomy";

type Row = InsuranceReportData["rows"][number];

/** Printable list of valuables (A4, save as PDF from the print dialog). */
export function InsuranceReport() {
  const t = useTranslations("insurance");
  const ti = useTranslations("item");
  const f = useFormats();
  const format = useFormatter();
  const now = useNow();
  const labels = useLabels();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data: profile } = useProfile();
  const { household } = useHousehold();
  const householdName = useHouseholdName();
  const { data: categories = [] } = useCategories();
  const { data: locations = [] } = useLocations();

  const minRaw = Number(params.get("min"));
  const filters = {
    min: Number.isFinite(minRaw) && minRaw > 0 ? minRaw : null,
    category: params.get("category"),
    location: params.get("location"),
  };
  const { data: report, isPending } = useInsuranceReport(filters);
  const { data: urls = {} } = usePhotoUrls(report?.rows.map((r) => r.thumb_path) ?? []);
  const currency = profile?.currency ?? "VND";
  const money = (n: number) => f.currency(n, currency);
  const tree = flattenTree(buildLocationTree(locations));

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const identity = (r: Row) => [[r.brand, r.model].filter(Boolean).join(" "), r.serial ? `S/N ${r.serial}` : null].filter(Boolean).join(" · ");
  const place = (r: Row) => labels.path(r.location_path, r.location_path_en);
  const filterSummary = [
    filters.min ? t("summaryMin", { value: money(filters.min) }) : null,
    filters.category ? labels.category(categories.find((c) => c.id === filters.category)) : null,
    filters.location ? labels.locationPath(locations.find((l) => l.id === filters.location)) : null,
  ].filter(Boolean);

  return (
    <div>
      <div className="print:hidden">
        <PageHeader
          title={t("title")}
          subtitle={t("subtitle")}
          actions={
            <Button onClick={() => window.print()} disabled={!report?.rows.length}>
              <Printer />
              {t("print")}
            </Button>
          }
        />
      </div>

      <form
        className="mb-5 grid gap-3 rounded-md border border-border bg-card p-4 sm:grid-cols-3 print:hidden"
        aria-label={t("filters")}
        onSubmit={(e) => e.preventDefault()}
      >
        <Field label={t("minValue")} htmlFor="ins-min">
          <Input
            id="ins-min"
            inputMode="numeric"
            defaultValue={filters.min ?? ""}
            placeholder="0"
            onBlur={(e) => {
              const n = Number(e.target.value.replace(/[.\s,]/g, ""));
              setParam("min", Number.isFinite(n) && n > 0 ? String(n) : null);
            }}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
        </Field>
        <Field label={t("category")} htmlFor="ins-category">
          <NativeSelect id="ins-category" value={filters.category ?? ""} onChange={(e) => setParam("category", e.target.value || null)}>
            <option value="">{t("all")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {labels.category(c)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("room")} htmlFor="ins-room">
          <NativeSelect id="ins-room" value={filters.location ?? ""} onChange={(e) => setParam("location", e.target.value || null)}>
            <option value="">{t("all")}</option>
            {tree.map((l) => (
              <option key={l.id} value={l.id}>
                {"  ".repeat(l.depth)}
                {labels.location(l)}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </form>

      {/* Printed heading: who, when, which filters. */}
      <header className="mb-4 hidden print:block">
        <h1 className="text-xl font-bold">{t("printTitle", { household: household ? householdName(household) : "" })}</h1>
        <p className="text-sm">
          {t("generated", { date: format.dateTime(now, "short") })}
          {filterSummary.length ? ` · ${filterSummary.join(" · ")}` : ""}
        </p>
      </header>

      {isPending || !report ? (
        <Skeleton className="h-64" />
      ) : report.rows.length === 0 ? (
        <p className="rounded-md border border-border bg-card p-8 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <>
          <p className="mb-3 flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border bg-card px-4 py-3 print:border-0 print:px-0">
            <span className="text-[15px]">{t("count", { count: report.count })}</span>
            <span className="text-lg font-bold tabular-nums">
              {t("total")}: {money(report.total)}
            </span>
          </p>

          {/* Phones: cards. */}
          <ul className="flex flex-col gap-2 md:hidden print:hidden">
            {report.rows.map((r) => (
              <li key={r.id}>
                <Link href={`/items/${r.id}`} className="flex gap-3 rounded-md border border-border bg-card p-3">
                  <ItemThumb name={r.name} url={r.thumb_path ? urls[r.thumb_path] : undefined} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate font-semibold">{r.name}</span>
                      <span className="shrink-0 font-semibold tabular-nums">{money(r.purchase_price)}</span>
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">{place(r) || "—"}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {r.purchase_date ? f.date(r.purchase_date) : t("noDate")}
                      {identity(r) ? ` · ${identity(r)}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>

          {/* Desktop and print: an A4-friendly table. */}
          <table className="hidden w-full border-collapse text-left text-[15px] md:table print:table print:text-[11px]">
            <thead>
              <tr className="border-b-2 border-border">
                <th scope="col" className="w-14 py-2 pr-3">
                  <span className="sr-only">{t("photo")}</span>
                </th>
                <th scope="col" className="py-2 pr-3">{t("item")}</th>
                <th scope="col" className="py-2 pr-3">{t("identity")}</th>
                <th scope="col" className="py-2 pr-3 whitespace-nowrap">{ti("fields.purchaseDate")}</th>
                <th scope="col" className="py-2 text-right whitespace-nowrap">{ti("fields.purchasePrice")}</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((r) => (
                <tr key={r.id} className="break-inside-avoid border-b border-border align-top">
                  <td className="py-2 pr-3">
                    <ItemThumb name={r.name} url={r.thumb_path ? urls[r.thumb_path] : undefined} size="sm" />
                  </td>
                  <td className="py-2 pr-3">
                    <Link href={`/items/${r.id}`} className="font-semibold hover:underline">
                      {r.name}
                    </Link>
                    <div className="text-sm text-muted-foreground print:text-[10px]">
                      {place(r)}
                      {r.purchase_place ? ` · ${r.purchase_place}` : ""}
                    </div>
                  </td>
                  <td className="py-2 pr-3">{identity(r) || <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{r.purchase_date ? f.date(r.purchase_date) : "—"}</td>
                  <td className="py-2 text-right font-semibold whitespace-nowrap tabular-nums">{money(r.purchase_price)}</td>
                </tr>
              ))}
              {/* A plain last row, not <tfoot>: print repeats a table footer on every page. */}
              <tr className="break-inside-avoid border-t-2 border-border">
                <th scope="row" colSpan={4} className="py-2 pr-3 text-right">
                  {t("total")}
                </th>
                <td className="py-2 text-right font-bold whitespace-nowrap tabular-nums">{money(report.total)}</td>
              </tr>
            </tbody>
          </table>

          {report.rows.length < report.count && <p className="mt-3 text-sm text-muted-foreground">{t("truncated", { shown: report.rows.length })}</p>}
        </>
      )}
      {report && report.unpriced > 0 && <p className="mt-3 text-sm text-muted-foreground">{t("unpriced", { count: report.unpriced })}</p>}
    </div>
  );
}

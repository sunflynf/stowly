"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, FileUp, Upload } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { useInvalidateItems } from "@/components/items/use-item-mutations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { importItemsAction, type ImportRowResult } from "@/lib/actions/import";
import { parseCsv } from "@/lib/csv";
import { autoMap, IMPORT_FIELDS, type ImportField } from "@/lib/import/columns";
import { buildRow, DUPLICATE_MODES, type DuplicateMode, type ImportRow, type RowProblem } from "@/lib/import/rows";
import { cn } from "@/lib/utils";

const MAX_ROWS = 10_000;
const CHUNK = 200;

interface Parsed {
  file: string;
  headers: string[];
  records: string[][];
}

function useFieldLabel() {
  const t = useTranslations();
  return (field: ImportField): string => {
    switch (field) {
      case "name": return t("item.fields.name");
      case "category": return t("item.fields.category");
      case "location": return t("item.fields.location");
      case "quantity": return t("item.fields.quantity");
      case "unit": return t("item.fields.unit");
      case "min_quantity": return t("item.fields.threshold");
      case "condition": return t("item.fields.condition");
      case "purchase_date": return t("item.fields.purchaseDate");
      case "purchase_price": return t("item.fields.purchasePrice");
      case "purchase_place": return t("item.fields.purchasePlace");
      case "expiry_date": return t("item.fields.expiryDate");
      case "opened_date": return t("item.fields.openedDate");
      case "warranty_until": return t("item.fields.warrantyUntil");
      case "replace_after_months": return t("item.fields.replaceAfterMonths");
      case "last_replaced_at": return t("item.fields.lastReplacedAt");
      case "tags": return t("item.fields.tags");
      case "notes": return t("item.fields.notes");
      case "barcode": return t("item.fields.barcode");
      case "group": return t("groups.group");
      case "attributes": return t("item.fields.attributes");
      case "archived": return t("importPage.fields.archived");
      case "id": return t("importPage.fields.id");
    }
  };
}

function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob(["﻿" + content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function ImportWizard() {
  const t = useTranslations("importPage");
  const locale = useLocale();
  const label = useFieldLabel();
  const invalidate = useInvalidateItems();
  const fileInput = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<(ImportField | null)[]>([]);
  const [mode, setMode] = useState<DuplicateMode>("update");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [results, setResults] = useState<{ rows: { line: number; name: string; result: ImportRowResult }[] } | null>(null);

  const built = useMemo(
    () => (parsed ? parsed.records.map((r, i) => ({ line: i + 2, ...buildRow(r, mapping) })) : []),
    [parsed, mapping],
  );
  const valid = built.filter((b) => b.problems.length === 0);
  const hasName = mapping.includes("name");

  const readFile = async (file: File) => {
    setError(null);
    setResults(null);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length < 2) throw new Error("empty");
      if (rows.length - 1 > MAX_ROWS) {
        setError(t("tooMany"));
        return;
      }
      const [headers, ...records] = rows;
      setParsed({ file: file.name, headers, records });
      setMapping(autoMap(headers));
    } catch {
      setError(t("readError"));
    }
  };

  const problemText = (p: RowProblem) => t(`problems.${p.code}`, { field: label(p.field) });

  const run = async () => {
    const todo = valid.map((b) => ({ line: b.line, row: b.row }));
    setProgress({ done: 0, total: todo.length });
    const out: { line: number; name: string; result: ImportRowResult }[] = [];
    for (let i = 0; i < todo.length; i += CHUNK) {
      const chunk = todo.slice(i, i + CHUNK);
      const res = await importItemsAction({ rows: chunk.map((c) => c.row satisfies ImportRow), mode });
      chunk.forEach((c, j) =>
        out.push({
          line: c.line,
          name: c.row.name ?? "",
          result: res.ok ? (res.data.results[j] ?? { status: "error", errors: ["db"] }) : { status: "error", errors: [res.error] },
        }),
      );
      setProgress({ done: Math.min(i + CHUNK, todo.length), total: todo.length });
    }
    // Rows that never reached the server count as errors too.
    for (const b of built.filter((x) => x.problems.length)) {
      out.push({ line: b.line, name: b.row.name ?? "", result: { status: "error", errors: b.problems.map(problemText) } });
    }
    out.sort((a, b) => a.line - b.line);
    setResults({ rows: out });
    setProgress(null);
    await invalidate();
  };

  const template = () => {
    const vi = locale === "vi";
    const header = ["name", "category", "location", "quantity", "unit", "min_quantity", "expiry_date", "warranty_until", "purchase_price", "tags", "barcode", "group", "notes"];
    const rows = vi
      ? [
          ["Dây sạc USB-C 1m", "Điện tử", "Bàn làm việc › Ngăn kéo 2", "2", "sợi", "", "", "2027-03-01", "85000", "sạc; type-c", "", "Dây sạc", ""],
          ["Sữa tươi hộp 1L", "Thực phẩm dự trữ", "Nhà bếp › Tủ lạnh", "4", "hộp", "2", "2026-11-20", "", "32000", "tủ lạnh", "8934673000000", "", "Mua ở Co.opmart"],
        ]
      : [
          ["USB-C cable 1m", "Electronics", "Desk › Drawer 2", "2", "pcs", "", "", "2027-03-01", "85000", "charger; type-c", "", "Charging cables", ""],
          ["Milk 1L", "Stockpiled food", "Kitchen › Fridge", "4", "box", "2", "2026-11-20", "", "32000", "fridge", "8934673000000", "", ""],
        ];
    download("stowly-import-template.csv", [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n");
  };

  const errorReport = () => {
    if (!results) return;
    const rows = results.rows.filter((r) => r.result.status === "error").map((r) => [String(r.line), r.name, (r.result.errors ?? []).join("; ")]);
    download("stowly-import-errors.csv", [[t("row"), "name", "errors"], ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n");
  };

  const counts = results
    ? (["created", "updated", "skipped", "error"] as const).map((s) => results.rows.filter((r) => r.result.status === s).length)
    : null;

  const card = "rounded-md border border-border bg-card p-4 md:p-5";

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={t("title")} subtitle={t("subtitle")} back="/settings" className="mb-0" />

      {results && counts ? (
        <section className={card} role="status">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <CheckCircle2 className="size-5 text-primary" aria-hidden />
            {t("done")}
          </h2>
          <p className="mt-2 text-[15px]">
            {t("summary", { created: counts[0], updated: counts[1], skipped: counts[2], errors: counts[3] })}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/items">{t("viewItems")}</Link>
            </Button>
            {counts[3] > 0 && (
              <Button variant="outline" onClick={errorReport}>
                <Download />
                {t("errorReport")}
              </Button>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                setResults(null);
                setParsed(null);
              }}
            >
              {t("again")}
            </Button>
          </div>
        </section>
      ) : !parsed ? (
        <section
          className={cn(card, "flex flex-col items-center gap-3 border-dashed py-10 text-center", dragging && "border-primary bg-accent")}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) void readFile(file);
          }}
        >
          <FileUp className="size-8 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground">{t("drop")}</p>
          <Button onClick={() => fileInput.current?.click()}>
            <Upload />
            {t("choose")}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept=".csv,.tsv,.txt,text/csv,text/plain"
            className="sr-only"
            aria-label={t("choose")}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void readFile(file);
            }}
          />
          <p className="text-sm text-muted-foreground">{t("fileHint")}</p>
          <p className="text-sm text-muted-foreground">{t("createdHint")}</p>
          <Button variant="link" onClick={template}>
            <Download />
            {t("template")}
          </Button>
          {error && (
            <p role="alert" className="rounded-md bg-danger px-3 py-2 text-sm font-medium text-danger-foreground">
              {error}
            </p>
          )}
        </section>
      ) : (
        <>
          <section className={card}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">{t("mapping")}</h2>
                <p className="text-sm text-muted-foreground">
                  {t("fileInfo", { file: parsed.file, rows: parsed.records.length, cols: parsed.headers.length })}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setParsed(null)}>
                {t("changeFile")}
              </Button>
            </div>
            <p className="mb-3 text-sm text-muted-foreground">{t("mappingHint")}</p>
            {/* Stacked on phones, three columns on desktop. */}
            <div className="hidden grid-cols-[1fr_1fr_16rem] gap-3 border-b border-border pb-2 text-sm text-muted-foreground md:grid" aria-hidden>
              <span>{t("column")}</span>
              <span>{t("sample")}</span>
              <span>{t("field")}</span>
            </div>
            <ul>
              {parsed.headers.map((h, i) => {
                const sample = parsed.records.find((r) => (r[i] ?? "").trim())?.[i] ?? "";
                const selectId = `map-${i}`;
                return (
                  <li key={i} className="grid gap-x-3 gap-y-1.5 border-b border-border py-3 last:border-0 md:grid-cols-[1fr_1fr_16rem] md:items-center">
                    <label htmlFor={selectId} className="font-medium break-words">
                      {h || `#${i + 1}`}
                    </label>
                    <span className="truncate text-sm text-muted-foreground md:text-[15px]">
                      <span className="md:hidden">{t("sample")}: </span>
                      {sample}
                    </span>
                    <NativeSelect
                      id={selectId}
                      value={mapping[i] ?? ""}
                      onChange={(e) => {
                        const value = (e.target.value || null) as ImportField | null;
                        setMapping((m) => m.map((f, j) => (j === i ? value : f === value && value ? null : f)));
                      }}
                    >
                      <option value="">{t("skip")}</option>
                      {IMPORT_FIELDS.map((f) => (
                        <option key={f} value={f}>
                          {label(f)}
                        </option>
                      ))}
                    </NativeSelect>
                  </li>
                );
              })}
            </ul>
            {!hasName && (
              <p role="alert" className="mt-3 rounded-md bg-warning px-3 py-2 text-sm font-medium text-warning-foreground">
                {t("needName")}
              </p>
            )}
          </section>

          <section className={card}>
            <fieldset>
              <legend className="text-lg font-semibold">{t("duplicates")}</legend>
              <p className="mb-3 text-sm text-muted-foreground">{t("duplicatesHint")}</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {DUPLICATE_MODES.map((m) => (
                  <label
                    key={m}
                    className={cn(
                      "flex cursor-pointer flex-col gap-1 rounded-md border p-3",
                      mode === m ? "border-primary bg-accent" : "border-input hover:bg-muted",
                    )}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="size-4 accent-[var(--primary)]" />
                      {t(`modes.${m}`)}
                    </span>
                    <span className="text-sm text-muted-foreground">{t(`modes.${m}Hint`)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </section>

          <section className={card}>
            <h2 className="text-lg font-semibold">{t("preview")}</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              {t("previewHint", { valid: valid.length, invalid: built.length - valid.length })}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[15px]">
                <thead>
                  <tr className="text-sm text-muted-foreground">
                    <th scope="col" className="py-2 pr-3 font-medium">{t("row")}</th>
                    <th scope="col" className="py-2 pr-3 font-medium">{label("name")}</th>
                    <th scope="col" className="py-2 pr-3 font-medium">{label("location")}</th>
                    <th scope="col" className="py-2 pr-3 font-medium">{label("quantity")}</th>
                    <th scope="col" className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {[...built.filter((b) => b.problems.length), ...built.filter((b) => !b.problems.length)].slice(0, 10).map((b) => (
                    <tr key={b.line} className="border-t border-border align-top">
                      <td className="py-2 pr-3 text-muted-foreground tabular-nums">{b.line}</td>
                      <td className="py-2 pr-3 font-medium">{b.row.name}</td>
                      <td className="py-2 pr-3">{b.row.location}</td>
                      <td className="py-2 pr-3 tabular-nums">{b.row.quantity}</td>
                      <td className="py-2">
                        {b.problems.length ? (
                          <Badge tone="danger" className="whitespace-normal">{b.problems.map(problemText).join(", ")}</Badge>
                        ) : (
                          <Badge tone="success">{t("ok")}</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex flex-wrap items-center gap-3">
            <Button size="lg" disabled={!hasName || !valid.length || progress !== null} onClick={() => void run()}>
              <Upload />
              {progress ? t("importing", { done: progress.done, total: progress.total }) : t("start", { count: valid.length })}
            </Button>
            {progress && (
              <progress className="h-2 w-48 accent-[var(--primary)]" max={progress.total} value={progress.done} aria-label={t("importing", progress)} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

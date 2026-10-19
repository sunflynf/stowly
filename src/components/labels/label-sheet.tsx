"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { buildLocationTree, flattenTree, useLabels, useLocations } from "@/lib/queries/taxonomy";
import { cn } from "@/lib/utils";
import { labelUrl, QrCode } from "./qr-code";

type Size = "small" | "large";

// Common A4 sticker sheets: 63.5×38.1 mm (3×7) and 99.1×67.7 mm (2×4).
// On paper the columns are explicit so the sheet never depends on the width of the page layout.
const SIZE: Record<Size, { sheet: string; label: string; qr: string; name: string }> = {
  small: {
    sheet: "print:grid-cols-[repeat(3,63.5mm)]",
    label: "w-[63.5mm] h-[38.1mm] p-[3mm] gap-[3mm]",
    qr: "size-[30mm]",
    name: "text-[12pt]",
  },
  large: {
    sheet: "print:grid-cols-[repeat(2,99.1mm)]",
    label: "w-[99.1mm] h-[67.7mm] p-[5mm] gap-[5mm]",
    qr: "size-[55mm]",
    name: "text-[18pt]",
  },
};

/** Select locations and print QR labels that open their contents. */
export function LabelSheet({ initialIds }: { initialIds: string[] }) {
  const t = useTranslations("labels");
  const labels = useLabels();
  const { data: rows = [] } = useLocations();
  const flat = useMemo(() => flattenTree(buildLocationTree(rows)), [rows]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialIds));
  const [size, setSize] = useState<Size>("small");
  const [showPath, setShowPath] = useState(true);

  const chosen = flat.filter((n) => selected.has(n.id));
  const toggle = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} back="/locations" className="print:hidden" />

      <div className="grid gap-5 lg:grid-cols-[18rem_1fr] print:block">
        <aside className="flex flex-col gap-4 print:hidden">
          <section className="rounded-[var(--radius-lg)] border border-border bg-card p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="font-semibold">{t("select")}</h2>
              <span className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set(flat.map((n) => n.id)))}>
                  {t("selectAll")}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                  {t("selectNone")}
                </Button>
              </span>
            </div>
            <ul className="max-h-[50dvh] overflow-y-auto">
              {flat.map((n) => (
                <li key={n.id}>
                  <label
                    className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-muted"
                    style={{ paddingLeft: `${0.5 + n.depth * 1.1}rem` }}
                  >
                    <Checkbox checked={selected.has(n.id)} onCheckedChange={(c) => toggle(n.id, c === true)} />
                    <span className="text-[15px]">{labels.location(n)}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>

          <section className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-4">
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">{t("size")}</legend>
              <div className="flex gap-2" role="radiogroup">
                {(["small", "large"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={size === s}
                    onClick={() => setSize(s)}
                    className={cn(
                      "min-h-11 flex-1 rounded-[var(--radius)] border px-3 text-sm font-medium",
                      size === s ? "border-primary bg-accent text-accent-foreground" : "border-input bg-card hover:bg-muted",
                    )}
                  >
                    {t(`sizes.${s}`)}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center justify-between gap-3 text-[15px]">
              {t("showPath")}
              <Switch checked={showPath} onCheckedChange={setShowPath} />
            </label>
            <Button onClick={() => window.print()} disabled={chosen.length === 0}>
              <Printer />
              {t("print", { count: chosen.length })}
            </Button>
            <p className="text-sm text-muted-foreground">{t("printTip")}</p>
          </section>
        </aside>

        <section aria-label={t("preview")} className="overflow-x-auto rounded-[var(--radius-lg)] border border-border bg-card p-4 print:overflow-visible print:border-0 print:p-0">
          {chosen.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground print:hidden">{t("empty")}</p>
          ) : (
            <ul className={cn("flex flex-wrap gap-[2mm] print:grid print:gap-0", SIZE[size].sheet)}>
              {chosen.map((n) => (
                <li
                  key={n.id}
                  className={cn(
                    "flex items-center overflow-hidden rounded-[2mm] border border-dashed border-input bg-white text-[#14201C] break-inside-avoid print:rounded-none print:border-[#CFD8D4]",
                    SIZE[size].label,
                  )}
                >
                  <QrCode value={labelUrl(n.id)} label={t("qrAlt", { name: labels.location(n) })} className={cn("shrink-0", SIZE[size].qr)} />
                  <span className="flex min-w-0 flex-col justify-center">
                    <span className={cn("leading-tight font-bold break-words", SIZE[size].name)}>{labels.location(n)}</span>
                    {showPath && n.depth > 0 && (
                      <span className="mt-[1mm] text-[8pt] leading-tight text-[#4B5C55]">{labels.locationPath(n)}</span>
                    )}
                    <span className="mt-[2mm] text-[7pt] text-[#4B5C55]">{t("scanHint")}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

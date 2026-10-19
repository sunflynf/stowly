"use client";

import { useTimeZone, useTranslations } from "next-intl";
import { Printer } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { daysBetween, todayIn } from "@/lib/dates";
import { useFormats } from "@/lib/hooks/use-format";
import { useItemDocuments } from "@/lib/queries/documents";
import { useItem, usePhotoUrls } from "@/lib/queries/items";
import { useLabels } from "@/lib/queries/taxonomy";
import { useProfile } from "@/lib/queries/stats";
import { DocumentList, DocumentViewer, useOpenDocument } from "./item-documents";

function Fact({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-2.5 last:border-0 print:py-1.5">
      <dt className="text-[15px] text-muted-foreground">{label}</dt>
      <dd className={mono ? "text-right font-mono text-[15px] font-semibold tabular-nums" : "text-right text-[15px] font-semibold"}>{value}</dd>
    </div>
  );
}

/** Everything a shop asks for when claiming warranty, on one printable page. */
export function WarrantyClaim({ id }: { id: string }) {
  const t = useTranslations("documents");
  const ti = useTranslations("item");
  const f = useFormats();
  const labels = useLabels();
  const timeZone = useTimeZone() ?? "Asia/Ho_Chi_Minh";
  const { data: profile } = useProfile();
  const { data: item, isPending } = useItem(id);
  const { data: docs = [] } = useItemDocuments(id);
  const { data: urls = {} } = usePhotoUrls(item?.photos.map((p) => p.storage_path) ?? []);
  const { viewing, open, close } = useOpenDocument();

  if (isPending) return <Skeleton className="mx-auto h-96 max-w-2xl" />;
  if (!item) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={t("claimWarranty")} back="/items" />
        <p className="text-muted-foreground">{ti("notFound")}</p>
      </div>
    );
  }

  const attrs = (item.attributes ?? {}) as Record<string, unknown>;
  const attr = (k: string) => (typeof attrs[k] === "string" && attrs[k] ? (attrs[k] as string) : null);
  const left = item.warranty_until ? daysBetween(todayIn(timeZone), item.warranty_until) : null;
  const dash = <span className="font-normal text-muted-foreground">{t("notRecorded")}</span>;

  return (
    <div className="mx-auto max-w-2xl print:max-w-none">
      <PageHeader
        title={t("claimWarranty")}
        back={`/items/${id}`}
        actions={
          <Button variant="outline" onClick={() => window.print()} className="print:hidden">
            <Printer />
            {t("print")}
          </Button>
        }
      />
      <article className="flex flex-col gap-4 print:gap-3">
        <header>
          <h2 className="text-2xl font-bold">{item.name}</h2>
          <p className="text-[15px] text-muted-foreground">
            {item.category ? labels.category(item.category) : ""}
            {item.location ? ` · ${labels.locationPath(item.location)}` : ""}
          </p>
        </header>

        <section className="rounded-[var(--radius-lg)] border border-border bg-card px-4 py-1 print:border-0 print:px-0">
          <dl>
            <Fact label={ti("fields.purchaseDate")} value={item.purchase_date ? f.date(item.purchase_date) : dash} />
            <Fact
              label={ti("fields.warrantyUntil")}
              value={
                item.warranty_until ? (
                  <span className="flex flex-wrap items-center justify-end gap-2">
                    {f.date(item.warranty_until)}
                    <Badge tone={left !== null && left < 0 ? "danger" : left !== null && left <= 30 ? "warning" : "success"}>
                      {left !== null && left < 0 ? t("warrantyExpired", { days: -left }) : t("warrantyLeft", { days: left ?? 0 })}
                    </Badge>
                  </span>
                ) : (
                  dash
                )
              }
            />
            <Fact label={ti("fields.purchasePlace")} value={item.purchase_place ?? dash} />
            <Fact label={t("serial")} value={attr("serial") ?? dash} mono />
            <Fact label={t("model")} value={[attr("brand"), attr("model")].filter(Boolean).join(" ") || dash} />
            <Fact
              label={ti("fields.purchasePrice")}
              value={item.purchase_price !== null ? f.currency(item.purchase_price, profile?.currency) : dash}
            />
            {item.barcode && <Fact label={ti("fields.barcode")} value={item.barcode} mono />}
          </dl>
        </section>

        <section aria-labelledby="claim-docs" className="rounded-[var(--radius-lg)] border border-border bg-card p-4 print:border-0 print:p-0">
          <h3 id="claim-docs" className="mb-1 font-semibold">
            {t("title")}
          </h3>
          {docs.length ? <DocumentList docs={docs} onOpen={(d) => void open(d)} /> : <p className="text-sm text-muted-foreground">{t("empty")}</p>}
        </section>

        {item.photos.length > 0 && (
          <section aria-labelledby="claim-photos">
            <h3 id="claim-photos" className="mb-2 font-semibold">
              {t("photos")}
            </h3>
            <ul className="grid grid-cols-2 gap-2 print:grid-cols-3">
              {item.photos.map((p, i) => (
                <li key={p.id} className="break-inside-avoid">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={urls[p.storage_path]}
                    alt={ti("photoN", { n: i + 1, name: item.name })}
                    className="aspect-[4/3] w-full rounded-[var(--radius)] bg-muted object-cover"
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
      <DocumentViewer doc={viewing} onClose={close} />
    </div>
  );
}

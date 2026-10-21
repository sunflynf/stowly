"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { CanEdit } from "@/components/app-shell/can-edit";
import { PageHeader } from "@/components/app-shell/page-header";
import { ItemThumb } from "@/components/items/item-thumb";
import { StatusBadge } from "@/components/items/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormats } from "@/lib/hooks/use-format";
import { usePhotoUrls } from "@/lib/queries/items";
import { useLoans, type LoanRow } from "@/lib/queries/loans";
import { useLabels } from "@/lib/queries/taxonomy";
import { EndLoanButton, useLoanStatus } from "./loan-card";

function LoanList({ rows, urls }: { rows: LoanRow[]; urls: Record<string, string> }) {
  const t = useTranslations("loans");
  const f = useFormats();
  const labels = useLabels();
  const status = useLoanStatus();
  return (
    <ul className="flex flex-col gap-2">
      {rows.map((r) => {
        const badge = status(r);
        return (
          <li key={r.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3">
            <Link href={`/items/${r.id}`} className="flex min-w-0 flex-1 items-center gap-3">
              <ItemThumb name={r.name} url={r.thumb_path ? urls[r.thumb_path] : undefined} />
              <span className="min-w-0">
                <span className="block truncate font-semibold hover:underline">{r.name}</span>
                <span className="block truncate text-sm text-muted-foreground">
                  {r.kind === "lent" ? t("lentNow", { person: r.person }) : t("borrowedNow", { person: r.person })}
                  {r.due ? ` · ${r.kind === "lent" ? t("dueBackOn", { date: f.date(r.due) }) : t("giveBackOn", { date: f.date(r.due) })}` : ""}
                </span>
                {r.location_path && <span className="block truncate text-xs text-muted-foreground">{labels.path(r.location_path, r.location_path_en)}</span>}
              </span>
            </Link>
            {badge && <StatusBadge status={badge} />}
            <CanEdit>
              <EndLoanButton itemId={r.id} loan={r} />
            </CanEdit>
          </li>
        );
      })}
    </ul>
  );
}

/** Everything lent out and everything borrowed, in one place. */
export function LoansPage() {
  const t = useTranslations("loans");
  const { data: loans, isPending } = useLoans();
  const { data: urls = {} } = usePhotoUrls((loans ?? []).map((l) => l.thumb_path));
  const lent = (loans ?? []).filter((l) => l.kind === "lent");
  const borrowed = (loans ?? []).filter((l) => l.kind === "borrowed");

  return (
    <div>
      <PageHeader title={t("pageTitle")} subtitle={t("subtitle")} />
      {isPending ? (
        <Skeleton className="h-40" />
      ) : !loans?.length ? (
        <p className="rounded-md border border-border bg-card p-8 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {[
            { key: "lent", rows: lent, title: t("lentSection", { count: lent.length }) },
            { key: "borrowed", rows: borrowed, title: t("borrowedSection", { count: borrowed.length }) },
          ]
            .filter((s) => s.rows.length > 0)
            .map((s) => (
              <section key={s.key} aria-labelledby={`loans-${s.key}`}>
                <h2 id={`loans-${s.key}`} className="mb-2 font-semibold">
                  {s.title}
                </h2>
                <LoanList rows={s.rows} urls={urls} />
              </section>
            ))}
        </div>
      )}
    </div>
  );
}

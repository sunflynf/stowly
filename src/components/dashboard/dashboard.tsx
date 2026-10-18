"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useNow, useTimeZone, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { AlertLine } from "@/components/alerts/alert-line";
import { MobileMenu } from "@/components/app-shell/mobile-menu";
import { EXPIRING_HREF, STOCK_HREF } from "@/components/app-shell/nav-config";
import { unwrap, useErrorToast, useInvalidateItems } from "@/components/items/use-item-mutations";
import { SearchBox } from "@/components/search/search-box";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { addLowStockToShoppingAction } from "@/lib/actions/shopping";
import { useFormats } from "@/lib/hooks/use-format";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { mostUrgentPerItem, STOCK_KINDS, useAlerts, type AlertRow } from "@/lib/queries/alerts";
import { usePhotoUrls } from "@/lib/queries/items";
import { useCategoryCounts, useDashboardStats } from "@/lib/queries/stats";
import { buildLocationTree, useCategories, useLabels, useLocations } from "@/lib/queries/taxonomy";
import { cn } from "@/lib/utils";
import { ScanButton } from "./scan-button";

function StatCard({
  label,
  shortLabel,
  value,
  hint,
  tone = "neutral",
  href,
  className,
}: {
  label: string;
  shortLabel?: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "danger" | "warning";
  href: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn("flex min-w-0 flex-col rounded-[var(--radius-lg)] border border-border bg-card p-3 hover:border-input md:p-5", className)}
    >
      <span className="order-2 text-sm leading-tight text-muted-foreground md:order-1">
        <span className="md:hidden">{shortLabel ?? label}</span>
        <span className="hidden md:inline">{label}</span>
      </span>
      <span
        className={cn(
          "order-1 text-[26px] leading-tight font-bold tabular-nums md:order-2 md:mt-1 md:text-[34px]",
          tone === "danger" && "text-danger-foreground md:text-foreground",
          tone === "warning" && "text-warning-foreground md:text-foreground",
        )}
      >
        {value}
      </span>
      {hint && (
        <span
          className={cn(
            "order-3 mt-1 hidden truncate text-sm md:block",
            tone === "danger" ? "text-danger-foreground" : tone === "warning" ? "text-warning-foreground" : "text-muted-foreground",
          )}
        >
          {hint}
        </span>
      )}
    </Link>
  );
}

function LowStockRow({ alert }: { alert: AlertRow }) {
  const t = useTranslations("dashboard");
  const f = useFormats();
  const min = alert.min_quantity ?? 0;
  const ratio = min > 0 ? Math.min(1, alert.quantity / min) : 0;
  const out = alert.kind === "out_of_stock";
  return (
    <li>
      <Link href={`/items/${alert.item_id}`} className="block py-2.5 hover:bg-muted/40">
        <span className="flex items-baseline justify-between gap-3">
          <span className="truncate font-medium">{alert.name}</span>
          <span className={cn("shrink-0 font-semibold tabular-nums", out ? "text-danger-foreground" : "text-warning-foreground")}>
            {f.quantity(alert.quantity)} / {f.quantity(min)}
          </span>
        </span>
        <span
          role="meter"
          aria-valuemin={0}
          aria-valuemax={min}
          aria-valuenow={alert.quantity}
          aria-label={t("stockOf", { name: alert.name, quantity: f.quantity(alert.quantity), threshold: f.quantity(min) })}
          className="mt-2 block h-2 overflow-hidden rounded-full bg-muted"
        >
          <span
            className={cn("block h-full rounded-full", ratio <= 0.34 ? "bg-danger-solid" : "bg-warning-solid")}
            style={{ width: `${Math.max(ratio * 100, out ? 0 : 4)}%` }}
          />
        </span>
      </Link>
    </li>
  );
}

export function Dashboard() {
  const t = useTranslations("dashboard");
  const tn = useTranslations("nav");
  const ti = useTranslations("items");
  const tc = useTranslations("common");
  const ta = useTranslations("app");
  const format = useFormatter();
  const f = useFormats();
  const router = useRouter();
  const now = useNow();
  const timeZone = useTimeZone();
  const labels = useLabels();
  const invalidate = useInvalidateItems();
  const onError = useErrorToast();
  const { data: stats } = useDashboardStats();
  const { data: alerts, isPending: alertsPending } = useAlerts();
  const { data: categories = [] } = useCategories();
  const { data: counts = [] } = useCategoryCounts();
  const { data: locations = [] } = useLocations();
  const [creating, setCreating] = useState(false);
  const isDesktop = useIsDesktop();

  const active = useMemo(() => (alerts ?? []).filter((a) => !a.snoozed), [alerts]);
  const attention = useMemo(() => mostUrgentPerItem(active.filter((a) => !STOCK_KINDS.includes(a.kind))), [active]);
  const lowStock = useMemo(() => mostUrgentPerItem(active.filter((a) => STOCK_KINDS.includes(a.kind))), [active]);
  const { data: urls = {} } = usePhotoUrls([...attention.slice(0, 5), ...lowStock.slice(0, 5)].map((a) => a.thumb_path));

  const categoryBars = useMemo(() => {
    const rows = categories
      .map((c) => ({ id: c.id, name: labels.category(c), count: Number(counts.find((x) => x.category_id === c.id)?.item_count ?? 0) }))
      .filter((r) => r.count > 0)
      .sort((a, b) => b.count - a.count);
    return { rows, max: Math.max(1, ...rows.map((r) => r.count)) };
  }, [categories, counts, labels]);

  const chips = useMemo(() => {
    const topCategories = categoryBars.rows.slice(0, 3).map((c) => ({ label: c.name, href: `/items?categories=${c.id}` }));
    const room = buildLocationTree(locations).find((l) => l.builtin_key === "bedroom");
    return [
      { label: tn("expiring"), href: EXPIRING_HREF },
      { label: ti("states.low_stock"), href: STOCK_HREF },
      ...topCategories,
      ...(room ? [{ label: labels.location(room), href: `/items?location=${room.id}` }] : []),
    ];
  }, [categoryBars.rows, locations, labels, tn, ti]);

  const date = format.dateTime(now, { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric", timeZone });
  const shortDate = format.dateTime(now, { weekday: "long", day: "2-digit", month: "2-digit", timeZone });

  const createShopping = async () => {
    setCreating(true);
    try {
      const { added } = unwrap(await addLowStockToShoppingAction());
      toast.success(t("shoppingCreated", { count: added }));
      await invalidate();
      router.push("/shopping");
    } catch (e) {
      onError(e);
    } finally {
      setCreating(false);
    }
  };

  const loading = !stats;

  return (
    <>
      {/* Header: big title on desktop, app name on phones (as in the mockup). */}
      <header className="mb-4 flex items-start justify-between gap-3 md:mb-5">
        <div>
          <h1 className="text-[26px] leading-tight font-bold md:text-[30px]">
            <span className="md:hidden">{ta("name")}</span>
            <span className="hidden md:inline">{t("title")}</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="md:hidden">{t("mobileSubtitle", { date: shortDate, count: stats?.total_items ?? 0 })}</span>
            <span className="hidden md:inline">{t("subtitle", { date, count: stats?.attention ?? 0 })}</span>
          </p>
        </div>
        <MobileMenu />
      </header>

      <div className="mb-3 flex gap-3">
        <SearchBox
          value=""
          onChange={() => {}}
          onSubmit={(q) => q.trim() && router.push(`/items?q=${encodeURIComponent(q.trim())}`)}
          placeholder={isDesktop ? ti("searchPlaceholder") : ti("searchShort")}
          slashShortcut
          className="flex-1"
        />
        <div className="md:hidden">
          <ScanButton />
        </div>
        <Button asChild size="lg" className="hidden h-[52px] md:inline-flex">
          <Link href="/items/new">
            <Plus />
            {tn("addItem")}
          </Link>
        </Button>
      </div>

      <nav aria-label={t("quickFilters")} className="mb-5 hidden flex-wrap gap-2 md:flex">
        {chips.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="inline-flex min-h-11 items-center rounded-full border border-input bg-card px-4 text-[15px] font-medium hover:bg-muted"
          >
            {c.label}
          </Link>
        ))}
      </nav>

      {loading ? (
        <div className="mb-5 grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className={cn("h-24 md:h-32", i === 0 && "hidden md:block")} />
          ))}
        </div>
      ) : (
        <div className="mb-5 grid grid-cols-3 gap-3 md:grid-cols-4 md:gap-4">
          <StatCard
            className="hidden md:flex"
            label={t("stats.total")}
            value={f.integer(stats.total_items)}
            hint={t("stats.totalHint", { count: stats.added_30d })}
            href="/items"
          />
          <StatCard
            label={t("stats.expiring")}
            shortLabel={t("stats.expiringShort")}
            value={f.integer(stats.expiring_30d)}
            hint={t("stats.expiredHint", { count: stats.expired })}
            tone="danger"
            href={EXPIRING_HREF}
          />
          <StatCard
            label={t("stats.lowStock")}
            value={f.integer(stats.low_stock)}
            hint={stats.low_stock ? `${stats.low_stock_names.join(", ")}…` : t("stats.lowStockNone")}
            tone="warning"
            href={STOCK_HREF}
          />
          <StatCard
            label={t("stats.warranty")}
            shortLabel={t("stats.warrantyShort")}
            value={f.integer(stats.warranty_ending)}
            hint={stats.warranty_min_days !== null ? t("stats.warrantyHint", { days: stats.warranty_min_days }) : t("stats.warrantyNone")}
            href="/items?states=warranty_ending&sort=expiry"
          />
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] md:items-start">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle>{t("attention")}</CardTitle>
            <Link href="/alerts" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
              {tc("seeAll")}
            </Link>
          </CardHeader>
          <CardContent>
            {alertsPending ? (
              <Skeleton className="h-40" />
            ) : attention.length === 0 ? (
              <p className="py-4 text-muted-foreground">{t("attentionEmpty")}</p>
            ) : (
              <ul className="divide-y divide-border">
                {attention.slice(0, 5).map((a) => (
                  <li key={a.item_id}>
                    <AlertLine alert={a} thumbUrl={a.thumb_path ? urls[a.thumb_path] : undefined} short />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1">
            <CardTitle>{t("lowStock")}</CardTitle>
            <span className="text-sm text-muted-foreground">{t("lowStockLegend")}</span>
          </CardHeader>
          <CardContent>
            {alertsPending ? (
              <Skeleton className="h-40" />
            ) : lowStock.length === 0 ? (
              <p className="py-4 text-muted-foreground">{t("lowStockEmpty")}</p>
            ) : (
              <>
                <ul>
                  {lowStock.slice(0, 5).map((a) => (
                    <LowStockRow key={a.item_id} alert={a} />
                  ))}
                </ul>
                <Button variant="outline" className="mt-3 w-full" disabled={creating} onClick={() => void createShopping()}>
                  {t("createShopping")}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {categoryBars.rows.length > 0 && (
        <Card className="mt-5">
          <CardHeader className="pb-2">
            <CardTitle>{t("byCategory")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-x-10 gap-y-3 md:grid-cols-2">
              {categoryBars.rows.map((c) => (
                <li key={c.id}>
                  <Link href={`/items?categories=${c.id}`} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3 hover:underline md:grid-cols-[9rem_1fr_3rem]">
                    <span className="truncate text-[15px]">{c.name}</span>
                    <span className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden>
                      <span className="block h-full rounded-full bg-primary" style={{ width: `${(c.count / categoryBars.max) * 100}%` }} />
                    </span>
                    <span className="text-right font-semibold tabular-nums">{f.integer(c.count)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}

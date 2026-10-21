"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, List, Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormats } from "@/lib/hooks/use-format";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { itemSearchToQuery, parseItemSearch, SORTS, useItemSearch, type ItemSearchParams } from "@/lib/queries/search";
import { useDashboardStats } from "@/lib/queries/stats";
import { FilterBar } from "./filter-bar";
import { ItemCards, ItemList, ItemTable } from "./item-results";
import { SearchBox } from "./search-box";
import { ViewTabs } from "./view-tabs";
import { CanEdit } from "@/components/app-shell/can-edit";
import { cn } from "@/lib/utils";

type Layout = "list" | "cards";
const LAYOUT_KEY = "stowly.items.layout";

// The signed-in app renders after hydration (ClientGate), so reading storage in the initializer is safe.
function readLayout(): Layout {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "cards" ? "cards" : "list";
  } catch {
    return "list";
  }
}

export function ItemsBrowser() {
  const t = useTranslations("items");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const f = useFormats();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const params = useMemo(() => parseItemSearch(new URLSearchParams(searchParams.toString())), [searchParams]);
  const { data: stats } = useDashboardStats();
  const isDesktop = useIsDesktop();
  const [layout, setLayout] = useState<Layout>(readLayout);

  const changeLayout = (next: Layout) => {
    setLayout(next);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      // Not remembered when storage is unavailable.
    }
  };
  const search = useItemSearch(params);
  const rows = useMemo(() => search.data?.pages.flatMap((p) => p.rows) ?? [], [search.data]);
  const total = search.data?.pages[0]?.total ?? 0;

  const update = useCallback(
    (patch: Partial<ItemSearchParams>) => {
      const next = { ...params, ...patch };
      // Relevance only makes sense with a query.
      if ("q" in patch && patch.q && params.sort === "updated" && !searchParams.get("sort")) next.sort = "relevance";
      if ("q" in patch && !patch.q && next.sort === "relevance") next.sort = "updated";
      router.replace(`${pathname}${itemSearchToQuery(next)}`, { scroll: false });
    },
    [params, pathname, router, searchParams],
  );

  // Infinite scroll: load the next page when the sentinel becomes visible.
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = search;
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const addButton = (
    <CanEdit>
      <Button asChild size="lg">
        <Link href="/items/new">
          <Plus />
          {tn("addItem")}
        </Link>
      </Button>
    </CanEdit>
  );

  const heading = params.q ? t("resultsFor", { count: total, query: params.q }) : t("results", { count: total });

  return (
    <>
      <PageHeader title={t("title")} subtitle={stats ? t("subtitle", { count: stats.total_items }) : " "} actions={addButton} />

      <ViewTabs
        params={params}
        onChange={update}
        counts={stats ? { all: stats.total_items, expiring: stats.expiring_30d + stats.expired, stock: stats.low_stock } : undefined}
      />

      <SearchBox value={params.q} onChange={(q) => update({ q })} placeholder={isDesktop ? t("searchPlaceholder") : t("searchShort")} slashShortcut voice className="mb-3" />
      <div className="mb-4">
        <FilterBar params={params} onChange={update} />
      </div>

      <section className="overflow-hidden rounded-md border border-border bg-card" aria-busy={search.isFetching}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-5">
          <h2 className="font-semibold" aria-live="polite">
            {search.isPending ? " " : heading}
          </h2>
          <div className="flex items-center gap-2">
          <div role="group" aria-label={t("layout.label")} className="flex rounded-md border border-input bg-card p-0.5">
            {(["list", "cards"] as const).map((l) => {
              const Icon = l === "list" ? List : LayoutGrid;
              return (
                <button
                  key={l}
                  type="button"
                  aria-pressed={layout === l}
                  aria-label={t(`layout.${l}`)}
                  title={t(`layout.${l}`)}
                  onClick={() => changeLayout(l)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-md",
                    layout === l ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden />
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="sr-only">{t("sort.label")}</span>
            <NativeSelect
              value={params.sort}
              onChange={(e) => update({ sort: e.target.value as ItemSearchParams["sort"] })}
              className="min-h-10 w-auto py-1 text-sm"
            >
              {SORTS.filter((s) => s !== "relevance" || params.q).map((s) => (
                <option key={s} value={s}>
                  {t("sort.current", { value: t(`sort.${s}`) })}
                </option>
              ))}
            </NativeSelect>
          </label>
          </div>
        </div>

        {search.isPending ? (
          <div className="flex flex-col gap-3 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : search.isError ? (
          <p className="p-6 text-center text-danger-foreground" role="alert">
            {tc("error")}
          </p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center text-muted-foreground">
            <p>{stats?.total_items === 0 ? t("empty") : t("noResults")}</p>
            {stats?.total_items === 0 && addButton}
          </div>
        ) : (
          layout === "cards" ? (
            <ItemCards rows={rows} />
          ) : (
            <>
              <div className="hidden md:block">
                <ItemTable rows={rows} />
              </div>
              <div className="md:hidden">
                <ItemList rows={rows} />
              </div>
            </>
          )
        )}

        {rows.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted-foreground md:px-5">
            <span>{t("showing", { shown: f.integer(rows.length), total: f.integer(total) })}</span>
            {hasNextPage && (
              <Button variant="secondary" size="sm" disabled={isFetchingNextPage} onClick={() => void fetchNextPage()}>
                {t("loadMore")}
              </Button>
            )}
          </div>
        )}
        <div ref={sentinel} aria-hidden />
      </section>
    </>
  );
}

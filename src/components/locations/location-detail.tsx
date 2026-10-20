"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { ChevronRight, Folder, Plus, QrCode as QrIcon } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ItemCards } from "@/components/search/item-results";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { parseItemSearch, useItemSearch } from "@/lib/queries/search";
import { useLabels, useLocationCounts, useLocations } from "@/lib/queries/taxonomy";
import { CanEdit } from "@/components/app-shell/can-edit";

/** A location's contents: breadcrumb, sub-locations and items (QR labels open this page). */
export function LocationDetail({ id }: { id: string }) {
  const t = useTranslations("locations");
  const ti = useTranslations("items");
  const labels = useLabels();
  const { data: locations, isPending } = useLocations();
  const { data: counts = new Map<string, number>() } = useLocationCounts();
  const location = locations?.find((l) => l.id === id);
  const params = useMemo(() => ({ ...parseItemSearch(new URLSearchParams()), location: id, sort: "name" as const }), [id]);
  const search = useItemSearch(params);
  const rows = search.data?.pages.flatMap((p) => p.rows) ?? [];
  const total = search.data?.pages[0]?.total ?? 0;

  if (isPending) return <Skeleton className="h-64" />;
  if (!location || !locations) {
    return (
      <>
        <PageHeader title={t("title")} back="/locations" />
        <p className="text-muted-foreground">{t("notFound")}</p>
      </>
    );
  }

  const ancestors = location.path_ids.slice(0, -1).map((aid) => locations.find((l) => l.id === aid)).filter((l) => l !== undefined);
  const children = locations.filter((l) => l.parent_id === id).sort((a, b) => a.sort_order - b.sort_order);
  const subtreeCount = (lid: string): number =>
    (counts.get(lid) ?? 0) + locations.filter((l) => l.parent_id === lid).reduce((sum, c) => sum + subtreeCount(c.id), 0);

  const actions = (
    <>
      <Button variant="outline" asChild>
        <Link href={`/locations/labels?ids=${id}`}>
          <QrIcon />
          {t("printLabel")}
        </Link>
      </Button>
      <CanEdit>
        <Button asChild>
          <Link href={`/items/new?location=${id}`}>
            <Plus />
            {t("addHere")}
          </Link>
        </Button>
      </CanEdit>
    </>
  );

  return (
    <>
      <PageHeader
        title={labels.location(location)}
        back="/locations"
        subtitle={
          ancestors.length > 0 && (
            <nav aria-label={t("breadcrumb")}>
              <ol className="flex flex-wrap items-center gap-1">
                {ancestors.map((a) => (
                  <li key={a.id} className="flex items-center gap-1">
                    <Link href={`/locations/${a.id}`} className="hover:underline">
                      {labels.location(a)}
                    </Link>
                    <ChevronRight className="size-3.5" aria-hidden />
                  </li>
                ))}
                <li aria-current="page" className="font-medium text-foreground">
                  {labels.location(location)}
                </li>
              </ol>
            </nav>
          )
        }
        actions={actions}
      />
      <h1 className="mb-1 text-2xl font-bold md:hidden">{labels.location(location)}</h1>
      {ancestors.length > 0 && (
        <p className="mb-3 text-sm text-muted-foreground md:hidden">{labels.locationPath(location)}</p>
      )}
      <div className="mb-4 flex flex-wrap gap-2 md:hidden">{actions}</div>

      {children.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 font-semibold">{t("inside")}</h2>
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-2">
            {children.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/locations/${c.id}`}
                  className="flex min-h-14 items-center gap-3 rounded-md border border-border bg-card px-3 py-2 hover:border-input"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <Folder className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{labels.location(c)}</span>
                    <span className="block text-sm text-muted-foreground">{t("itemCount", { count: subtreeCount(c.id) })}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="overflow-hidden rounded-md border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 md:px-5">
          <h2 className="font-semibold">{t("items")}</h2>
          <span className="text-sm text-muted-foreground">{t("itemsCount", { count: total })}</span>
        </div>
        {search.isPending ? (
          <div className="p-4">
            <Skeleton className="h-24" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 pb-6 text-muted-foreground md:px-5">{t("emptyHere")}</p>
        ) : (
          <>
            <ItemCards rows={rows} />
            {search.hasNextPage && (
              <div className="border-t border-border px-4 py-3">
                <Button variant="secondary" size="sm" onClick={() => void search.fetchNextPage()} disabled={search.isFetchingNextPage}>
                  {ti("loadMore")}
                </Button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

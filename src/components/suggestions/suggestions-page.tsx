"use client";

import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { AlarmClockOff, Archive, Gift, Heart, Merge } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell/page-header";
import { ItemThumb } from "@/components/items/item-thumb";
import { unwrap, useErrorToast, useInvalidateItems } from "@/components/items/use-item-mutations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { patchItemAction } from "@/lib/actions/items";
import {
  dismissSuggestionAction,
  giveAwayAction,
  mergeDuplicatesAction,
  undoDismissAction,
} from "@/lib/actions/suggestions";
import { useFormats } from "@/lib/hooks/use-format";
import { useSuggestionCounts, useSuggestions, type Suggestion, type SuggestionReason } from "@/lib/queries/insights";
import { usePhotoUrls } from "@/lib/queries/items";
import { useProfile } from "@/lib/queries/stats";
import { useLabels } from "@/lib/queries/taxonomy";
import { cn } from "@/lib/utils";

const TABS: SuggestionReason[] = ["idle", "worn", "broken", "duplicate"];

export function SuggestionsPage() {
  const t = useTranslations("suggestions");
  const f = useFormats();
  const labels = useLabels();
  const invalidate = useInvalidateItems();
  const onError = useErrorToast();
  const { data: profile } = useProfile();
  const [tab, setTab] = useState<SuggestionReason>("idle");
  const { data: counts = { idle: 0, worn: 0, broken: 0, duplicate: 0 } } = useSuggestionCounts();
  const page = useSuggestions(tab);
  const isPending = page.isPending;
  const visible = useMemo(() => page.data?.pages.flat() ?? [], [page.data]);
  const { data: urls = {} } = usePhotoUrls(visible.map((r) => r.thumb_path));

  const act = useMutation({
    mutationFn: async ({ run }: { run: () => Promise<unknown>; done: string; undo?: () => Promise<unknown> }) => run(),
    onSuccess: (_d, { done, undo }) =>
      toast.success(done, undo ? { action: { label: t("undo"), onClick: () => void undo().then(() => invalidate()) } } : undefined),
    onError,
    onSettled: () => invalidate(),
  });

  const keep = (r: Suggestion, mode: "keep" | "snooze") =>
    act.mutate({
      run: async () => unwrap(await dismissSuggestionAction({ itemId: r.item_id, reason: r.reason, mode })),
      done: mode === "keep" ? t("done.keep", { name: r.name }) : t("done.snooze"),
      undo: async () => unwrap(await undoDismissAction({ itemId: r.item_id, reason: r.reason })),
    });
  const archive = (r: Suggestion) =>
    act.mutate({
      run: async () => unwrap(await patchItemAction(r.item_id, { archived: true })),
      done: t("done.archive", { name: r.name }),
      undo: async () => unwrap(await patchItemAction(r.item_id, { archived: false })),
    });
  const giveAway = (r: Suggestion) =>
    act.mutate({
      run: async () => unwrap(await giveAwayAction(r.item_id)),
      done: t("done.giveAway", { name: r.name }),
      undo: async () => unwrap(await patchItemAction(r.item_id, { condition: r.condition, archived: false })),
    });
  const merge = (r: Suggestion) =>
    r.duplicate_of &&
    act.mutate({
      run: async () => unwrap(await mergeDuplicatesAction({ primaryId: r.duplicate_of, duplicateIds: [r.item_id] })),
      done: t("done.merge"),
    });

  const detail = (r: Suggestion) => {
    if (r.reason === "idle") {
      return (
        <>
          <Badge tone="neutral">{t("idle", { days: r.idle_days ?? 0 })}</Badge>
          {r.last_activity && <span className="text-sm text-muted-foreground">{t("idleSince", { date: f.date(r.last_activity) })}</span>}
        </>
      );
    }
    if (r.reason === "duplicate") {
      return (
        <>
          <Badge tone="neutral">{t("duplicate", { count: r.duplicates ?? 2 })}</Badge>
          {r.duplicate_of && (
            <Link href={`/items/${r.duplicate_of}`} className="text-sm text-muted-foreground underline-offset-4 hover:underline">
              {t("duplicateOf")}
            </Link>
          )}
        </>
      );
    }
    return <Badge tone={r.reason === "broken" ? "danger" : "warning"}>{t(r.reason)}</Badge>;
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      <div role="tablist" aria-label={t("title")} className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {TABS.map((key) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-[15px] font-medium",
              tab === key ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
            )}
          >
            {t(`tabs.${key}`)}
            <span className={cn("rounded-full px-1.5 text-xs tabular-nums", tab === key ? "bg-white/20" : "bg-muted")}>{counts[key]}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={t(`tabs.${tab}`)}>
        {tab === "idle" && profile && <p className="mb-3 text-sm text-muted-foreground">{t("idleHint", { days: profile.unused_after_days })}</p>}
        {isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : visible.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-border bg-card p-8 text-center text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {visible.map((r) => (
              <li key={`${r.item_id}-${r.reason}`} className="rounded-[var(--radius-lg)] border border-border bg-card p-4">
                <Link href={`/items/${r.item_id}`} className="flex items-center gap-3">
                  <ItemThumb name={r.name} url={r.thumb_path ? urls[r.thumb_path] : undefined} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold break-words hover:underline">{r.name}</span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {labels.path(r.location_path, r.location_path_en) || "—"}
                      {r.purchase_price !== null ? ` · ${f.currency(r.purchase_price, profile?.currency)}` : ""}
                    </span>
                  </span>
                </Link>
                <div className="mt-2 flex flex-wrap items-center gap-2">{detail(r)}</div>
                <div role="group" aria-label={t("actions.group", { name: r.name })} className="mt-3 flex flex-wrap gap-2">
                  {r.reason === "duplicate" ? (
                    <>
                      <Button variant="secondary" size="sm" onClick={() => merge(r)}>
                        <Merge />
                        {t("actions.merge")}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => keep(r, "keep")}>
                        <Heart />
                        {t("actions.keep")}
                      </Button>
                    </>
                  ) : (
                    <>
                      {r.reason !== "broken" && (
                        <Button variant="secondary" size="sm" onClick={() => giveAway(r)}>
                          <Gift />
                          {t("actions.giveAway")}
                        </Button>
                      )}
                      <Button variant="secondary" size="sm" onClick={() => archive(r)}>
                        <Archive />
                        {t("actions.archive")}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => keep(r, "keep")}>
                        <Heart />
                        {t("actions.keep")}
                      </Button>
                      {r.reason !== "worn" && (
                        <Button variant="ghost" size="sm" onClick={() => keep(r, "snooze")}>
                          <AlarmClockOff />
                          {t("actions.snooze")}
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        {page.hasNextPage && (
          <Button variant="secondary" className="mt-4 w-full" disabled={page.isFetchingNextPage} onClick={() => void page.fetchNextPage()}>
            {t("showMore", { count: Math.min(30, counts[tab] - visible.length) })}
          </Button>
        )}
      </div>
    </div>
  );
}

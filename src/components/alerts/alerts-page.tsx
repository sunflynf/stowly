"use client";

import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { AlarmClockOff, ArchiveX, BellRing, BookCheck, RefreshCw, ShoppingCart } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell/page-header";
import { ItemThumb } from "@/components/items/item-thumb";
import { StatusBadge } from "@/components/items/status-badge";
import { ActionFailure, unwrap, useErrorToast, useInvalidateItems } from "@/components/items/use-item-mutations";
import { useAddToShopping } from "@/components/shopping/use-add-to-shopping";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { markReplacedAction, markReturnedAction, snoozeAlertAction, unsnoozeAlertAction } from "@/lib/actions/alerts";
import { snoozeGroupAction } from "@/lib/actions/groups";
import { patchItemAction } from "@/lib/actions/items";
import { addToShoppingAction } from "@/lib/actions/shopping";
import { suggestedBuyQuantity } from "@/lib/shopping";
import { useGroupAlerts } from "@/lib/queries/groups";
import { useFormats } from "@/lib/hooks/use-format";
import { useAlerts, type AlertRow } from "@/lib/queries/alerts";
import { usePhotoUrls } from "@/lib/queries/items";
import type { AlertKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAlertHelpers } from "./alert-line";
import { GroupAlertCard } from "./group-alert-card";
import { TaskCard } from "@/components/maintenance/task-card";
import { useMaintenanceAlerts, useMaintenanceTasks } from "@/lib/queries/maintenance";

type Tab = "all" | "expiry" | "stock" | "warranty" | "replace" | "lent" | "maintenance" | "snoozed";
const TABS: Record<Tab, readonly AlertKind[] | null> = {
  all: null,
  expiry: ["expired", "expiring_soon"],
  stock: ["out_of_stock", "low_stock"],
  warranty: ["warranty_ending"],
  replace: ["replace_due"],
  lent: ["lent_overdue"],
  maintenance: ["maintenance_due", "maintenance_overdue"],
  snoozed: null,
};

export function AlertsPage() {
  const t = useTranslations("alerts");
  const tc = useTranslations("common");
  const ti = useTranslations("item");
  const f = useFormats();
  const h = useAlertHelpers();
  const invalidate = useInvalidateItems();
  const onError = useErrorToast();
  const addToShopping = useAddToShopping();
  const { data: alerts = [], isPending } = useAlerts();
  const { data: groupAlerts = [] } = useGroupAlerts();
  const { data: taskAlerts = [] } = useMaintenanceAlerts();
  const { data: tasks = [] } = useMaintenanceTasks();
  const [tab, setTab] = useState<Tab>("all");
  const [replacing, setReplacing] = useState<AlertRow | null>(null);
  const [newExpiry, setNewExpiry] = useState("");
  const { data: urls = {} } = usePhotoUrls(alerts.map((a) => a.thumb_path));

  const act = useMutation({
    mutationFn: async ({ run }: { run: () => Promise<unknown>; done: string; undo?: () => Promise<unknown> }) => run(),
    onSuccess: (_d, { done, undo }) =>
      toast.success(done, undo ? { action: { label: t("undo"), onClick: () => void undo().then(() => invalidate()) } } : undefined),
    onError: (e) => (e instanceof ActionFailure && e.code === "conflict" ? toast.info(ti("alreadyInShopping")) : onError(e)),
    onSettled: () => invalidate(),
  });

  const counts = useMemo(() => {
    const out: Record<Tab, number> = { all: 0, expiry: 0, stock: 0, warranty: 0, replace: 0, lent: 0, maintenance: 0, snoozed: 0 };
    for (const a of alerts) {
      if (a.snoozed) {
        out.snoozed++;
        continue;
      }
      out.all++;
      for (const [key, kinds] of Object.entries(TABS)) if (kinds?.includes(a.kind)) out[key as Tab]++;
    }
    for (const g of groupAlerts) {
      if (g.snoozed) out.snoozed++;
      else {
        out.all++;
        out.stock++;
      }
    }
    for (const m of taskAlerts) {
      if (m.snoozed) out.snoozed++;
      else {
        out.all++;
        out.maintenance++;
      }
    }
    return out;
  }, [alerts, groupAlerts, taskAlerts]);

  const taskById = new Map(tasks.map((x) => [x.id, x]));
  const visibleTasks = taskAlerts.filter(
    (m) => taskById.has(m.task_id) && (tab === "snoozed" ? m.snoozed : !m.snoozed && (tab === "all" || tab === "maintenance")),
  );

  const visibleGroups = groupAlerts.filter((g) =>
    tab === "snoozed" ? g.snoozed : !g.snoozed && (tab === "all" || tab === "stock"),
  );

  const visible = alerts.filter((a) => {
    if (tab === "snoozed") return a.snoozed;
    if (a.snoozed) return false;
    const kinds = TABS[tab];
    return !kinds || kinds.includes(a.kind);
  });

  const ref = (a: AlertRow) => ({ itemId: a.item_id, kind: a.kind });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("title")} subtitle={t("subtitle", { count: counts.all })} />

      <div role="tablist" aria-label={t("title")} className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {(Object.keys(TABS) as Tab[]).map((key) => (
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
        {isPending ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : visible.length === 0 && visibleGroups.length === 0 && visibleTasks.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-border bg-card p-8 text-center text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {visibleTasks.map((m) => (
              <TaskCard key={`m-${m.task_id}`} task={taskById.get(m.task_id)!} alert={m} />
            ))}
            {visibleGroups.map((g) => (
              <GroupAlertCard
                key={`g-${g.id}`}
                alert={g}
                onShopping={() =>
                  act.mutate({
                    run: async () =>
                      unwrap(
                        await addToShoppingAction({
                          group_id: g.id,
                          name: g.name,
                          unit: g.unit,
                          quantity: suggestedBuyQuantity(g.total, g.min_quantity),
                        }),
                      ),
                    done: ti("addedToShopping"),
                  })
                }
                onSnooze={(days) =>
                  act.mutate({
                    run: async () => unwrap(await snoozeGroupAction(g.id, days)),
                    done: days ? t("done.snoozed") : t("done.unsnoozed"),
                  })
                }
              />
            ))}
            {visible.map((a) => {
              const status = h.status(a);
              const expiryKind = a.kind === "expired" || a.kind === "expiring_soon";
              return (
                <li key={`${a.item_id}-${a.kind}`} className="rounded-[var(--radius-lg)] border border-border bg-card p-4">
                  <Link href={`/items/${a.item_id}`} className="flex items-center gap-3">
                    <ItemThumb name={a.name} url={a.thumb_path ? urls[a.thumb_path] : undefined} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold break-words hover:underline">{a.name}</span>
                      <span className="block truncate text-sm text-muted-foreground">{h.subtitle(a)}</span>
                    </span>
                    <StatusBadge status={status} />
                  </Link>
                  {a.snoozed && a.snoozed_until && (
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                      <BellRing className="size-4" aria-hidden />
                      {t("snoozedUntil", { date: f.date(a.snoozed_until) })}
                    </p>
                  )}
                  <div role="group" aria-label={t("actions.group", { name: a.name })} className="mt-3 flex flex-wrap gap-2">
                    {a.snoozed ? (
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => act.mutate({ run: async () => unwrap(await unsnoozeAlertAction(ref(a))), done: t("done.unsnoozed") })}
                      >
                        <BellRing />
                        {t("actions.unsnooze")}
                      </Button>
                    ) : (
                      <>
                        {(expiryKind || a.kind === "replace_due") && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => {
                              if (expiryKind) {
                                setNewExpiry("");
                                setReplacing(a);
                              } else {
                                act.mutate({ run: async () => unwrap(await markReplacedAction({ itemId: a.item_id })), done: t("done.replaced") });
                              }
                            }}
                          >
                            <RefreshCw />
                            {t("actions.markReplaced")}
                          </Button>
                        )}
                        {a.kind === "lent_overdue" && (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => act.mutate({ run: async () => unwrap(await markReturnedAction(a.item_id)), done: t("done.returned") })}
                          >
                            <BookCheck />
                            {t("actions.returned")}
                          </Button>
                        )}
                        {a.kind !== "warranty_ending" && a.kind !== "lent_overdue" && (
                          <Button variant="secondary" size="sm" onClick={() => addToShopping.mutate({ ...a, id: a.item_id })}>
                            <ShoppingCart />
                            {t("actions.addToShopping")}
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            act.mutate({
                              run: async () => unwrap(await patchItemAction(a.item_id, { archived: true })),
                              done: t("done.usedUp", { name: a.name }),
                              undo: async () => unwrap(await patchItemAction(a.item_id, { archived: false })),
                            })
                          }
                        >
                          <ArchiveX />
                          {t("actions.usedUp")}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            act.mutate({
                              run: async () => unwrap(await snoozeAlertAction(ref(a), 7)),
                              done: t("done.snoozed"),
                              undo: async () => unwrap(await unsnoozeAlertAction(ref(a))),
                            })
                          }
                        >
                          <AlarmClockOff />
                          {t("actions.snooze")}
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={replacing !== null} onOpenChange={(o) => !o && setReplacing(null)}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!replacing) return;
              const itemId = replacing.item_id;
              act.mutate({ run: async () => unwrap(await markReplacedAction({ itemId, newExpiry })), done: t("done.replaced") });
              setReplacing(null);
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("replaceDialog.title", { name: replacing?.name ?? "" })}</DialogTitle>
              <DialogDescription>{t("replaceDialog.description")}</DialogDescription>
            </DialogHeader>
            <Field label={t("replaceDialog.newExpiry")} htmlFor="new-expiry">
              <Input id="new-expiry" type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} />
            </Field>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setReplacing(null)}>
                {tc("cancel")}
              </Button>
              <Button type="submit">{t("actions.markReplaced")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

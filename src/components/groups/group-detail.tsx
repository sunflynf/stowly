"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTimeZone, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { AlarmClockOff, AlertTriangle, BellRing, MoreVertical, Pencil, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell/page-header";
import { ItemThumb } from "@/components/items/item-thumb";
import { QuantityStepper } from "@/components/items/quantity-stepper";
import { ActionFailure, unwrap, useErrorToast, useInvalidateItems } from "@/components/items/use-item-mutations";
import { SearchBox } from "@/components/search/search-box";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteGroupAction, setItemsGroupAction, snoozeGroupAction } from "@/lib/actions/groups";
import { addToShoppingAction } from "@/lib/actions/shopping";
import { todayIn } from "@/lib/dates";
import { useFormats } from "@/lib/hooks/use-format";
import { useGroups } from "@/lib/queries/groups";
import { usePhotoUrls } from "@/lib/queries/items";
import { qk } from "@/lib/queries/keys";
import { fetchSearchPage, parseItemSearch, useItemSearch } from "@/lib/queries/search";
import { useLabels } from "@/lib/queries/taxonomy";
import { suggestedBuyQuantity } from "@/lib/shopping";
import { GroupDialog } from "./group-dialog";
import { GroupMeter } from "./group-meter";

function AddMembersDialog({ groupId, open, onOpenChange }: { groupId: string; open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useTranslations("groups");
  const tc = useTranslations("common");
  const invalidate = useInvalidateItems();
  const onError = useErrorToast();
  const { data: groups = [] } = useGroups();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const params = useMemo(() => ({ ...parseItemSearch(new URLSearchParams()), q, sort: q ? ("relevance" as const) : ("name" as const) }), [q]);
  const { data, isFetching } = useQuery({
    queryKey: ["group-candidates", params],
    queryFn: () => fetchSearchPage(params, 0, 40),
    enabled: open,
  });
  const candidates = (data?.rows ?? []).filter((r) => r.group_id !== groupId);

  const add = useMutation({
    mutationFn: async () => unwrap(await setItemsGroupAction({ groupId, itemIds: [...selected] })),
    onSuccess: async () => {
      toast.success(t("added"));
      setSelected(new Set());
      await invalidate();
      onOpenChange(false);
    },
    onError,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("addMembers")}</DialogTitle>
        </DialogHeader>
        <SearchBox value={q} onChange={setQ} placeholder={t("addMembersSearch")} />
        <ul className="mt-3 max-h-[50dvh] overflow-y-auto" aria-busy={isFetching}>
          {candidates.map((r) => {
            const other = r.group_id ? groups.find((g) => g.id === r.group_id) : null;
            return (
              <li key={r.id}>
                <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-muted">
                  <Checkbox
                    checked={selected.has(r.id)}
                    onCheckedChange={(c) =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (c === true) next.add(r.id);
                        else next.delete(r.id);
                        return next;
                      })
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{r.name}</span>
                    {other && <span className="text-sm text-muted-foreground">{t("alreadyIn", { name: other.name })}</span>}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {tc("cancel")}
          </Button>
          <Button disabled={!selected.size || add.isPending} onClick={() => add.mutate()}>
            {t("addSelected", { count: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function GroupDetail({ id }: { id: string }) {
  const t = useTranslations("groups");
  const tc = useTranslations("common");
  const ti = useTranslations("item");
  const f = useFormats();
  const timeZone = useTimeZone();
  const router = useRouter();
  const labels = useLabels();
  const qc = useQueryClient();
  const invalidate = useInvalidateItems();
  const onError = useErrorToast();
  const { data: groups, isPending } = useGroups();
  const group = groups?.find((g) => g.id === id);
  const params = useMemo(() => ({ ...parseItemSearch(new URLSearchParams()), group: id, sort: "name" as const }), [id]);
  const search = useItemSearch(params);
  const members = search.data?.pages.flatMap((p) => p.rows) ?? [];
  const { data: urls = {} } = usePhotoUrls(members.map((m) => m.thumb_path));
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const act = useMutation({
    mutationFn: async ({ run }: { run: () => Promise<unknown>; done?: string }) => run(),
    onSuccess: (_d, { done }) => done && toast.success(done),
    onError: (e) => (e instanceof ActionFailure && e.code === "conflict" ? toast.info(ti("alreadyInShopping")) : onError(e)),
    onSettled: () => Promise.all([invalidate(), qc.invalidateQueries({ queryKey: qk.shopping })]),
  });

  if (isPending) return <Skeleton className="h-64" />;
  if (!group) {
    return (
      <>
        <PageHeader title={t("title")} back="/groups" />
        <p className="text-muted-foreground">{ti("notFound")}</p>
      </>
    );
  }

  const low = group.min_quantity !== null && group.total <= group.min_quantity;
  const today = todayIn(timeZone ?? "Asia/Ho_Chi_Minh");
  const snoozed = group.snoozed_until !== null && group.snoozed_until >= today;
  const unit = group.unit ? ` ${group.unit}` : "";

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={tc("more")}>
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setEditing(true)}>
          <Pencil aria-hidden />
          {t("edit")}
        </DropdownMenuItem>
        {low && (
          <DropdownMenuItem
            onSelect={() =>
              act.mutate({
                run: async () => unwrap(await snoozeGroupAction(id, snoozed ? 0 : 7)),
                done: snoozed ? t("unsnooze") : t("snooze"),
              })
            }
          >
            {snoozed ? <BellRing aria-hidden /> : <AlarmClockOff aria-hidden />}
            {snoozed ? t("unsnooze") : t("snooze")}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setConfirmDelete(true)} className="text-danger-foreground">
          <Trash2 aria-hidden />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const addToShopping = () =>
    act.mutate({
      run: async () =>
        unwrap(
          await addToShoppingAction({
            group_id: id,
            name: group.name,
            unit: group.unit,
            quantity: suggestedBuyQuantity(group.total, group.min_quantity),
          }),
        ),
      done: ti("addedToShopping"),
    });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={group.name}
        subtitle={t("members", { count: group.members })}
        back="/groups"
        mobileAction={menu}
        actions={
          <>
            <Button variant="outline" onClick={() => setAdding(true)}>
              <Plus />
              {t("addMembers")}
            </Button>
            {menu}
          </>
        }
      />

      <div className="flex flex-col gap-4">
        {low && !snoozed && (
          <p
            role="status"
            className={
              group.total === 0
                ? "flex items-start gap-2 rounded-[var(--radius)] bg-danger px-4 py-3 font-semibold text-danger-foreground"
                : "flex items-start gap-2 rounded-[var(--radius)] bg-warning px-4 py-3 font-semibold text-warning-foreground"
            }
          >
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            {group.total === 0
              ? t("outBanner", { threshold: f.quantity(group.min_quantity) })
              : t("lowBanner", { total: f.quantity(group.total) + unit, threshold: f.quantity(group.min_quantity) })}
          </p>
        )}
        {snoozed && <p className="text-sm text-muted-foreground">{t("snoozedUntil", { date: f.date(group.snoozed_until) })}</p>}

        <section className="rounded-[var(--radius-lg)] border border-border bg-card p-4">
          <GroupMeter group={group} />
          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={addToShopping} disabled={act.isPending}>
              <ShoppingCart />
              {ti("addToShopping")}
            </Button>
            <Button variant="outline" className="md:hidden" onClick={() => setAdding(true)}>
              <Plus />
              {t("addMembers")}
            </Button>
          </div>
        </section>

        <section className="rounded-[var(--radius-lg)] border border-border bg-card">
          {search.isPending ? (
            <Skeleton className="m-4 h-24" />
          ) : members.length === 0 ? (
            <p className="p-6 text-center text-muted-foreground">{t("members", { count: 0 })}</p>
          ) : (
            <ul>
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-0">
                  <Link href={`/items/${m.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <ItemThumb name={m.name} url={m.thumb_path ? urls[m.thumb_path] : undefined} />
                    <span className="min-w-0">
                      <span className="block font-semibold break-words">{m.name}</span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {labels.path(m.location_path, m.location_path_en) || ti("unknownLocation")}
                      </span>
                    </span>
                  </Link>
                  <QuantityStepper id={m.id} name={m.name} quantity={m.quantity} />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("remove", { name: m.name })}
                    onClick={() => act.mutate({ run: async () => unwrap(await setItemsGroupAction({ groupId: null, itemIds: [m.id] })), done: t("removed") })}
                  >
                    <X />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {editing && <GroupDialog open onOpenChange={setEditing} group={group} />}
      {adding && <AddMembersDialog groupId={id} open onOpenChange={setAdding} />}
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("delete")}</DialogTitle>
          </DialogHeader>
          <p>{t("deleteConfirm", { name: group.name })}</p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  unwrap(await deleteGroupAction(id));
                  await invalidate();
                  router.push("/groups");
                } catch (e) {
                  onError(e);
                }
              }}
            >
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

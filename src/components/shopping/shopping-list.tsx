"use client";

import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Boxes, Link2, ListPlus, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell/page-header";
import { unwrap, useErrorToast, useInvalidateItems } from "@/components/items/use-item-mutations";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  addLowStockToShoppingAction,
  addToShoppingAction,
  clearDoneShoppingAction,
  deleteShoppingAction,
  markBoughtAction,
  updateShoppingAction,
} from "@/lib/actions/shopping";
import { useFormats } from "@/lib/hooks/use-format";
import { useShoppingList, type ShoppingEntry } from "@/lib/queries/items";
import { qk } from "@/lib/queries/keys";
import { cn } from "@/lib/utils";

export function ShoppingList() {
  const t = useTranslations("shopping");
  const td = useTranslations("dashboard");
  const f = useFormats();
  const qc = useQueryClient();
  const invalidateItems = useInvalidateItems();
  const onError = useErrorToast();
  const { data: rows = [], isPending } = useShoppingList();
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");

  const open = rows.filter((r) => !r.done);
  const done = rows.filter((r) => r.done);

  const refresh = () => qc.invalidateQueries({ queryKey: qk.shopping });
  const mutate = useMutation({
    mutationFn: async (fn: () => Promise<unknown>) => fn(),
    onError,
    onSettled: refresh,
  });

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    mutate.mutate(async () => {
      unwrap(await addToShoppingAction({ name, quantity }));
      setName("");
      setQuantity("1");
    });
  };

  const markBought = (row: ShoppingEntry, checked: boolean) => {
    // Optimistic toggle.
    qc.setQueryData<ShoppingEntry[]>(qk.shopping, (old) => old?.map((r) => (r.id === row.id ? { ...r, done: checked } : r)));
    mutate.mutate(async () => {
      if (checked) {
        unwrap(await markBoughtAction(row.id, true));
        if (row.item) {
          toast.success(t("restocked", { quantity: f.quantity(row.quantity), name: row.item.name }));
          await invalidateItems(row.item.id);
        } else if (row.group) {
          toast.success(t("restocked", { quantity: f.quantity(row.quantity), name: row.group.name }));
          await invalidateItems();
        }
      } else {
        unwrap(await updateShoppingAction(row.id, { done: false }));
      }
    });
  };

  const setQty = (row: ShoppingEntry, next: number) => {
    if (next <= 0) return;
    qc.setQueryData<ShoppingEntry[]>(qk.shopping, (old) => old?.map((r) => (r.id === row.id ? { ...r, quantity: next } : r)));
    mutate.mutate(async () => unwrap(await updateShoppingAction(row.id, { quantity: next })));
  };

  const fromLowStock = () =>
    mutate.mutate(async () => {
      const { added } = unwrap(await addLowStockToShoppingAction());
      toast.success(td("shoppingCreated", { count: added }));
    });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { count: open.length })}
        actions={
          <Button variant="outline" onClick={fromLowStock} disabled={mutate.isPending}>
            <ListPlus />
            {t("fromLowStock")}
          </Button>
        }
      />

      <form onSubmit={add} className="mb-4 flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("addPlaceholder")}
          aria-label={t("name")}
          maxLength={200}
          className="flex-1"
        />
        <Input
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          inputMode="decimal"
          aria-label={t("quantity")}
          className="w-16 text-center"
        />
        <Button type="submit" disabled={!name.trim() || mutate.isPending}>
          <Plus />
          <span className="sr-only sm:not-sr-only">{t("add")}</span>
        </Button>
      </form>

      <Button variant="outline" className="mb-4 w-full md:hidden" onClick={fromLowStock} disabled={mutate.isPending}>
        <ListPlus />
        {t("fromLowStock")}
      </Button>

      <section className="rounded-md border border-border bg-card">
        {isPending ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : open.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul>
            {open.map((row) => (
              <ShoppingRow key={row.id} row={row} onCheck={markBought} onQty={setQty} onDelete={(r) => mutate.mutate(async () => unwrap(await deleteShoppingAction(r.id)))} />
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold text-muted-foreground">{t("done", { count: done.length })}</h2>
            <Button variant="ghost" size="sm" onClick={() => mutate.mutate(async () => unwrap(await clearDoneShoppingAction()))}>
              <Trash2 />
              {t("clearDone")}
            </Button>
          </div>
          <ul className="rounded-md border border-border bg-card">
            {done.map((row) => (
              <ShoppingRow key={row.id} row={row} onCheck={markBought} onQty={setQty} onDelete={(r) => mutate.mutate(async () => unwrap(await deleteShoppingAction(r.id)))} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ShoppingRow({
  row,
  onCheck,
  onQty,
  onDelete,
}: {
  row: ShoppingEntry;
  onCheck: (row: ShoppingEntry, checked: boolean) => void;
  onQty: (row: ShoppingEntry, next: number) => void;
  onDelete: (row: ShoppingEntry) => void;
}) {
  const t = useTranslations("shopping");
  const tg = useTranslations("groups");
  const f = useFormats();
  const id = `shop-${row.id}`;
  return (
    <li className="flex min-h-14 items-center gap-2 border-b border-border px-3 last:border-0">
      <label htmlFor={id} className="flex size-11 shrink-0 cursor-pointer items-center justify-center">
        <Checkbox id={id} checked={row.done} onCheckedChange={(c) => onCheck(row, c === true)} aria-label={t("markBought", { name: row.name })} />
      </label>
      <div className="min-w-0 flex-1">
        <p className={cn("font-medium break-words", row.done && "text-muted-foreground line-through")}>{row.name}</p>
        {row.group && (
          <Link href={`/groups/${row.group.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
            <Boxes className="size-3.5" aria-hidden />
            {tg("inGroup", { name: row.group.name })}
          </Link>
        )}
        {row.item && (
          <Link href={`/items/${row.item.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
            <Link2 className="size-3.5" aria-hidden />
            <span className="sr-only">{t("linked")}: </span>
            {t("inStock", { quantity: `${f.quantity(row.item.quantity)}${row.item.unit ? ` ${row.item.unit}` : ""}` })}
          </Link>
        )}
      </div>
      {!row.done && (
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => onQty(row, row.quantity - 1)}
            disabled={row.quantity <= 1}
            aria-label={t("decrease")}
            className="flex size-11 items-center justify-center rounded-md hover:bg-muted disabled:opacity-40"
          >
            <Minus className="size-4" aria-hidden />
          </button>
          <span className="min-w-8 text-center font-semibold tabular-nums">
            {f.quantity(row.quantity)}
            {row.unit ? <span className="ml-0.5 text-sm font-normal text-muted-foreground">{row.unit}</span> : null}
          </span>
          <button
            type="button"
            onClick={() => onQty(row, row.quantity + 1)}
            aria-label={t("increase")}
            className="flex size-11 items-center justify-center rounded-md hover:bg-muted"
          >
            <Plus className="size-4" aria-hidden />
          </button>
        </div>
      )}
      <button
        type="button"
        onClick={() => onDelete(row)}
        aria-label={t("remove", { name: row.name })}
        className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </li>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useFormatter, useTimeZone, useTranslations } from "next-intl";
import { useState } from "react";
import { AlertTriangle, Archive, ArchiveRestore, Camera, MoreVertical, Pencil, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell/page-header";
import { ItemDocuments } from "@/components/documents/item-documents";
import { ItemMaintenance } from "@/components/maintenance/item-maintenance";
import { QuantityStepper } from "@/components/items/quantity-stepper";
import { StatusBadge, useStatusLabel } from "@/components/items/status-badge";
import { unwrap, useErrorToast, useInvalidateItems, usePatchItem } from "@/components/items/use-item-mutations";
import { useAddToShopping } from "@/components/shopping/use-add-to-shopping";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteItemAction, restoreItemAction } from "@/lib/actions/items";
import { monthsBetween, todayIn } from "@/lib/dates";
import { useFormats } from "@/lib/hooks/use-format";
import { useHousehold, useHouseholdPeople } from "@/lib/queries/household";
import { useItem, useItemAlerts, useItemEvents, usePhotoUrls, type ItemDetail } from "@/lib/queries/items";
import { useLabels, useLocations } from "@/lib/queries/taxonomy";
import { alertStatus, itemStatus } from "@/lib/status";
import { attributeDefsSchema } from "@/lib/validation/item";
import { cn } from "@/lib/utils";

// Notes written by the app itself (vs. typed by the user) are translated.
const SYSTEM_NOTES = ["shopping", "merge", "barcode", "demo"] as const;

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-0">
      <dt className="text-[15px] text-muted-foreground">{label}</dt>
      <dd className="text-right text-[15px] font-semibold">{children}</dd>
    </div>
  );
}

function Photos({ item }: { item: ItemDetail }) {
  const t = useTranslations("item");
  const { data: urls = {} } = usePhotoUrls(item.photos.map((p) => p.storage_path));
  if (!item.photos.length) {
    return (
      <Link
        href={`/items/${item.id}/edit`}
        className="flex h-40 flex-col items-center justify-center gap-2 rounded-md border border-dashed border-input bg-muted text-sm text-muted-foreground md:h-56"
      >
        <Camera className="size-6" aria-hidden />
        {t("photoCount", { count: 0 })}
        <span className="sr-only">{t("openPhotos")}</span>
      </Link>
    );
  }
  return (
    <ul className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 md:mx-0 md:px-0" aria-label={t("photoCount", { count: item.photos.length })}>
      {item.photos.map((p, i) => (
        <li key={p.id} className="w-[85%] shrink-0 snap-center md:w-72">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[p.storage_path]}
            alt={t("photoN", { n: i + 1, name: item.name })}
            className="aspect-[4/3] w-full rounded-md bg-muted object-cover"
          />
        </li>
      ))}
    </ul>
  );
}

function History({ id }: { id: string }) {
  const t = useTranslations("item");
  const tc = useTranslations("conditions");
  const format = useFormatter();
  const labels = useLabels();
  const { data: events = [] } = useItemEvents(id);
  const { data: locations = [] } = useLocations();
  const { data: people } = useHouseholdPeople();
  const actor = (uid: string | null) => {
    const p = uid ? people?.get(uid) : undefined;
    if (!p) return null;
    return p.is_member ? p.display_name : t("formerMember", { name: p.display_name });
  };
  const locName = (lid: string | null) => {
    const l = locations.find((x) => x.id === lid);
    return l ? labels.locationPath(l) : "—";
  };
  const qty = (n: number | null) => format.number(Number(n ?? 0), "quantity");

  return (
    <section className="rounded-md border border-border bg-card p-4 md:p-5">
      <h2 className="mb-2 font-semibold">{t("history")}</h2>
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noHistory")}</p>
      ) : (
        <ol className="flex flex-col">
          {events.map((e) => {
            let text: string;
            if (e.type === "created") text = t("events.created", { quantity: qty(e.quantity_after) });
            else if (e.type === "quantity_change")
              text = t("events.quantity_change", {
                delta: format.number(Number(e.delta ?? 0), { signDisplay: "always", maximumFractionDigits: 3 }),
                quantity: qty(e.quantity_after),
              });
            else if (e.type === "maintenance") text = t("events.maintenance");
            else if (e.type === "moved") text = t("events.moved", { from: locName(e.from_location_id), to: locName(e.to_location_id) });
            else
              text = t("events.status_change", {
                from: e.from_condition ? tc(e.from_condition) : "—",
                to: e.to_condition ? tc(e.to_condition) : "—",
              });
            return (
              <li key={e.id} className="flex items-baseline justify-between gap-3 border-b border-border py-2.5 last:border-0">
                <span className="text-[15px]">
                  {text}
                  {e.note && (
                    <span className="text-muted-foreground">
                      {" · "}
                      {SYSTEM_NOTES.includes(e.note as (typeof SYSTEM_NOTES)[number]) ? t(`eventNotes.${e.note as (typeof SYSTEM_NOTES)[number]}`) : e.note}
                    </span>
                  )}
                </span>
                <span className="flex shrink-0 flex-col items-end text-xs text-muted-foreground">
                  <time dateTime={e.created_at}>{format.dateTime(new Date(e.created_at), "dateTime")}</time>
                  {actor(e.actor_id) && <span>{t("byPerson", { name: actor(e.actor_id) ?? "" })}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function ItemDetailView({ id }: { id: string }) {
  const t = useTranslations("item");
  const tc = useTranslations();
  const router = useRouter();
  const format = useFormatter();
  const timeZone = useTimeZone() ?? "Asia/Ho_Chi_Minh";
  const f = useFormats();
  const fmtDate = f.date;
  const labels = useLabels();
  const statusLabel = useStatusLabel();
  const { data: item, isPending } = useItem(id);
  const { data: alerts = [] } = useItemAlerts(id);
  const addToShopping = useAddToShopping();
  const patch = usePatchItem();
  const invalidate = useInvalidateItems();
  const onError = useErrorToast();
  const { canEdit } = useHousehold();
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-40" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24" />
      </div>
    );
  }
  if (!item) {
    return (
      <div>
        <PageHeader title={t("detailTitle")} back="/items" />
        <p className="text-muted-foreground">{t("notFound")}</p>
      </div>
    );
  }

  const today = todayIn(timeZone);
  const status = itemStatus(item, alerts.map((a) => a.kind!), today);
  const low = item.min_quantity !== null && item.quantity <= item.min_quantity;
  const currency = (n: number) => f.currency(n);
  const attrDefs = attributeDefsSchema.safeParse(item.category?.default_attributes ?? []);
  const attrs = (item.attributes ?? {}) as Record<string, string>;
  const qty = (n: number | null) => format.number(Number(n ?? 0), "quantity");

  const remove = async () => {
    try {
      unwrap(await deleteItemAction(id));
      toast.success(t("deleted"), {
        action: {
          label: tc("trash.undo"),
          onClick: () =>
            void restoreItemAction(id).then(async (r) => {
              if (!r.ok) return onError(new Error(r.error));
              await invalidate(id);
              router.push(`/items/${id}`);
            }),
        },
      });
      await invalidate();
      router.push("/items");
    } catch (e) {
      onError(e);
    }
  };

  const toggleArchive = () =>
    patch.mutate(
      { id, patch: { archived: !item.archived_at } },
      { onSuccess: () => toast.success(item.archived_at ? t("restored") : t("archived")) },
    );

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("menu")}>
          <MoreVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/items/${id}/edit`}>
            <Pencil aria-hidden />
            {tc("common.edit")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={toggleArchive}>
          {item.archived_at ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          {item.archived_at ? t("unarchive") : t("archive")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setConfirmDelete(true)} className="text-danger-foreground">
          <Trash2 aria-hidden />
          {t("delete")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const replaceMonths = (since: string | null) => (since ? monthsBetween(since, today) : 0);

  return (
    <div>
      <PageHeader
        title={t("detailTitle")}
        back="/items"
        mobileAction={canEdit ? menu : undefined}
        actions={
          canEdit && (
          <>
            <Button variant="outline" asChild>
              <Link href={`/items/${id}/edit`}>
                <Pencil />
                {tc("common.edit")}
              </Link>
            </Button>
            {menu}
          </>
          )
        }
      />

      <div className={cn("flex flex-col gap-4 md:pb-0", canEdit && "pb-24")}>
        <Photos item={item} />

        <div>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h1 className="text-2xl font-bold">{item.name}</h1>
            <StatusBadge status={status} className="mt-1" />
          </div>
          <p className="mt-0.5 text-[15px] text-muted-foreground">
            {item.category ? labels.category(item.category) : t("fields.noCategory")}
            {item.unit ? ` · ${item.unit}` : ""}
          </p>
        </div>

        {alerts
          .filter((a) => !a.snoozed)
          .map((a) => {
            const s = alertStatus({ ...a, kind: a.kind!, months: a.kind === "replace_due" ? replaceMonths(item.last_replaced_at ?? item.purchase_date ?? item.created_at) : null });
            const text =
              a.kind === "low_stock"
                ? t("lowBanner", { quantity: qty(item.quantity), threshold: qty(item.min_quantity) })
                : a.kind === "out_of_stock"
                  ? t("outBanner", { threshold: qty(item.min_quantity) })
                  : statusLabel(s);
            return (
              <p
                key={a.kind}
                role="status"
                className={cn(
                  "flex items-start gap-2 rounded-md px-4 py-3 text-[15px] font-semibold",
                  s.tone === "danger" && "bg-danger text-danger-foreground",
                  s.tone === "warning" && "bg-warning text-warning-foreground",
                  s.tone === "success" && "bg-success text-success-foreground",
                  s.tone === "neutral" && "bg-neutral text-neutral-foreground",
                )}
              >
                <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
                {text}
              </p>
            );
          })}

        <section className="flex items-center justify-between gap-4 rounded-md border border-border bg-card p-4">
          <div>
            <h2 className="text-[15px] font-medium">{t("fields.quantity")}</h2>
            <p className="text-sm text-muted-foreground">
              {item.min_quantity !== null ? t("thresholdValue", { threshold: qty(item.min_quantity) }) : t("fields.minQuantityHint")}
            </p>
          </div>
          <QuantityStepper id={item.id} name={item.name} quantity={item.quantity} low={low} size="lg" />
        </section>

        <section className="rounded-md border border-border bg-card px-4 py-1">
          <h2 className="sr-only">{t("info")}</h2>
          <dl>
            <InfoRow label={t("fields.location")}>
              {item.location ? (
                <Link href={`/items?location=${item.location.id}`} className="underline-offset-4 hover:underline">
                  {labels.locationPath(item.location)}
                </Link>
              ) : (
                <span className="font-normal text-muted-foreground">{t("unknownLocation")}</span>
              )}
            </InfoRow>
            {item.group && (
              <InfoRow label={tc("groups.group")}>
                <Link href={`/groups/${item.group.id}`} className="underline-offset-4 hover:underline">
                  {item.group.name}
                </Link>
              </InfoRow>
            )}
            <InfoRow label={t("fields.condition")}>{tc(`conditions.${item.condition}`)}</InfoRow>
            {item.expiry_date && <InfoRow label={t("fields.expiryDate")}>{fmtDate(item.expiry_date)}</InfoRow>}
            {item.opened_date && <InfoRow label={t("fields.openedDate")}>{fmtDate(item.opened_date)}</InfoRow>}
            {item.warranty_until && (
              <InfoRow label={t("fields.warrantyUntil")}>
                <span className="flex flex-wrap items-center justify-end gap-x-3">
                  {fmtDate(item.warranty_until)}
                  <Link href={`/items/${id}/warranty`} className="inline-flex min-h-11 items-center gap-1 text-primary underline-offset-4 hover:underline">
                    <ShieldCheck className="size-4" aria-hidden />
                    {tc("documents.claimWarranty")}
                  </Link>
                </span>
              </InfoRow>
            )}
            {item.replace_after_months && (
              <InfoRow label={t("fields.replaceAfterMonths")}>{format.number(item.replace_after_months)}</InfoRow>
            )}
            {item.last_replaced_at && <InfoRow label={t("fields.lastReplacedAt")}>{fmtDate(item.last_replaced_at)}</InfoRow>}
            {item.purchase_date && <InfoRow label={t("fields.purchaseDate")}>{fmtDate(item.purchase_date)}</InfoRow>}
            {item.purchase_price !== null && <InfoRow label={t("fields.purchasePrice")}>{currency(item.purchase_price)}</InfoRow>}
            {item.purchase_place && <InfoRow label={t("fields.purchasePlace")}>{item.purchase_place}</InfoRow>}
            {item.barcode && (
              <InfoRow label={t("fields.barcode")}>
                <span className="font-mono tabular-nums">{item.barcode}</span>
              </InfoRow>
            )}
            {attrDefs.success &&
              attrDefs.data
                .filter((d) => attrs[d.key])
                .map((d) => {
                  const raw = attrs[d.key];
                  const option = d.options?.find((o) => o.value === raw);
                  const value = option ? labels.attribute(option) : d.type === "date" ? fmtDate(raw) : raw;
                  return (
                    <InfoRow key={d.key} label={labels.attribute(d)}>
                      {value}
                    </InfoRow>
                  );
                })}
          </dl>
          {item.tags.length > 0 && (
            <ul className="flex flex-wrap gap-2 border-t border-border py-3" aria-label={t("fields.tags")}>
              {item.tags.map((tag) => (
                <li key={tag.id}>
                  <Link
                    href={`/items?tags=${tag.id}`}
                    className="inline-flex min-h-9 items-center rounded-md bg-muted px-2.5 text-sm font-medium hover:bg-border"
                  >
                    #{tag.name}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {item.notes && <p className="border-t border-border py-3 text-[15px] whitespace-pre-wrap">{item.notes}</p>}
        </section>

        <ItemDocuments itemId={id} />

        <ItemMaintenance itemId={id} itemName={item.name} />

        <History id={id} />
      </div>

      {canEdit && (
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-3 border-t border-border bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:mt-4 md:border-0 md:bg-transparent md:p-0">
        <Button className="flex-1 md:flex-none" disabled={addToShopping.isPending} onClick={() => addToShopping.mutate(item)}>
          {t("addToShopping")}
        </Button>
        <Button variant="outline" asChild className="md:hidden">
          <Link href={`/items/${id}/edit`}>{tc("common.edit")}</Link>
        </Button>
      </div>
      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("delete")}</DialogTitle>
            <DialogDescription>{t("deleteConfirm", { name: item.name })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              {tc("common.cancel")}
            </Button>
            <Button variant="danger" onClick={() => void remove()}>
              {tc("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

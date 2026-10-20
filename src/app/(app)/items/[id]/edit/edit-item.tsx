"use client";

import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/app-shell/page-header";
import { ItemDrawer } from "@/components/items/item-drawer";
import { ItemForm } from "@/components/items/item-form";
import { Skeleton } from "@/components/ui/skeleton";
import { useItem, type ItemDetail } from "@/lib/queries/items";
import type { ItemFormValues } from "@/lib/validation/item";

function toFormValues(item: ItemDetail): ItemFormValues {
  const str = (v: number | string | null) => (v === null ? "" : String(v));
  const attrs = (item.attributes && typeof item.attributes === "object" && !Array.isArray(item.attributes) ? item.attributes : {}) as Record<
    string,
    unknown
  >;
  return {
    name: item.name,
    category_id: item.category_id ?? "",
    location_id: item.location_id ?? "",
    group_id: item.group_id ?? "",
    quantity: str(item.quantity),
    unit: item.unit ?? "",
    min_quantity: str(item.min_quantity),
    condition: item.condition,
    purchase_date: item.purchase_date ?? "",
    purchase_price: str(item.purchase_price),
    purchase_place: item.purchase_place ?? "",
    expiry_date: item.expiry_date ?? "",
    opened_date: item.opened_date ?? "",
    warranty_until: item.warranty_until ?? "",
    replace_after_months: str(item.replace_after_months),
    last_replaced_at: item.last_replaced_at ?? "",
    notes: item.notes ?? "",
    barcode: item.barcode ?? "",
    attributes: Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k, String(v ?? "")])),
    tags: item.tags.map((tag) => tag.name),
  };
}

export function EditItem({ id, drawer = false }: { id: string; drawer?: boolean }) {
  const t = useTranslations("item");
  const { data: item, isPending } = useItem(id);

  if (drawer) {
    return (
      <ItemDrawer title={t("editTitle")}>
        {isPending ? (
          <Skeleton className="h-96" />
        ) : !item ? (
          <p className="text-muted-foreground">{t("notFound")}</p>
        ) : (
          <ItemForm mode="edit" embedded itemId={id} initial={toFormValues(item)} photos={item.photos} />
        )}
      </ItemDrawer>
    );
  }

  return (
    <div>
      <PageHeader title={t("editTitle")} back={`/items/${id}`} />
      {isPending ? (
        <Skeleton className="h-96" />
      ) : !item ? (
        <p className="text-muted-foreground">{t("notFound")}</p>
      ) : (
        <ItemForm mode="edit" itemId={id} initial={toFormValues(item)} photos={item.photos} />
      )}
    </div>
  );
}

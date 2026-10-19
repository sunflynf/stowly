"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Loader2, ScanBarcode } from "lucide-react";
import { toast } from "sonner";
import { ScannerDialog } from "@/components/scan/scanner-dialog";
import { Button } from "@/components/ui/button";
import { useFormats } from "@/lib/hooks/use-format";
import { suggestedName, type ProductInfo } from "@/lib/product-lookup";
import { findItemByBarcode } from "@/lib/queries/items";
import type { Category } from "@/lib/queries/taxonomy";
import { normalizeBarcode } from "@/lib/scan";
import type { ItemFormValues } from "@/lib/validation/item";
import { useAdjustQuantity } from "./use-item-mutations";

type Notice =
  | { type: "loading"; code: string }
  | { type: "existing"; code: string; item: { id: string; name: string; quantity: number; unit: string | null } }
  | { type: "found"; code: string; product: ProductInfo }
  | { type: "not-found"; code: string };

const BARCODE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"] as const;

async function lookupProduct(code: string): Promise<ProductInfo | null> {
  try {
    const response = await fetch(`/api/products/${encodeURIComponent(code)}`);
    if (!response.ok) return null;
    const body = (await response.json()) as { product: ProductInfo | null };
    return body.product;
  } catch {
    return null;
  }
}

/**
 * Barcode helper for quick add: scan (or receive ?barcode=) → store the code,
 * warn if the item already exists, otherwise prefill name and category from
 * public product databases.
 */
export function useBarcodeAssist(form: UseFormReturn<ItemFormValues>, categories: Category[], initialCode?: string) {
  const t = useTranslations("item");
  const f = useFormats();
  const adjust = useAdjustQuantity();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const handle = useCallback(
    async (raw: string) => {
      const code = normalizeBarcode(raw);
      if (!code) return;
      form.setValue("barcode", code, { shouldDirty: true });
      setNotice({ type: "loading", code });

      const existing = await findItemByBarcode(code);
      if (existing) {
        setNotice({ type: "existing", code, item: { ...existing, quantity: Number(existing.quantity) } });
        return;
      }
      const product = /^\d{6,14}$/.test(code) ? await lookupProduct(code) : null;
      if (!product) {
        setNotice({ type: "not-found", code });
        form.setFocus("name");
        return;
      }
      if (!form.getValues("name").trim()) form.setValue("name", suggestedName(product), { shouldDirty: true });
      if (!form.getValues("category_id") && product.category) {
        const match = categories.find((c) => c.builtin_key === product.category);
        if (match) form.setValue("category_id", match.id, { shouldDirty: true });
      }
      setNotice({ type: "found", code, product });
    },
    [form, categories],
  );

  // Arriving from the dashboard scanner with ?barcode=…
  const started = useRef(false);
  useEffect(() => {
    // Wait for categories so the category can be prefilled too.
    if (initialCode && categories.length > 0 && !started.current) {
      started.current = true;
      void handle(initialCode);
    }
  }, [initialCode, categories.length, handle]);

  const scanButton = (
    <>
      <Button variant="secondary" size="icon" aria-label={t("scanBarcode")} title={t("scanBarcode")} onClick={() => setOpen(true)}>
        <ScanBarcode />
      </Button>
      <ScannerDialog
        open={open}
        onOpenChange={setOpen}
        onResult={(v) => void handle(v)}
        formats={[...BARCODE_FORMATS]}
        title={t("scanBarcode")}
      />
    </>
  );

  const noticeView = notice && (
    <div
      role="status"
      className={
        notice.type === "existing"
          ? "rounded-[var(--radius)] bg-warning px-4 py-3 text-[15px] text-warning-foreground"
          : "rounded-[var(--radius)] bg-accent px-4 py-3 text-[15px] text-accent-foreground"
      }
    >
      {notice.type === "loading" && (
        <span className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {t("lookingUp", { code: notice.code })}
        </span>
      )}
      {notice.type === "found" && (
        <span className="flex items-center gap-3">
          {notice.product.imageUrl && (
            // External product thumbnail from Open Food Facts.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={notice.product.imageUrl} alt="" className="size-10 shrink-0 rounded-md bg-card object-contain" />
          )}
          {t("productFound", { code: notice.code })}
        </span>
      )}
      {notice.type === "not-found" && t("productNotFound", { code: notice.code })}
      {notice.type === "existing" && (
        <div className="flex flex-col gap-2">
          <span className="font-semibold">
            {t("barcodeExisting", {
              name: notice.item.name,
              quantity: `${f.quantity(notice.item.quantity)}${notice.item.unit ? ` ${notice.item.unit}` : ""}`,
            })}
          </span>
          <span className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href={`/items/${notice.item.id}`}>{t("openExisting")}</Link>
            </Button>
            <Button
              size="sm"
              disabled={adjust.isPending}
              onClick={() =>
                adjust.mutate(
                  { id: notice.item.id, delta: 1, note: "barcode" },
                  {
                    onSuccess: ({ quantity }) => {
                      toast.success(t("addedOne", { name: notice.item.name }));
                      setNotice({ ...notice, item: { ...notice.item, quantity } });
                    },
                  },
                )
              }
            >
              {t("addOneExisting")}
            </Button>
          </span>
        </div>
      )}
    </div>
  );

  return { scanButton, notice: noticeView, reset: () => setNotice(null) };
}

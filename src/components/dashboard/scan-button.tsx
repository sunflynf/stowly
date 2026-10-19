"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useState } from "react";
import { ScanLine } from "lucide-react";
import { toast } from "sonner";
import { ScannerDialog } from "@/components/scan/scanner-dialog";
import { findItemByBarcode } from "@/lib/queries/items";
import { normalizeBarcode, resolveScan } from "@/lib/scan";

/**
 * Scans a location QR label, an item link or a product barcode.
 * Labels open the location; a barcode you already own opens that item;
 * an unknown barcode starts quick add with the code (and product lookup).
 */
export function ScanButton() {
  const t = useTranslations("scan");
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const onResult = useCallback(
    async (value: string) => {
      const target = resolveScan(value, window.location.origin);
      if (target.type === "location") return router.push(`/locations/${target.id}`);
      if (target.type === "item") return router.push(`/items/${target.id}`);
      if (target.type === "path") return router.push(target.path);

      const code = normalizeBarcode(target.code);
      if (!code) return router.push(`/items?q=${encodeURIComponent(target.code)}`);
      const existing = await findItemByBarcode(code);
      if (existing) {
        toast.success(t("openingItem", { name: existing.name }));
        return router.push(`/items/${existing.id}`);
      }
      router.push(`/items/new?barcode=${encodeURIComponent(code)}`);
    },
    [router, t],
  );

  return (
    <>
      <button
        type="button"
        aria-label={t("button")}
        onClick={() => setOpen(true)}
        className="flex size-[52px] shrink-0 items-center justify-center rounded-[var(--radius)] border border-input bg-card hover:bg-muted"
      >
        <ScanLine className="size-5" aria-hidden />
      </button>
      <ScannerDialog open={open} onOpenChange={setOpen} onResult={(v) => void onResult(v)} />
    </>
  );
}

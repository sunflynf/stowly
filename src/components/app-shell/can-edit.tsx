"use client";

import { useTranslations } from "next-intl";
import { Eye } from "lucide-react";
import { useHousehold } from "@/lib/queries/household";

/** Renders its children only for owners and editors of the active household. */
export function CanEdit({ children, fallback = null }: { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { canEdit } = useHousehold();
  return canEdit ? children : fallback;
}

/** Tells viewers why add/edit controls are missing; the server rejects their writes anyway. */
export function ReadOnlyBanner() {
  const t = useTranslations("members");
  const { canEdit } = useHousehold();
  if (canEdit) return null;
  return (
    <div role="status" className="flex items-center justify-center gap-2 bg-neutral px-4 py-2 text-sm font-medium text-neutral-foreground print:hidden">
      <Eye className="size-4" aria-hidden />
      {t("readOnly")}
    </div>
  );
}

"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdjustQuantity } from "./use-item-mutations";

interface Props {
  id: string;
  name: string;
  quantity: number;
  low?: boolean;
  size?: "sm" | "lg";
  className?: string;
}

/** Inline +/- that writes through `adjust_item_quantity` (atomic, logged). */
export function QuantityStepper({ id, name, quantity, low, size = "sm", className }: Props) {
  const t = useTranslations("item");
  const format = useFormatter();
  const adjust = useAdjustQuantity();
  const change = (delta: number) => adjust.mutate({ id, delta });

  if (size === "lg") {
    return (
      <div className={cn("flex items-center gap-4", className)} role="group" aria-label={t("quantityOf", { name })}>
        <button
          type="button"
          onClick={() => change(-1)}
          disabled={quantity <= 0}
          aria-label={t("decrease")}
          className="flex size-12 items-center justify-center rounded-[var(--radius)] border border-input bg-card text-foreground hover:bg-muted disabled:opacity-40"
        >
          <Minus className="size-5" aria-hidden />
        </button>
        <output
          aria-live="polite"
          className={cn("min-w-10 text-center text-3xl font-bold tabular-nums", low && "text-danger-foreground")}
        >
          {format.number(quantity, "quantity")}
        </output>
        <button
          type="button"
          onClick={() => change(1)}
          aria-label={t("increase")}
          className="flex size-12 items-center justify-center rounded-[var(--radius)] bg-primary text-primary-foreground hover:bg-primary-hover"
        >
          <Plus className="size-5" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={t("quantityOf", { name })}
      className={cn("inline-flex h-11 items-center rounded-[var(--radius)] border border-input bg-card", className)}
    >
      <button
        type="button"
        onClick={() => change(-1)}
        disabled={quantity <= 0}
        aria-label={t("decrease")}
        className="flex h-full w-11 items-center justify-center rounded-l-[var(--radius)] hover:bg-muted disabled:opacity-40"
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <output
        aria-live="polite"
        className={cn("min-w-8 text-center font-semibold tabular-nums", low && "text-danger-foreground")}
      >
        {format.number(quantity, "quantity")}
      </output>
      <button
        type="button"
        onClick={() => change(1)}
        aria-label={t("increase")}
        className="flex h-full w-11 items-center justify-center rounded-r-[var(--radius)] hover:bg-muted"
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}

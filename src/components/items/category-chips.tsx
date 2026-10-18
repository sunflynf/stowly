"use client";

import { useTranslations } from "next-intl";
import { categoryIcon } from "@/lib/category-icons";
import { useCategories, useLabels } from "@/lib/queries/taxonomy";
import { cn } from "@/lib/utils";

/** Single-choice category chips (radio group). */
export function CategoryChips({
  value,
  onChange,
  labelledBy,
}: {
  value: string;
  onChange: (id: string) => void;
  labelledBy: string;
}) {
  const t = useTranslations("item.fields");
  const { data: categories = [] } = useCategories();
  const labels = useLabels();

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
      {categories.map((c) => {
        const Icon = categoryIcon(c.icon);
        const checked = c.id === value;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => onChange(checked ? "" : c.id)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-[15px] font-medium transition-colors",
              checked ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-muted",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {labels.category(c)}
          </button>
        );
      })}
      {categories.length === 0 && <span className="text-sm text-muted-foreground">{t("noCategory")}</span>}
    </div>
  );
}

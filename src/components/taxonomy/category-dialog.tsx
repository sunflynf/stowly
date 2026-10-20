"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { CATEGORY_ICON_NAMES, CATEGORY_ICONS, type CategoryIconName } from "@/lib/category-icons";
import type { Category } from "@/lib/queries/taxonomy";
import { normalizeText } from "@/lib/text";
import { cn } from "@/lib/utils";
import type { AttributeDef } from "@/lib/validation/item";

export interface CategoryDraft {
  name: string;
  name_en: string;
  icon: CategoryIconName;
  default_attributes: AttributeDef[];
}

function slugKey(label: string, taken: Set<string>) {
  const base = normalizeText(label).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 32) || "field";
  let key = base;
  for (let i = 2; taken.has(key); i++) key = `${base}_${i}`;
  return key;
}

export function CategoryDialog({
  open,
  onOpenChange,
  category,
  busy,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
  busy: boolean;
  onSubmit: (draft: CategoryDraft) => void;
}) {
  const t = useTranslations("categoriesPage");
  const tc = useTranslations("common");
  const [draft, setDraft] = useState<CategoryDraft>(() => ({
    name: category?.name ?? "",
    name_en: category?.name_en ?? "",
    icon: (CATEGORY_ICON_NAMES as string[]).includes(category?.icon ?? "") ? (category!.icon as CategoryIconName) : "package",
    default_attributes: category?.attributes ?? [],
  }));

  const setAttr = (index: number, patch: Partial<AttributeDef>) =>
    setDraft((d) => ({
      ...d,
      default_attributes: d.default_attributes.map((a, i) => (i === index ? { ...a, ...patch } : a)),
    }));

  const addField = () =>
    setDraft((d) => ({
      ...d,
      default_attributes: [
        ...d.default_attributes,
        // Empty key = new field; a key is derived from its label on save.
        { key: "", type: "text", label_vi: "", label_en: "" },
      ],
    }));

  const valid = draft.name.trim() && draft.default_attributes.every((a) => a.label_vi.trim() || a.label_en.trim());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid) return;
            const taken = new Set(draft.default_attributes.map((a) => a.key).filter(Boolean));
            const attrs = draft.default_attributes.map((a) => {
              const vi = a.label_vi.trim() || a.label_en.trim();
              const en = a.label_en.trim() || vi;
              // Existing keys are kept so values already stored on items stay linked.
              const key = a.key || slugKey(en, taken);
              taken.add(key);
              return { ...a, key, label_vi: vi, label_en: en };
            });
            onSubmit({ ...draft, name: draft.name.trim(), name_en: draft.name_en.trim(), default_attributes: attrs });
          }}
        >
          <DialogHeader>
            <DialogTitle>{category ? t("editCategory") : t("addCategory")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field label={t("name")} htmlFor="cat-name">
              <Input id="cat-name" value={draft.name} maxLength={80} required onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <Field label={t("nameEn")} htmlFor="cat-name-en">
              <Input id="cat-name-en" value={draft.name_en} maxLength={80} onChange={(e) => setDraft({ ...draft, name_en: e.target.value })} />
            </Field>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold">{t("icon")}</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("icon")}>
                {CATEGORY_ICON_NAMES.map((name) => {
                  const Icon = CATEGORY_ICONS[name];
                  const checked = draft.icon === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      aria-label={name}
                      onClick={() => setDraft({ ...draft, icon: name })}
                      className={cn(
                        "flex size-11 items-center justify-center rounded-md border",
                        checked ? "border-primary bg-accent text-accent-foreground" : "border-input bg-card hover:bg-muted",
                      )}
                    >
                      <Icon className="size-5" aria-hidden />
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-semibold">{t("fields")}</legend>
              <p className="-mt-1 text-sm text-muted-foreground">{t("fieldsHint")}</p>
              {draft.default_attributes.map((attr, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_1fr_8rem_auto]">
                  <Field label={t("fieldLabelVi")} htmlFor={`attr-vi-${i}`}>
                    <Input id={`attr-vi-${i}`} value={attr.label_vi} maxLength={60} onChange={(e) => setAttr(i, { label_vi: e.target.value })} />
                  </Field>
                  <Field label={t("fieldLabelEn")} htmlFor={`attr-en-${i}`}>
                    <Input id={`attr-en-${i}`} value={attr.label_en} maxLength={60} onChange={(e) => setAttr(i, { label_en: e.target.value })} />
                  </Field>
                  <Field label={t("fieldType")} htmlFor={`attr-type-${i}`} className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto">
                    {attr.type === "select" ? (
                      <Input id={`attr-type-${i}`} value={t("fieldTypes.select")} readOnly />
                    ) : (
                      <NativeSelect
                        id={`attr-type-${i}`}
                        value={attr.type}
                        onChange={(e) => setAttr(i, { type: e.target.value as AttributeDef["type"] })}
                      >
                        <option value="text">{t("fieldTypes.text")}</option>
                        <option value="number">{t("fieldTypes.number")}</option>
                        <option value="date">{t("fieldTypes.date")}</option>
                      </NativeSelect>
                    )}
                  </Field>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("removeField")}
                    onClick={() =>
                      setDraft((d) => ({ ...d, default_attributes: d.default_attributes.filter((_, j) => j !== i) }))
                    }
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
              {draft.default_attributes.length < 30 && (
                <Button variant="secondary" onClick={addField} className="self-start">
                  <Plus />
                  {t("addField")}
                </Button>
              )}
            </fieldset>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={busy || !valid}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

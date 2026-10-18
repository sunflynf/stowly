"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { describedBy, Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { createItemAction, updateItemAction } from "@/lib/actions/items";
import { useValidationMessage } from "@/lib/hooks/use-validation-message";
import { uploadItemPhoto } from "@/lib/photos";
import { useCategories, useLabels } from "@/lib/queries/taxonomy";
import { ITEM_CONDITIONS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { emptyItemForm, itemInputSchema, type ItemFormValues } from "@/lib/validation/item";
import { CategoryChips } from "./category-chips";
import { LocationPicker } from "./location-picker";
import { ItemPhotoManager, PendingPhotoField, type ExistingPhoto } from "./photo-field";
import { TagInput } from "./tag-input";
import { useInvalidateItems } from "./use-item-mutations";

interface ItemFormProps {
  mode: "quick" | "edit";
  itemId?: string;
  initial?: Partial<ItemFormValues>;
  photos?: ExistingPhoto[];
}

function stepNumber(value: string, delta: number) {
  const n = Number(value.replace(",", ".")) || 0;
  return String(Math.max(0, Math.round((n + delta) * 1000) / 1000));
}

export function ItemForm({ mode, itemId, initial, photos = [] }: ItemFormProps) {
  const t = useTranslations("item");
  const tc = useTranslations();
  const vm = useValidationMessage();
  const router = useRouter();
  const invalidate = useInvalidateItems();
  const labels = useLabels();
  const { data: categories = [] } = useCategories();
  const uid = useId();
  const [pending, startTransition] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const [showMore, setShowMore] = useState(mode === "edit");

  const form = useForm<ItemFormValues>({ defaultValues: { ...emptyItemForm, ...initial } });
  const { register, control, setValue, formState } = form;
  const errors = formState.errors;
  const err = (key: keyof ItemFormValues) => vm(errors[key]?.message as string | undefined);

  const categoryId = useWatch({ control, name: "category_id" });
  const currentName = useWatch({ control, name: "name" });
  const category = categories.find((c) => c.id === categoryId);

  const submit = (addAnother: boolean) =>
    form.handleSubmit((values) => {
      const parsed = itemInputSchema.safeParse(values);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          form.setError(issue.path[0] as keyof ItemFormValues, { message: issue.message });
        }
        setShowMore(true);
        return;
      }
      startTransition(async () => {
        const result = mode === "edit" && itemId ? await updateItemAction(itemId, values) : await createItemAction(values);
        if (!result.ok) {
          toast.error(tc(`errors.${result.error}`));
          return;
        }
        const id = itemId ?? (result.data as { id: string }).id;
        if (files.length) {
          const uploads = await Promise.allSettled(files.map((file) => uploadItemPhoto(id, file)));
          if (uploads.some((u) => u.status === "rejected")) toast.error(t("photoFailed"));
        }
        await invalidate(id);
        if (mode === "edit") {
          toast.success(t("updated"));
          router.push(`/items/${id}`);
          return;
        }
        toast.success(t("created", { name: values.name }));
        if (addAnother) {
          // Keep category and location for fast batch entry.
          form.reset({ ...emptyItemForm, category_id: values.category_id, location_id: values.location_id });
          setFiles([]);
          window.scrollTo({ top: 0, behavior: "smooth" });
          form.setFocus("name");
        } else {
          router.push(`/items/${id}`);
        }
      });
    });

  const ids = {
    name: `${uid}-name`,
    categoryLabel: `${uid}-category`,
    quantity: `${uid}-quantity`,
    min: `${uid}-min`,
    unit: `${uid}-unit`,
    location: `${uid}-location`,
    condition: `${uid}-condition`,
    expiry: `${uid}-expiry`,
    opened: `${uid}-opened`,
    warranty: `${uid}-warranty`,
    replace: `${uid}-replace`,
    replaced: `${uid}-replaced`,
    pdate: `${uid}-pdate`,
    price: `${uid}-price`,
    place: `${uid}-place`,
    tags: `${uid}-tags`,
    notes: `${uid}-notes`,
  };

  const card = "flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-card p-4 md:p-5";

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false)();
      }}
      className="flex flex-col gap-4 pb-24 md:pb-0"
    >
      <section aria-label={t("fields.photos")}>
        {mode === "edit" && itemId ? (
          <div className={card}>
            <h2 className="font-semibold">{t("fields.photos")}</h2>
            <ItemPhotoManager itemId={itemId} name={currentName} photos={photos} />
          </div>
        ) : (
          <PendingPhotoField files={files} onChange={setFiles} />
        )}
      </section>

      <Field label={t("fields.name")} htmlFor={ids.name} error={err("name")}>
        <Input
          {...describedBy(ids.name, err("name"))}
          placeholder={t("fields.namePlaceholder")}
          autoComplete="off"
          maxLength={200}
          enterKeyHint="next"
          {...register("name")}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <span id={ids.categoryLabel} className="text-sm font-semibold text-foreground/90">
          {t("fields.category")}
        </span>
        <Controller
          control={control}
          name="category_id"
          render={({ field }) => <CategoryChips value={field.value} onChange={field.onChange} labelledBy={ids.categoryLabel} />}
        />
      </div>

      <div className={card}>
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={ids.quantity} className="font-semibold">
            {t("fields.quantity")}
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label={t("decrease")}
              onClick={() => setValue("quantity", stepNumber(form.getValues("quantity"), -1), { shouldDirty: true })}
              className="flex size-11 items-center justify-center rounded-[var(--radius)] border border-input bg-card hover:bg-muted"
            >
              <Minus className="size-4" aria-hidden />
            </button>
            <Input
              {...describedBy(ids.quantity, err("quantity"))}
              inputMode="decimal"
              className="w-16 text-center text-lg font-semibold"
              {...register("quantity")}
            />
            <button
              type="button"
              aria-label={t("increase")}
              onClick={() => setValue("quantity", stepNumber(form.getValues("quantity"), 1), { shouldDirty: true })}
              className="flex size-11 items-center justify-center rounded-[var(--radius)] bg-primary text-primary-foreground hover:bg-primary-hover"
            >
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
        </div>
        {err("quantity") && <p className="text-sm font-medium text-danger-foreground">{err("quantity")}</p>}
        <div className="h-px bg-border" />
        <div className="flex items-center justify-between gap-3">
          <label htmlFor={ids.min} className="text-[15px] text-muted-foreground">
            {t("fields.minQuantity")}
          </label>
          <Input
            {...describedBy(ids.min, err("min_quantity"))}
            inputMode="decimal"
            placeholder="—"
            className="w-20 text-center"
            {...register("min_quantity")}
          />
        </div>
        {err("min_quantity") && <p className="text-sm font-medium text-danger-foreground">{err("min_quantity")}</p>}
      </div>

      <Field label={t("fields.location")} htmlFor={ids.location}>
        <Controller
          control={control}
          name="location_id"
          render={({ field }) => (
            <LocationPicker id={ids.location} value={field.value || null} onChange={(v) => field.onChange(v ?? "")} />
          )}
        />
      </Field>

      {mode === "quick" && (
        <button
          type="button"
          aria-expanded={showMore}
          onClick={() => setShowMore((s) => !s)}
          className="flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius)] text-[15px] font-semibold text-primary hover:bg-accent"
        >
          {showMore ? t("lessDetails") : t("moreDetails")}
          <ChevronDown className={cn("size-4 transition-transform", showMore && "rotate-180")} aria-hidden />
        </button>
      )}

      {showMore && (
        <>
          <fieldset className={card}>
            <legend className="sr-only">{t("sections.dates")}</legend>
            <h2 className="font-semibold" aria-hidden>
              {t("sections.dates")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("fields.expiryDate")} htmlFor={ids.expiry} error={err("expiry_date")}>
                <Input type="date" {...describedBy(ids.expiry, err("expiry_date"))} {...register("expiry_date")} />
              </Field>
              <Field label={t("fields.warrantyUntil")} htmlFor={ids.warranty} error={err("warranty_until")}>
                <Input type="date" {...describedBy(ids.warranty, err("warranty_until"))} {...register("warranty_until")} />
              </Field>
              <Field label={t("fields.openedDate")} htmlFor={ids.opened} error={err("opened_date")}>
                <Input type="date" {...describedBy(ids.opened, err("opened_date"))} {...register("opened_date")} />
              </Field>
              <Field
                label={t("fields.replaceAfterMonths")}
                htmlFor={ids.replace}
                error={err("replace_after_months")}
                hint={t("fields.replaceAfterHint")}
              >
                <Input
                  inputMode="numeric"
                  {...describedBy(ids.replace, err("replace_after_months"), true)}
                  {...register("replace_after_months")}
                />
              </Field>
              <Field label={t("fields.lastReplacedAt")} htmlFor={ids.replaced} error={err("last_replaced_at")}>
                <Input type="date" {...describedBy(ids.replaced, err("last_replaced_at"))} {...register("last_replaced_at")} />
              </Field>
              <Field label={t("fields.condition")} htmlFor={ids.condition}>
                <NativeSelect id={ids.condition} {...register("condition")}>
                  {ITEM_CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {tc(`conditions.${c}`)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
          </fieldset>

          <fieldset className={card}>
            <legend className="sr-only">{t("sections.purchase")}</legend>
            <h2 className="font-semibold" aria-hidden>
              {t("sections.purchase")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("fields.purchaseDate")} htmlFor={ids.pdate} error={err("purchase_date")}>
                <Input type="date" {...describedBy(ids.pdate, err("purchase_date"))} {...register("purchase_date")} />
              </Field>
              <Field label={t("fields.purchasePrice")} htmlFor={ids.price} error={err("purchase_price")}>
                <Input inputMode="decimal" {...describedBy(ids.price, err("purchase_price"))} {...register("purchase_price")} />
              </Field>
              <Field label={t("fields.purchasePlace")} htmlFor={ids.place} error={err("purchase_place")}>
                <Input maxLength={200} {...describedBy(ids.place, err("purchase_place"))} {...register("purchase_place")} />
              </Field>
            </div>
          </fieldset>

          <fieldset className={card}>
            <legend className="sr-only">{t("sections.extra")}</legend>
            <h2 className="font-semibold" aria-hidden>
              {t("sections.extra")}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("fields.unit")} htmlFor={ids.unit} error={err("unit")}>
                <Input
                  maxLength={20}
                  placeholder={t("fields.unitPlaceholder")}
                  {...describedBy(ids.unit, err("unit"))}
                  {...register("unit")}
                />
              </Field>
              {category?.attributes.map((attr) => {
                const id = `${uid}-attr-${attr.key}`;
                return (
                  <Field key={attr.key} label={labels.attribute(attr)} htmlFor={id}>
                    {attr.type === "select" && attr.options ? (
                      <NativeSelect id={id} {...register(`attributes.${attr.key}`)}>
                        <option value="">—</option>
                        {attr.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {labels.attribute(o)}
                          </option>
                        ))}
                      </NativeSelect>
                    ) : (
                      <Input
                        id={id}
                        type={attr.type === "date" ? "date" : "text"}
                        inputMode={attr.type === "number" ? "decimal" : undefined}
                        maxLength={500}
                        {...register(`attributes.${attr.key}`)}
                      />
                    )}
                  </Field>
                );
              })}
            </div>
            <Field label={t("fields.tags")} htmlFor={ids.tags}>
              <Controller
                control={control}
                name="tags"
                render={({ field }) => <TagInput id={ids.tags} value={field.value} onChange={field.onChange} />}
              />
            </Field>
            <Field label={t("fields.notes")} htmlFor={ids.notes} error={err("notes")}>
              <Textarea maxLength={5000} {...describedBy(ids.notes, err("notes"))} {...register("notes")} />
            </Field>
          </fieldset>
        </>
      )}

      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-3 border-t border-border bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:static md:justify-end md:border-0 md:bg-transparent md:p-0">
        {mode === "quick" && (
          <Button variant="outline" className="flex-1 md:flex-none" disabled={pending} onClick={() => void submit(true)()}>
            {t("saveAndAddAnother")}
          </Button>
        )}
        <Button type="submit" className="flex-1 md:flex-none md:min-w-32" disabled={pending}>
          {pending ? tc("common.saving") : t("save")}
        </Button>
      </div>
    </form>
  );
}

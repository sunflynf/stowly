"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { unwrap, useErrorToast } from "@/components/items/use-item-mutations";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { createMaintenanceTaskAction, updateMaintenanceTaskAction } from "@/lib/actions/maintenance";
import type { MaintenanceTask } from "@/lib/queries/maintenance";
import { INTERVAL_UNITS, type IntervalUnit } from "@/lib/validation/maintenance";
import { ItemPicker, type PickedItem } from "./item-picker";
import { useInvalidateMaintenance } from "./use-maintenance";

/** Create or edit a recurring task. `item` fixes the item (item detail page). */
export function TaskDialog({
  open,
  onOpenChange,
  task,
  item,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: MaintenanceTask | null;
  item?: PickedItem;
}) {
  const t = useTranslations("maintenance");
  const tc = useTranslations("common");
  const onError = useErrorToast();
  const invalidate = useInvalidateMaintenance();
  const [title, setTitle] = useState(task?.title ?? "");
  const [count, setCount] = useState(String(task?.interval_count ?? 3));
  const [unit, setUnit] = useState<IntervalUnit>(task?.interval_unit ?? "month");
  const [start, setStart] = useState(task?.start_date ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [picked, setPicked] = useState<PickedItem | null>(
    item ?? (task?.item_id ? { id: task.item_id, name: task.item_name ?? "" } : null),
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const input = { title, item_id: picked?.id ?? null, interval_count: count, interval_unit: unit, start_date: start, notes };
      if (task) unwrap(await updateMaintenanceTaskAction(task.id, input));
      else unwrap(await createMaintenanceTaskAction(input));
      await invalidate(picked?.id);
      onOpenChange(false);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  const countValid = /^\d+$/.test(count) && Number(count) >= 1 && Number(count) <= 1000;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (title.trim() && countValid) void save();
          }}
        >
          <DialogHeader>
            <DialogTitle>{task ? t("edit") : t("add")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field label={t("taskTitle")} htmlFor="task-title">
              <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("titlePlaceholder")} maxLength={120} autoFocus />
            </Field>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-sm font-semibold">{t("interval")}</legend>
              <div className="grid grid-cols-[6rem_1fr] gap-3">
                <Input
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                  inputMode="numeric"
                  aria-label={t("intervalCount")}
                  aria-invalid={!countValid}
                />
                <NativeSelect value={unit} onChange={(e) => setUnit(e.target.value as IntervalUnit)} aria-label={t("intervalUnit")}>
                  {INTERVAL_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {t(`units.${u}`, { count: Number(count) || 1 })}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            </fieldset>
            <Field label={t("startDate")} htmlFor="task-start" hint={t("startDateHint")}>
              <Input id="task-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} aria-describedby="task-start-hint" />
            </Field>
            {!item && (
              <Field label={t("item")} htmlFor="task-item" hint={t("itemHint")}>
                <ItemPicker id="task-item" value={picked} onChange={setPicked} />
              </Field>
            )}
            <Field label={t("notes")} htmlFor="task-notes">
              <Textarea id="task-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} rows={2} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={busy || !title.trim() || !countValid}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

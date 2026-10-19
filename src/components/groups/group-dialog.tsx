"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { unwrap, useErrorToast, useInvalidateItems } from "@/components/items/use-item-mutations";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createGroupAction, updateGroupAction } from "@/lib/actions/groups";
import type { GroupStats } from "@/lib/queries/groups";
import { qk } from "@/lib/queries/keys";

/** Create or edit a group (name, unit, shared threshold). */
export function GroupDialog({
  open,
  onOpenChange,
  group,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: Pick<GroupStats, "id" | "name" | "unit" | "min_quantity"> | null;
  onSaved?: (id: string) => void;
}) {
  const t = useTranslations("groups");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const invalidate = useInvalidateItems();
  const onError = useErrorToast();
  const [name, setName] = useState(group?.name ?? "");
  const [unit, setUnit] = useState(group?.unit ?? "");
  const [min, setMin] = useState(group?.min_quantity?.toString() ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const input = { name, unit, min_quantity: min };
      let id = group?.id;
      if (id) unwrap(await updateGroupAction(id, input));
      else id = unwrap(await createGroupAction(input)).id;
      await Promise.all([qc.invalidateQueries({ queryKey: qk.groups }), invalidate()]);
      onSaved?.(id);
      onOpenChange(false);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            // Portalled, but React still bubbles submit to an enclosing form (the item form).
            e.stopPropagation();
            if (name.trim()) void save();
          }}
        >
          <DialogHeader>
            <DialogTitle>{group ? t("edit") : t("add")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field label={t("name")} htmlFor="group-name">
              <Input id="group-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("namePlaceholder")} maxLength={80} autoFocus />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("threshold")} htmlFor="group-min" hint={t("thresholdHint")}>
                <Input id="group-min" value={min} onChange={(e) => setMin(e.target.value)} inputMode="decimal" aria-describedby="group-min-hint" />
              </Field>
              <Field label={t("unit")} htmlFor="group-unit">
                <Input id="group-unit" value={unit} onChange={(e) => setUnit(e.target.value)} maxLength={20} />
              </Field>
            </div>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={busy || !name.trim()}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

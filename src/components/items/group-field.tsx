"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, type Control } from "react-hook-form";
import { Plus } from "lucide-react";
import { GroupDialog } from "@/components/groups/group-dialog";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { NativeSelect } from "@/components/ui/input";
import { useGroups } from "@/lib/queries/groups";
import type { ItemFormValues } from "@/lib/validation/item";

/** Optional group membership, with inline "new group". */
export function GroupField({ control, id }: { control: Control<ItemFormValues>; id: string }) {
  const t = useTranslations("groups");
  const { data: groups = [] } = useGroups();
  const [creating, setCreating] = useState(false);

  return (
    <Controller
      control={control}
      name="group_id"
      render={({ field }) => (
        <Field label={t("group")} htmlFor={id} hint={t("groupHint")}>
          <div className="flex gap-2">
            <NativeSelect id={id} value={field.value} onChange={(e) => field.onChange(e.target.value)} aria-describedby={`${id}-hint`}>
              <option value="">{t("noGroup")}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </NativeSelect>
            <Button variant="secondary" size="icon" aria-label={t("newGroup")} title={t("newGroup")} onClick={() => setCreating(true)}>
              <Plus />
            </Button>
          </div>
          {creating && <GroupDialog open onOpenChange={setCreating} onSaved={(newId) => field.onChange(newId)} />}
        </Field>
      )}
    />
  );
}

"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Plus } from "lucide-react";
import { CanEdit } from "@/components/app-shell/can-edit";
import { Button } from "@/components/ui/button";
import { useMaintenanceAlerts, useMaintenanceTasks } from "@/lib/queries/maintenance";
import { TaskCard } from "./task-card";
import { TaskDialog } from "./task-dialog";

/** Maintenance schedules of one item, on its detail page. */
export function ItemMaintenance({ itemId, itemName }: { itemId: string; itemName: string }) {
  const t = useTranslations("maintenance");
  const { data: tasks = [] } = useMaintenanceTasks(itemId);
  const { data: alerts = [] } = useMaintenanceAlerts();
  const [creating, setCreating] = useState(false);
  const alertOf = new Map(alerts.map((a) => [a.task_id, a]));

  return (
    <section className="rounded-[var(--radius-lg)] border border-border bg-card p-4 md:p-5" aria-labelledby="item-maintenance">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="item-maintenance" className="font-semibold">
          {t("title")}
        </h2>
        <CanEdit>
          <Button variant="outline" size="sm" onClick={() => setCreating(true)}>
            <Plus />
            {t("addShort")}
          </Button>
        </CanEdit>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("itemEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} alert={alertOf.get(task.id)} showItem={false} />
          ))}
        </ul>
      )}
      {creating && <TaskDialog open onOpenChange={setCreating} item={{ id: itemId, name: itemName }} />}
    </section>
  );
}

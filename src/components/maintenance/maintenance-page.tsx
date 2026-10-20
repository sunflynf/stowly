"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Plus } from "lucide-react";
import { CanEdit } from "@/components/app-shell/can-edit";
import { PageHeader } from "@/components/app-shell/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMaintenanceAlerts, useMaintenanceTasks } from "@/lib/queries/maintenance";
import { TaskCard } from "./task-card";
import { TaskDialog } from "./task-dialog";

/** All recurring tasks: what needs doing now, what is snoozed, and what comes next. */
export function MaintenancePage() {
  const t = useTranslations("maintenance");
  const { data: tasks, isPending } = useMaintenanceTasks();
  const { data: alerts = [] } = useMaintenanceAlerts();
  const [creating, setCreating] = useState(false);

  const alertOf = new Map(alerts.map((a) => [a.task_id, a]));
  const sections = [
    { key: "due", tasks: (tasks ?? []).filter((x) => alertOf.has(x.id) && !alertOf.get(x.id)!.snoozed) },
    { key: "snoozed", tasks: (tasks ?? []).filter((x) => alertOf.get(x.id)?.snoozed) },
    { key: "upcoming", tasks: (tasks ?? []).filter((x) => !alertOf.has(x.id)) },
  ] as const;

  const addButton = (
    <CanEdit>
      <Button onClick={() => setCreating(true)}>
        <Plus />
        {t("add")}
      </Button>
    </CanEdit>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={addButton} />
      <div className="mb-4 md:hidden">{addButton}</div>
      {isPending ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : !tasks?.length ? (
        <p className="rounded-md border border-border bg-card p-8 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="flex flex-col gap-6">
          {sections
            .filter((s) => s.tasks.length > 0)
            .map((s) => (
              <section key={s.key} aria-labelledby={`maint-${s.key}`}>
                <h2 id={`maint-${s.key}`} className="mb-2 font-semibold">
                  {t(`sections.${s.key}`, { count: s.tasks.length })}
                </h2>
                <ul className="flex flex-col gap-3">
                  {s.tasks.map((task) => (
                    <TaskCard key={task.id} task={task} alert={alertOf.get(task.id)} />
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
      {creating && <TaskDialog open onOpenChange={setCreating} />}
    </div>
  );
}

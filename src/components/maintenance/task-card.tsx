"use client";

import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { AlarmClockOff, BellRing, Check, History, MoreVertical, Pencil, Trash2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { CanEdit } from "@/components/app-shell/can-edit";
import { StatusBadge } from "@/components/items/status-badge";
import { unwrap, useErrorToast } from "@/components/items/use-item-mutations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { completeMaintenanceTaskAction, deleteMaintenanceTaskAction, snoozeMaintenanceTaskAction } from "@/lib/actions/maintenance";
import { useFormats } from "@/lib/hooks/use-format";
import { useHouseholdPeople } from "@/lib/queries/household";
import { useMaintenanceLog, type MaintenanceAlert, type MaintenanceTask } from "@/lib/queries/maintenance";
import { alertStatus } from "@/lib/status";
import { TaskDialog } from "./task-dialog";
import { useIntervalLabel, useInvalidateMaintenance } from "./use-maintenance";

function TaskHistory({ taskId }: { taskId: string }) {
  const t = useTranslations("maintenance");
  const f = useFormats();
  const { data: log = [], isPending } = useMaintenanceLog(taskId);
  const { data: people } = useHouseholdPeople();
  if (isPending) return null;
  if (!log.length) return <p className="mt-2 text-sm text-muted-foreground">{t("neverDone")}</p>;
  return (
    <ol className="mt-2 flex flex-col text-sm" aria-label={t("history")}>
      {log.map((l) => (
        <li key={l.id} className="flex justify-between gap-3 border-b border-border py-1.5 last:border-0">
          <span>
            {f.date(l.done_on)}
            {l.note && <span className="text-muted-foreground"> · {l.note}</span>}
          </span>
          {l.actor_id && people?.get(l.actor_id) && <span className="text-muted-foreground">{people.get(l.actor_id)!.display_name}</span>}
        </li>
      ))}
    </ol>
  );
}

/** One recurring task: status (from maintenance_alerts when raised), next due, last done, actions. */
export function TaskCard({ task, alert, showItem = true }: { task: MaintenanceTask; alert?: MaintenanceAlert; showItem?: boolean }) {
  const t = useTranslations("maintenance");
  const ta = useTranslations("alerts");
  const tc = useTranslations("common");
  const f = useFormats();
  const interval = useIntervalLabel();
  const onError = useErrorToast();
  const invalidate = useInvalidateMaintenance();
  const [completing, setCompleting] = useState(false);
  const [doneOn, setDoneOn] = useState("");
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const act = useMutation({
    mutationFn: async ({ run }: { run: () => Promise<unknown>; done: string }) => run(),
    onSuccess: async (_d, { done }) => {
      toast.success(done);
      await invalidate(task.item_id);
    },
    onError,
  });

  const complete = () =>
    act.mutate(
      {
        run: async () => unwrap(await completeMaintenanceTaskAction({ id: task.id, done_on: doneOn, note })),
        done: t("doneToast"),
      },
      {
        onSuccess: () => {
          setCompleting(false);
          setNote("");
          setDoneOn("");
        },
      },
    );

  const snoozed = alert?.snoozed ?? false;

  return (
    <li id={`task-${task.id}`} className="scroll-mt-24 rounded-md border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Wrench className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold break-words">{task.title}</p>
          <p className="text-sm text-muted-foreground">
            {interval(task.interval_count, task.interval_unit)}
            {showItem && task.item_id && (
              <>
                {" · "}
                <Link href={`/items/${task.item_id}`} className="underline-offset-4 hover:underline">
                  {task.item_name}
                </Link>
              </>
            )}
          </p>
        </div>
        {alert ? (
          <StatusBadge status={alertStatus({ kind: alert.kind, severity: alert.severity, days_left: alert.days_left })} />
        ) : (
          <Badge tone="outline">{t("dueOn", { date: f.date(task.next_due) })}</Badge>
        )}
      </div>

      <p className="mt-2 text-sm text-muted-foreground">
        {alert ? `${t("dueOn", { date: f.date(task.next_due) })} · ` : ""}
        {task.last_done_on ? t("lastDone", { date: f.date(task.last_done_on) }) : t("neverDone")}
      </p>
      {task.notes && <p className="mt-1 text-sm whitespace-pre-wrap">{task.notes}</p>}
      {snoozed && alert?.snoozed_until && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <BellRing className="size-4" aria-hidden />
          {ta("snoozedUntil", { date: f.date(alert.snoozed_until) })}
        </p>
      )}

      <div role="group" aria-label={t("actionsFor", { name: task.title })} className="mt-3 flex flex-wrap items-center gap-2">
        <CanEdit>
          <Button size="sm" onClick={() => setCompleting(true)}>
            <Check />
            {t("markDone")}
          </Button>
          {alert &&
            (snoozed ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => act.mutate({ run: async () => unwrap(await snoozeMaintenanceTaskAction(task.id, 0)), done: ta("done.unsnoozed") })}
              >
                <BellRing />
                {ta("actions.unsnooze")}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => act.mutate({ run: async () => unwrap(await snoozeMaintenanceTaskAction(task.id, 7)), done: ta("done.snoozed") })}
              >
                <AlarmClockOff />
                {ta("actions.snooze")}
              </Button>
            ))}
        </CanEdit>
        <Button variant="ghost" size="sm" aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}>
          <History />
          {t("history")}
        </Button>
        <CanEdit>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t("menuFor", { name: task.title })} className="ml-auto">
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setEditing(true)}>
                <Pencil aria-hidden />
                {tc("edit")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setDeleting(true)} className="text-danger-foreground">
                <Trash2 aria-hidden />
                {tc("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CanEdit>
      </div>
      {showHistory && <TaskHistory taskId={task.id} />}

      <Dialog open={completing} onOpenChange={setCompleting}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              complete();
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("markDone")}</DialogTitle>
              <DialogDescription>{task.title}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              <Field label={t("doneOn")} htmlFor={`done-${task.id}`} hint={t("doneOnHint")}>
                <Input id={`done-${task.id}`} type="date" value={doneOn} onChange={(e) => setDoneOn(e.target.value)} aria-describedby={`done-${task.id}-hint`} />
              </Field>
              <Field label={t("doneNote")} htmlFor={`note-${task.id}`}>
                <Input id={`note-${task.id}`} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
              </Field>
            </div>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setCompleting(false)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={act.isPending}>
                {t("markDone")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("delete")}</DialogTitle>
            <DialogDescription>{t("deleteConfirm", { name: task.title })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleting(false)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                act.mutate(
                  { run: async () => unwrap(await deleteMaintenanceTaskAction(task.id)), done: t("deleted") },
                  { onSuccess: () => setDeleting(false) },
                )
              }
            >
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {editing && <TaskDialog open onOpenChange={setEditing} task={task} />}
    </li>
  );
}

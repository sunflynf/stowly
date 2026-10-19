"use server";

import { z } from "zod";
import { addDays, todayIn } from "@/lib/dates";
import { uuid } from "@/lib/validation/common";
import { completeTaskSchema, maintenanceTaskSchema } from "@/lib/validation/maintenance";
import { requireEditor } from "./auth-guard";
import { fail, mapDbError, ok, validationFail, type ActionResult } from "./result";

export async function createMaintenanceTaskAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsed = maintenanceTaskSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { data, error } = await auth.supabase.from("maintenance_tasks").insert(parsed.data).select("id").single();
  if (error) return fail(mapDbError(error));
  return ok({ id: data.id });
}

export async function updateMaintenanceTaskAction(id: unknown, input: unknown): Promise<ActionResult> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsedId = uuid.safeParse(id);
  if (!parsedId.success) return validationFail(parsedId.error);
  const parsed = maintenanceTaskSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { data, error } = await auth.supabase.from("maintenance_tasks").update(parsed.data).eq("id", parsedId.data).select("id");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  return ok();
}

export async function deleteMaintenanceTaskAction(id: unknown): Promise<ActionResult> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsedId = uuid.safeParse(id);
  if (!parsedId.success) return validationFail(parsedId.error);
  const { data, error } = await auth.supabase.from("maintenance_tasks").delete().eq("id", parsedId.data).select("id");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  return ok();
}

/** Marks a task done (today by default); returns the next due date. */
export async function completeMaintenanceTaskAction(input: unknown): Promise<ActionResult<{ nextDue: string }>> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsed = completeTaskSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { data, error } = await auth.supabase.rpc("complete_maintenance_task", {
    p_task_id: parsed.data.id,
    p_done_on: parsed.data.done_on ?? undefined,
    p_note: parsed.data.note ?? undefined,
  });
  if (error) return fail(mapDbError(error));
  return ok({ nextDue: data });
}

/** Snoozes a task's reminder for `days` days (0 = wake it up), like alert snoozes. */
export async function snoozeMaintenanceTaskAction(id: unknown, days: unknown): Promise<ActionResult> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsedId = uuid.safeParse(id);
  const parsedDays = z.number().int().min(0).max(365).safeParse(days);
  if (!parsedId.success) return validationFail(parsedId.error);
  if (!parsedDays.success) return validationFail(parsedDays.error);
  const { data: profile } = await auth.supabase.from("profiles").select("timezone").maybeSingle();
  const until = parsedDays.data === 0 ? null : addDays(todayIn(profile?.timezone ?? "Asia/Ho_Chi_Minh"), parsedDays.data);
  const { data, error } = await auth.supabase
    .from("maintenance_tasks")
    .update({ snoozed_until: until })
    .eq("id", parsedId.data)
    .select("id");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  return ok();
}

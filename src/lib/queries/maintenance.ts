"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { AlertKind } from "@/lib/types";
import type { IntervalUnit } from "@/lib/validation/maintenance";
import { qk } from "./keys";

export interface MaintenanceTask {
  id: string;
  title: string;
  notes: string | null;
  item_id: string | null;
  item_name: string | null;
  interval_count: number;
  interval_unit: IntervalUnit;
  start_date: string | null;
  last_done_on: string | null;
  next_due: string;
  snoozed_until: string | null;
}

/** The alert a task raises (from the maintenance_alerts view, the single source of truth). */
export interface MaintenanceAlert {
  task_id: string;
  title: string;
  item_id: string | null;
  item_name: string | null;
  interval_count: number;
  interval_unit: IntervalUnit;
  kind: AlertKind;
  severity: number;
  due_date: string;
  days_left: number;
  snoozed: boolean;
  snoozed_until: string | null;
}

/** Active tasks, soonest first; optionally only those of one item. */
export function useMaintenanceTasks(itemId?: string) {
  return useQuery({
    queryKey: itemId ? [...qk.maintenance, "item", itemId] : [...qk.maintenance, "tasks"],
    queryFn: async (): Promise<MaintenanceTask[]> => {
      let query = getSupabaseBrowser()
        .from("maintenance_tasks")
        .select("id, title, notes, item_id, interval_count, interval_unit, start_date, last_done_on, next_due, snoozed_until, item:items(name)")
        .is("archived_at", null)
        .order("next_due")
        .order("title");
      if (itemId) query = query.eq("item_id", itemId);
      const { data, error } = await query.limit(1000);
      if (error) throw error;
      return data.map(({ item, ...t }) => ({ ...t, item_name: item?.name ?? null }));
    },
  });
}

export function useMaintenanceAlerts() {
  return useQuery({
    queryKey: qk.maintenanceAlerts,
    queryFn: async (): Promise<MaintenanceAlert[]> => {
      const { data, error } = await getSupabaseBrowser().from("maintenance_alerts").select("*").order("due_date").limit(1000);
      if (error) throw error;
      return data.map((a) => ({
        task_id: a.task_id!,
        title: a.title!,
        item_id: a.item_id,
        item_name: a.item_name,
        interval_count: a.interval_count ?? 1,
        interval_unit: a.interval_unit ?? "month",
        kind: a.kind!,
        severity: a.severity ?? 2,
        due_date: a.due_date!,
        days_left: a.days_left ?? 0,
        snoozed: Boolean(a.snoozed),
        snoozed_until: a.snoozed_until,
      }));
    },
  });
}

/** When a task was done, newest first. */
export function useMaintenanceLog(taskId: string, enabled = true) {
  return useQuery({
    queryKey: qk.maintenanceLog(taskId),
    enabled,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser()
        .from("maintenance_log")
        .select("id, done_on, note, actor_id")
        .eq("task_id", taskId)
        .order("done_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });
}

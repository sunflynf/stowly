"use client";

import { useQuery } from "@tanstack/react-query";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { AlertKind } from "@/lib/types";
import { qk } from "./keys";

export interface GroupStats {
  id: string;
  name: string;
  unit: string | null;
  min_quantity: number | null;
  snoozed_until: string | null;
  total: number;
  members: number;
}

export interface GroupAlert extends GroupStats {
  kind: AlertKind;
  severity: number;
  threshold_key: string;
  snoozed: boolean;
}

const num = (v: number | string | null) => (v === null ? null : Number(v));

export function useGroups() {
  return useQuery({
    queryKey: qk.groups,
    queryFn: async (): Promise<GroupStats[]> => {
      const { data, error } = await getSupabaseBrowser().from("item_group_stats").select("*").order("name");
      if (error) throw error;
      return data.map((g) => ({
        id: g.id!,
        name: g.name!,
        unit: g.unit,
        min_quantity: num(g.min_quantity),
        snoozed_until: g.snoozed_until,
        total: Number(g.total ?? 0),
        members: g.members ?? 0,
      }));
    },
  });
}

export function useGroupAlerts() {
  return useQuery({
    queryKey: [...qk.alerts, "groups"],
    queryFn: async (): Promise<GroupAlert[]> => {
      const { data, error } = await getSupabaseBrowser().from("group_alerts").select("*");
      if (error) throw error;
      return data
        .map((g) => ({
          id: g.group_id!,
          name: g.name!,
          unit: g.unit,
          min_quantity: num(g.min_quantity),
          snoozed_until: g.snoozed_until,
          total: Number(g.total ?? 0),
          members: g.members ?? 0,
          kind: g.kind!,
          severity: g.severity ?? 2,
          threshold_key: g.threshold_key!,
          snoozed: Boolean(g.snoozed),
        }))
        .sort((a, b) => b.severity - a.severity || a.name.localeCompare(b.name));
    },
  });
}

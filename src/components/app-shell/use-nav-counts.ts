"use client";

import { useDashboardStats } from "@/lib/queries/stats";
import type { NavCount } from "./nav-config";

export function useNavCounts(): Partial<Record<NavCount, number>> {
  const { data } = useDashboardStats();
  if (!data) return {};
  return {
    items: data.total_items,
    attention: data.attention,
  };
}

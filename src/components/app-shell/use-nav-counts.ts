"use client";

import { useDashboardStats } from "@/lib/queries/stats";
import type { NavCount } from "./nav-config";

export function useNavCounts(): Partial<Record<NavCount, number>> {
  const { data } = useDashboardStats();
  if (!data) return {};
  return {
    items: data.total_items,
    expiring: data.expiring_30d + data.expired,
    lowStock: data.low_stock,
    attention: data.attention,
  };
}

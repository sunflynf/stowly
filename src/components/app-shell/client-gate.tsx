"use client";

import { useHydrated } from "@/lib/hooks/use-hydrated";

/**
 * The signed-in app reads all data on the client (TanStack Query + RLS), so its
 * content is rendered after mount. This avoids hydration mismatches when a
 * query resolves before a streamed boundary hydrates.
 */
export function ClientGate({ children, fallback }: { children: React.ReactNode; fallback: React.ReactNode }) {
  return useHydrated() ? children : fallback;
}

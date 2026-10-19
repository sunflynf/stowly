"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { adjustQuantityAction, patchItemAction } from "@/lib/actions/items";
import type { ActionResult } from "@/lib/actions/result";
import { qk } from "@/lib/queries/keys";

export class ActionFailure extends Error {
  constructor(public code: Extract<ActionResult, { ok: false }>["error"]) {
    super(code);
  }
}

/** Unwraps an action result or throws, so TanStack Query treats it as an error. */
export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.ok) throw new ActionFailure(result.error);
  return result.data;
}

export function useErrorToast() {
  const t = useTranslations("errors");
  return (error: unknown) => toast.error(t(error instanceof ActionFailure ? error.code : "unknown"));
}

/** Invalidates everything derived from items (lists, stats, alerts). */
export function useInvalidateItems() {
  const qc = useQueryClient();
  return (id?: string) =>
    Promise.all([
      qc.invalidateQueries({ queryKey: qk.items }),
      qc.invalidateQueries({ queryKey: qk.stats }),
      qc.invalidateQueries({ queryKey: qk.alerts }),
      qc.invalidateQueries({ queryKey: qk.categoryCounts }),
      qc.invalidateQueries({ queryKey: qk.shopping }),
      qc.invalidateQueries({ queryKey: qk.groups }),
      ...(id ? [qc.invalidateQueries({ queryKey: qk.item(id) })] : []),
    ]);
}

type QuantityCarrier = { id: string; quantity: number };

/** Patches `quantity` of item `id` wherever it appears in cached query data. */
function patchQuantity(data: unknown, id: string, delta: number): unknown {
  if (Array.isArray(data)) return data.map((d) => patchQuantity(d, id, delta));
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (obj.id === id && typeof obj.quantity === "number") {
      return { ...obj, quantity: Math.max(0, (obj as QuantityCarrier).quantity + delta) };
    }
    if ("rows" in obj && Array.isArray(obj.rows)) return { ...obj, rows: patchQuantity(obj.rows, id, delta) };
    // useInfiniteQuery data: { pages, pageParams }
    if ("pages" in obj && Array.isArray(obj.pages)) return { ...obj, pages: patchQuantity(obj.pages, id, delta) };
  }
  return data;
}

/** +/- with optimistic update across item lists and the detail view. */
export function useAdjustQuantity() {
  const qc = useQueryClient();
  const invalidate = useInvalidateItems();
  const onError = useErrorToast();
  return useMutation({
    mutationFn: async (vars: { id: string; delta: number; note?: string }) => unwrap(await adjustQuantityAction(vars)),
    onMutate: async ({ id, delta }) => {
      await Promise.all([qc.cancelQueries({ queryKey: qk.items }), qc.cancelQueries({ queryKey: qk.item(id) })]);
      const snapshot = [...qc.getQueriesData({ queryKey: qk.items }), ...qc.getQueriesData({ queryKey: qk.item(id) })];
      for (const [key, data] of snapshot) qc.setQueryData(key, patchQuantity(data, id, delta));
      return { snapshot };
    },
    onError: (error, _vars, context) => {
      context?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
      onError(error);
    },
    onSettled: (_data, _error, { id }) => {
      void invalidate(id);
      void qc.invalidateQueries({ queryKey: qk.itemEvents(id) });
    },
  });
}

export function usePatchItem() {
  const invalidate = useInvalidateItems();
  const onError = useErrorToast();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Parameters<typeof patchItemAction>[1] }) =>
      unwrap(await patchItemAction(id, patch)),
    onError,
    onSettled: (_d, _e, { id }) => invalidate(id),
  });
}

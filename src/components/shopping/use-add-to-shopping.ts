"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ActionFailure, unwrap, useErrorToast } from "@/components/items/use-item-mutations";
import { addToShoppingAction } from "@/lib/actions/shopping";
import { qk } from "@/lib/queries/keys";
import { suggestedBuyQuantity } from "@/lib/shopping";

export function useAddToShopping() {
  const t = useTranslations("item");
  const qc = useQueryClient();
  const onError = useErrorToast();
  return useMutation({
    mutationFn: async (item: { id: string; name: string; quantity: number; min_quantity: number | null; unit?: string | null }) =>
      unwrap(
        await addToShoppingAction({
          item_id: item.id,
          name: item.name,
          unit: item.unit ?? null,
          quantity: suggestedBuyQuantity(item.quantity, item.min_quantity),
        }),
      ),
    onSuccess: () => toast.success(t("addedToShopping")),
    onError: (error) =>
      error instanceof ActionFailure && error.code === "conflict" ? toast.info(t("alreadyInShopping")) : onError(error),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.shopping }),
  });
}

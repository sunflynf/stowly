"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CanEdit } from "@/components/app-shell/can-edit";
import { PageHeader } from "@/components/app-shell/page-header";
import { ItemThumb } from "@/components/items/item-thumb";
import { unwrap, useErrorToast, useInvalidateItems } from "@/components/items/use-item-mutations";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { deleteForeverAction, restoreItemAction } from "@/lib/actions/items";
import { useFormats } from "@/lib/hooks/use-format";
import { usePhotoUrls } from "@/lib/queries/items";
import { qk } from "@/lib/queries/keys";
import { useLabels } from "@/lib/queries/taxonomy";
import { getSupabaseBrowser } from "@/lib/supabase/client";

function useTrash() {
  return useQuery({
    queryKey: qk.trash,
    queryFn: async () => {
      const { data, error } = await getSupabaseBrowser().rpc("trash_items");
      if (error) throw error;
      return data;
    },
  });
}

/** Deleted items, kept for 30 days: restore them or remove them for good. */
export function TrashPage() {
  const t = useTranslations("trash");
  const tc = useTranslations("common");
  const f = useFormats();
  const labels = useLabels();
  const qc = useQueryClient();
  const invalidate = useInvalidateItems();
  const onError = useErrorToast();
  const { data: items, isPending } = useTrash();
  const { data: urls = {} } = usePhotoUrls((items ?? []).map((i) => i.thumb_path));
  const [forever, setForever] = useState<{ id: string; name: string } | null>(null);

  const act = useMutation({
    mutationFn: async ({ run }: { run: () => Promise<unknown>; done: string }) => run(),
    onSuccess: async (_d, { done }) => {
      toast.success(done);
      await Promise.all([qc.invalidateQueries({ queryKey: qk.trash }), invalidate()]);
    },
    onError,
  });

  return (
    <div>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      {isPending ? (
        <Skeleton className="h-40" />
      ) : !items?.length ? (
        <p className="rounded-md border border-border bg-card p-8 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-card p-3">
              <ItemThumb name={i.name} url={i.thumb_path ? urls[i.thumb_path] : undefined} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{i.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {t("deletedOn", { date: f.dateTime(i.deleted_at), name: i.deleted_by_name ?? "—" })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t("purgeOn", { date: f.date(i.purge_on) })}
                  {i.location_path ? ` · ${labels.path(i.location_path, i.location_path_en)}` : ""}
                </p>
              </div>
              <CanEdit>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={act.isPending}
                  onClick={() => act.mutate({ run: async () => unwrap(await restoreItemAction(i.id)), done: t("restored", { name: i.name }) })}
                >
                  <RotateCcw />
                  {t("restore")}
                </Button>
                <Button variant="ghost" size="icon" aria-label={t("deleteForeverNamed", { name: i.name })} onClick={() => setForever({ id: i.id, name: i.name })}>
                  <Trash2 />
                </Button>
              </CanEdit>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={forever !== null} onOpenChange={(o) => !o && setForever(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("deleteForever")}</DialogTitle>
            <DialogDescription>{t("deleteForeverConfirm", { name: forever?.name ?? "" })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setForever(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                forever &&
                act.mutate(
                  { run: async () => unwrap(await deleteForeverAction(forever.id)), done: t("deletedForever") },
                  { onSuccess: () => setForever(null) },
                )
              }
            >
              {t("deleteForever")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { ChevronRight, FolderPlus, MoreVertical, MoveRight, Pencil, Plus, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell/page-header";
import { unwrap, useErrorToast } from "@/components/items/use-item-mutations";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { createLocationAction, deleteLocationAction, updateLocationAction } from "@/lib/actions/locations";
import { qk } from "@/lib/queries/keys";
import {
  buildLocationTree,
  flattenTree,
  useLabels,
  useLocationCounts,
  useLocations,
  type LocationNode,
} from "@/lib/queries/taxonomy";
import { cn } from "@/lib/utils";

type DialogState =
  | { type: "create"; parent: LocationNode | null }
  | { type: "rename"; node: LocationNode }
  | { type: "move"; node: LocationNode }
  | { type: "delete"; node: LocationNode }
  | null;

function totalCount(node: LocationNode, counts: Map<string, number>): number {
  return (counts.get(node.id) ?? 0) + node.children.reduce((sum, c) => sum + totalCount(c, counts), 0);
}

export function LocationsManager() {
  const t = useTranslations("locations");
  const tc = useTranslations("common");
  const labels = useLabels();
  const qc = useQueryClient();
  const onError = useErrorToast();
  const { data: rows, isPending } = useLocations();
  const { data: counts = new Map<string, number>() } = useLocationCounts();
  const tree = useMemo(() => buildLocationTree(rows ?? []), [rows]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [name, setName] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [parentId, setParentId] = useState("");
  const [busy, setBusy] = useState(false);

  const open = (state: DialogState) => {
    setDialog(state);
    if (state?.type === "rename") {
      setName(state.node.name);
      setNameEn(state.node.name_en ?? "");
    } else {
      setName("");
      setNameEn("");
    }
    if (state?.type === "move") setParentId(state.node.parent_id ?? "");
  };

  const refresh = () =>
    Promise.all([qc.invalidateQueries({ queryKey: qk.locations }), qc.invalidateQueries({ queryKey: qk.items })]);

  const run = async (fn: () => Promise<unknown>, success?: string) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
      if (success) toast.success(success);
      setDialog(null);
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    if (!dialog) return;
    if (dialog.type === "create")
      void run(async () => unwrap(await createLocationAction({ name, parent_id: dialog.parent?.id ?? null })), t("created"));
    if (dialog.type === "rename")
      void run(async () => unwrap(await updateLocationAction(dialog.node.id, { name, name_en: nameEn })), tc("saved"));
    if (dialog.type === "move")
      void run(async () => unwrap(await updateLocationAction(dialog.node.id, { parent_id: parentId || null })), tc("saved"));
    if (dialog.type === "delete") void run(async () => unwrap(await deleteLocationAction(dialog.node.id)), tc("deleted"));
  };

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderNode = (node: LocationNode) => {
    const isCollapsed = collapsed.has(node.id);
    const label = labels.location(node);
    const count = totalCount(node, counts);
    return (
      <li key={node.id} role="treeitem" aria-expanded={node.children.length ? !isCollapsed : undefined} aria-selected={false}>
        <div
          className="flex min-h-14 items-center gap-1 border-b border-border pr-2"
          style={{ paddingLeft: `${node.depth * 1.5 + 0.25}rem` }}
        >
          {node.children.length ? (
            <button
              type="button"
              onClick={() => toggle(node.id)}
              aria-label={isCollapsed ? t("expand", { name: label }) : t("collapse", { name: label })}
              className="flex size-11 shrink-0 items-center justify-center rounded-md hover:bg-muted"
            >
              <ChevronRight className={cn("size-5 transition-transform", !isCollapsed && "rotate-90")} aria-hidden />
            </button>
          ) : (
            <span className="size-11 shrink-0" aria-hidden />
          )}
          <Link
            href={`/locations/${node.id}`}
            className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-1 hover:underline"
            aria-label={t("viewItems", { name: label })}
          >
            <span className={cn("truncate text-[15px]", node.depth === 0 && "font-semibold")}>{label}</span>
          </Link>
          <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{t("itemCount", { count })}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`${tc("more")}: ${label}`}>
                <MoreVertical />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => open({ type: "create", parent: node })}>
                <FolderPlus aria-hidden />
                {t("addChild")}
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/items/new?location=${node.id}`}>
                  <Plus aria-hidden />
                  {tc("add")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href={`/locations/labels?ids=${node.id}`}>
                  <QrCode aria-hidden />
                  {t("printLabel")}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => open({ type: "rename", node })}>
                <Pencil aria-hidden />
                {t("rename")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => open({ type: "move", node })}>
                <MoveRight aria-hidden />
                {t("move")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => open({ type: "delete", node })} className="text-danger-foreground">
                <Trash2 aria-hidden />
                {t("delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {node.children.length > 0 && !isCollapsed && <ul role="group">{node.children.map(renderNode)}</ul>}
      </li>
    );
  };

  // Valid new parents for "move": anything that is not the node itself or inside it.
  const moveTargets =
    dialog?.type === "move" ? flattenTree(tree).filter((n) => !n.path_ids.includes(dialog.node.id)) : [];

  const addRoom = (
    <>
      <Button variant="outline" asChild>
        <Link href="/locations/labels">
          <QrCode />
          {t("printLabels")}
        </Link>
      </Button>
      <Button onClick={() => open({ type: "create", parent: null })}>
        <Plus />
        {t("addRoom")}
      </Button>
    </>
  );

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={addRoom} />
      <div className="mb-3 flex flex-wrap gap-2 md:hidden">{addRoom}</div>
      <div className="overflow-hidden rounded-[var(--radius-lg)] border border-border bg-card">
        {isPending ? (
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : tree.length === 0 ? (
          <p className="p-6 text-center text-muted-foreground">{t("empty")}</p>
        ) : (
          <ul role="tree" aria-label={t("title")} className="-mb-px">
            {tree.map(renderNode)}
          </ul>
        )}
      </div>

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {dialog?.type === "create" && (dialog.parent ? t("addChild") : t("addRoom"))}
                {dialog?.type === "rename" && t("rename")}
                {dialog?.type === "move" && t("move")}
                {dialog?.type === "delete" && t("delete")}
              </DialogTitle>
              {dialog?.type === "create" && dialog.parent && (
                <p className="text-sm text-muted-foreground">{labels.locationPath(dialog.parent)} › …</p>
              )}
            </DialogHeader>
            {(dialog?.type === "create" || dialog?.type === "rename") && (
              <div className="flex flex-col gap-4">
                <Field label={t("name")} htmlFor="loc-name">
                  <Input id="loc-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
                </Field>
                {dialog.type === "rename" && (
                  <Field label={t("nameEn")} htmlFor="loc-name-en">
                    <Input id="loc-name-en" value={nameEn} onChange={(e) => setNameEn(e.target.value)} maxLength={80} />
                  </Field>
                )}
              </div>
            )}
            {dialog?.type === "move" && (
              <Field label={t("parent")} htmlFor="loc-parent">
                <NativeSelect id="loc-parent" value={parentId} onChange={(e) => setParentId(e.target.value)}>
                  <option value="">{t("root")}</option>
                  {moveTargets.map((n) => (
                    <option key={n.id} value={n.id}>
                      {labels.locationPath(n)}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            {dialog?.type === "delete" && <p>{t("deleteConfirm", { name: labels.location(dialog.node) })}</p>}
            <DialogFooter>
              <Button variant="secondary" onClick={() => setDialog(null)}>
                {tc("cancel")}
              </Button>
              <Button
                type="submit"
                variant={dialog?.type === "delete" ? "danger" : "primary"}
                disabled={busy || ((dialog?.type === "create" || dialog?.type === "rename") && !name.trim())}
              >
                {dialog?.type === "delete" ? tc("delete") : tc("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

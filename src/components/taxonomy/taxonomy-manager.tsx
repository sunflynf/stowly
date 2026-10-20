"use client";

import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app-shell/page-header";
import { unwrap, useErrorToast } from "@/components/items/use-item-mutations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  createCategoryAction,
  deleteCategoryAction,
  deleteTagAction,
  moveCategoryAction,
  renameTagAction,
  updateCategoryAction,
} from "@/lib/actions/taxonomy";
import { categoryIcon } from "@/lib/category-icons";
import { qk } from "@/lib/queries/keys";
import { useCategoryCounts } from "@/lib/queries/stats";
import { useCategories, useLabels, useTagCounts, useTags, type Category } from "@/lib/queries/taxonomy";
import type { TagRow } from "@/lib/types";
import { CategoryDialog, type CategoryDraft } from "./category-dialog";

type Confirm = { type: "category"; item: Category } | { type: "tag"; item: TagRow } | null;

export function TaxonomyManager() {
  const t = useTranslations("categoriesPage");
  const tc = useTranslations("common");
  const labels = useLabels();
  const qc = useQueryClient();
  const onError = useErrorToast();
  const { data: categories = [] } = useCategories();
  const { data: counts = [] } = useCategoryCounts();
  const { data: tags = [] } = useTags();
  const { data: tagCounts = new Map<string, number>() } = useTagCounts();
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const [renaming, setRenaming] = useState<TagRow | null>(null);
  const [tagName, setTagName] = useState("");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [busy, setBusy] = useState(false);

  const countFor = (id: string) => Number(counts.find((c) => c.category_id === id)?.item_count ?? 0);

  const run = async (fn: () => Promise<unknown>, done?: () => void) => {
    setBusy(true);
    try {
      await fn();
      await Promise.all([
        qc.invalidateQueries({ queryKey: qk.categories }),
        qc.invalidateQueries({ queryKey: qk.tags }),
        qc.invalidateQueries({ queryKey: qk.items }),
        qc.invalidateQueries({ queryKey: qk.categoryCounts }),
      ]);
      done?.();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  const saveCategory = (draft: CategoryDraft) =>
    run(
      async () => {
        if (editing === "new" || editing === null) unwrap(await createCategoryAction(draft));
        else unwrap(await updateCategoryAction(editing.id, draft));
      },
      () => {
        setEditing(null);
        toast.success(tc("saved"));
      },
    );

  return (
    <>
      <PageHeader
        title={t("title")}
        actions={
          <Button onClick={() => setEditing("new")}>
            <Plus />
            {t("addCategory")}
          </Button>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("categories")}</CardTitle>
            <Button variant="outline" size="sm" className="md:hidden" onClick={() => setEditing("new")}>
              <Plus />
              {t("addCategory")}
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col">
              {categories.map((c, i) => {
                const Icon = categoryIcon(c.icon);
                const name = labels.category(c);
                return (
                  <li key={c.id} className="flex min-h-14 items-center gap-3 border-b border-border py-1 last:border-0">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <Link href={`/items?categories=${c.id}`} className="min-w-0 flex-1 hover:underline">
                      <span className="block truncate font-medium">{name}</span>
                      <span className="text-sm text-muted-foreground">{t("itemCount", { count: countFor(c.id) })}</span>
                    </Link>
                    {c.builtin_key && <Badge tone="outline" className="hidden sm:inline-flex">{t("builtin")}</Badge>}
                    <div className="flex shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("moveUp", { name })}
                        disabled={i === 0 || busy}
                        onClick={() => void run(async () => unwrap(await moveCategoryAction(c.id, "up")))}
                        className="hidden sm:inline-flex"
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("moveDown", { name })}
                        disabled={i === categories.length - 1 || busy}
                        onClick={() => void run(async () => unwrap(await moveCategoryAction(c.id, "down")))}
                        className="hidden sm:inline-flex"
                      >
                        <ArrowDown />
                      </Button>
                      <Button variant="ghost" size="icon" aria-label={`${tc("edit")}: ${name}`} onClick={() => setEditing(c)}>
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${tc("delete")}: ${name}`}
                        onClick={() => setConfirm({ type: "category", item: c })}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("tags")}</CardTitle>
          </CardHeader>
          <CardContent>
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("noTags")}</p>
            ) : (
              <ul className="flex flex-col">
                {tags.map((tag) => (
                  <li key={tag.id} className="flex min-h-12 items-center gap-2 border-b border-border last:border-0">
                    <Link href={`/items?tags=${tag.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">
                      #{tag.name}
                    </Link>
                    <span className="text-sm text-muted-foreground">{t("tagUsage", { count: tagCounts.get(tag.id) ?? 0 })}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${t("renameTag")}: ${tag.name}`}
                      onClick={() => {
                        setRenaming(tag);
                        setTagName(tag.name);
                      }}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${tc("delete")}: #${tag.name}`}
                      onClick={() => setConfirm({ type: "tag", item: tag })}
                    >
                      <Trash2 />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {editing !== null && (
        <CategoryDialog
          key={editing === "new" ? "new" : editing.id}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          category={editing === "new" ? null : editing}
          busy={busy}
          onSubmit={(draft) => void saveCategory(draft)}
        />
      )}

      <Dialog open={renaming !== null} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (renaming)
                void run(async () => unwrap(await renameTagAction(renaming.id, tagName)), () => setRenaming(null));
            }}
          >
            <DialogHeader>
              <DialogTitle>{t("renameTag")}</DialogTitle>
            </DialogHeader>
            <Field label={t("tags")} htmlFor="tag-name">
              <Input id="tag-name" value={tagName} onChange={(e) => setTagName(e.target.value)} maxLength={40} autoFocus />
            </Field>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setRenaming(null)}>
                {tc("cancel")}
              </Button>
              <Button type="submit" disabled={busy || !tagName.trim()}>
                {tc("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tc("delete")}</DialogTitle>
          </DialogHeader>
          <p>
            {confirm?.type === "category" && t("deleteConfirm", { name: labels.category(confirm.item) })}
            {confirm?.type === "tag" && t("deleteTagConfirm", { name: confirm.item.name })}
          </p>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirm(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                if (!confirm) return;
                const id = confirm.item.id;
                void run(
                  async () => unwrap(confirm.type === "category" ? await deleteCategoryAction(id) : await deleteTagAction(id)),
                  () => setConfirm(null),
                );
              }}
            >
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Check, ChevronRight, MapPin, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createLocationAction } from "@/lib/actions/locations";
import { qk } from "@/lib/queries/keys";
import { buildLocationTree, flattenTree, useLabels, useLocations } from "@/lib/queries/taxonomy";
import { matchesText } from "@/lib/text";
import { cn } from "@/lib/utils";
import { useErrorToast, unwrap } from "./use-item-mutations";

interface Props {
  value: string | null;
  onChange: (id: string | null) => void;
  id?: string;
  className?: string;
  /** Label used for the trigger when nothing is selected. */
  placeholder?: string;
}

export function LocationPicker({ value, onChange, id, className, placeholder }: Props) {
  const t = useTranslations("locations");
  const tItem = useTranslations("item");
  const labels = useLabels();
  const { data: rows = [] } = useLocations();
  const qc = useQueryClient();
  const onError = useErrorToast();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const flat = useMemo(() => flattenTree(buildLocationTree(rows)), [rows]);
  const selected = rows.find((r) => r.id === value);
  const visible = flat.filter((n) => matchesText(`${n.path_text} ${n.path_text_en}`, query));

  const select = (next: string | null) => {
    onChange(next);
    setOpen(false);
    setQuery("");
  };

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const { id: newId } = unwrap(await createLocationAction({ name, parent_id: value }));
      await qc.invalidateQueries({ queryKey: qk.locations });
      setNewName("");
      select(newId);
    } catch (error) {
      onError(error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          id={id}
          type="button"
          className={cn(
            "flex min-h-12 w-full items-center gap-3 rounded-[var(--radius)] border border-input bg-card px-3.5 text-left text-[15px]",
            className,
          )}
        >
          <MapPin className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <span className={cn("flex-1 truncate", !selected && "text-muted-foreground")}>
            {selected ? labels.locationPath(selected) : (placeholder ?? tItem("pickLocation"))}
          </span>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </DialogTrigger>
      <DialogContent side="bottom" className="md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-full md:max-w-lg md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[var(--radius-lg)]">
        <DialogTitle className="mb-3">{t("pickerTitle")}</DialogTitle>
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("pickerSearch")}
            aria-label={t("pickerSearch")}
            className="pl-9"
          />
        </div>
        <ul className="-mx-1 max-h-[45dvh] overflow-y-auto" role="listbox" aria-label={t("pickerTitle")}>
          <li>
            <button
              type="button"
              role="option"
              aria-selected={value === null}
              onClick={() => select(null)}
              className="flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left text-muted-foreground hover:bg-muted"
            >
              <span className="flex-1">{t("noLocation")}</span>
              {value === null && <Check className="size-4 text-primary" aria-hidden />}
            </button>
          </li>
          {visible.map((node) => (
            <li key={node.id}>
              <button
                type="button"
                role="option"
                aria-selected={node.id === value}
                onClick={() => select(node.id)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2 rounded-md px-3 text-left hover:bg-muted",
                  node.id === value && "bg-accent text-accent-foreground",
                )}
                style={{ paddingLeft: query ? undefined : `${0.75 + node.depth * 1.25}rem` }}
              >
                <span className="flex-1">{query ? labels.locationPath(node) : labels.location(node)}</span>
                {node.id === value && <Check className="size-4 text-primary" aria-hidden />}
              </button>
            </li>
          ))}
          {visible.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">{t("none")}</li>}
        </ul>
        <div className="mt-3 flex gap-2 border-t border-border pt-3">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void create();
              }
            }}
            placeholder={selected ? `${labels.location(selected)} › …` : t("name")}
            aria-label={selected ? t("addChild") : t("add")}
            maxLength={80}
          />
          <Button variant="secondary" onClick={() => void create()} disabled={creating || !newName.trim()}>
            <Plus />
            {t("add")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

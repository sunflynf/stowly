"use client";

import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildLocationTree, flattenTree, useCategories, useLabels, useLocations, useTags } from "@/lib/queries/taxonomy";
import type { ItemSearchParams } from "@/lib/queries/search";
import { ALERT_KINDS, ITEM_CONDITIONS, type AlertKind } from "@/lib/types";
import { matchesText } from "@/lib/text";
import { cn } from "@/lib/utils";

interface Option {
  value: string;
  label: string;
  indent?: number;
}

function Chip({
  label,
  active,
  children,
  wide,
}: {
  label: string;
  active: boolean;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-[15px] font-medium whitespace-nowrap",
            active ? "border-primary bg-accent text-accent-foreground" : "border-input bg-card hover:bg-muted",
          )}
        >
          {label}
          <ChevronDown className="size-4" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className={cn("p-2", wide && "w-80")}>{children}</PopoverContent>
    </Popover>
  );
}

function CheckList({
  options,
  selected,
  onChange,
  searchable,
}: {
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
  searchable?: boolean;
}) {
  const tc = useTranslations("common");
  const [query, setQuery] = useState("");
  const visible = options.filter((o) => matchesText(o.label, query));
  return (
    <div className="flex flex-col">
      {searchable && options.length > 8 && (
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={tc("search")} aria-label={tc("search")} className="mb-2" />
      )}
      <ul className="max-h-72 overflow-y-auto">
        {visible.map((o) => {
          const id = `opt-${o.value}`;
          const checked = selected.includes(o.value);
          return (
            <li key={o.value}>
              <label
                htmlFor={id}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 hover:bg-muted"
                style={o.indent ? { paddingLeft: `${0.5 + o.indent * 1.1}rem` } : undefined}
              >
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={(c) => onChange(c ? [...selected, o.value] : selected.filter((s) => s !== o.value))}
                />
                <span className="text-[15px]">{o.label}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {selected.length > 0 && (
        <Button variant="ghost" size="sm" className="mt-1 self-start" onClick={() => onChange([])}>
          {tc("clear")}
        </Button>
      )}
    </div>
  );
}

export function FilterBar({
  params,
  onChange,
}: {
  params: ItemSearchParams;
  onChange: (patch: Partial<ItemSearchParams>) => void;
}) {
  const t = useTranslations("items.filters");
  const ts = useTranslations("items.states");
  const tc = useTranslations("conditions");
  const labels = useLabels();
  const { data: categories = [] } = useCategories();
  const { data: locations = [] } = useLocations();
  const { data: tags = [] } = useTags();
  const flat = useMemo(() => flattenTree(buildLocationTree(locations)), [locations]);

  const summarize = (label: string, values: string[]) =>
    values.length === 0
      ? t("selected", { label, value: t("all") })
      : values.length === 1
        ? t("selected", { label, value: values[0] })
        : t("selected", { label, value: t("multiple", { count: values.length }) });

  const categoryOptions = categories.map((c) => ({ value: c.id, label: labels.category(c) }));
  const tagOptions = tags.map((tag) => ({ value: tag.id, label: `#${tag.name}` }));
  const conditionOptions = ITEM_CONDITIONS.map((c) => ({ value: c, label: tc(c) }));
  const stateOptions = ALERT_KINDS.filter((k) => k !== "low_stock" && k !== "out_of_stock").map((k) => ({ value: k, label: ts(k) }));
  const location = locations.find((l) => l.id === params.location);
  const [priceMin, setPriceMin] = useState(params.priceMin?.toString() ?? "");
  const [priceMax, setPriceMax] = useState(params.priceMax?.toString() ?? "");

  const labelOf = (options: Option[], values: string[]) =>
    values.map((v) => options.find((o) => o.value === v)?.label ?? "").filter(Boolean);

  const hasFilters =
    params.categories.length > 0 ||
    params.location !== null ||
    params.conditions.length > 0 ||
    params.tags.length > 0 ||
    params.states.length > 0 ||
    params.priceMin !== null ||
    params.priceMax !== null ||
    params.archived;

  const nonStockStates = params.states.filter((s) => s !== "low_stock" && s !== "out_of_stock");

  return (
    <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
      <Chip label={summarize(t("category"), labelOf(categoryOptions, params.categories))} active={params.categories.length > 0}>
        <CheckList options={categoryOptions} selected={params.categories} onChange={(categories) => onChange({ categories })} />
      </Chip>

      <Chip label={t("selected", { label: t("location"), value: location ? labels.location(location) : t("all") })} active={!!location} wide>
        <ul className="max-h-80 overflow-y-auto">
          <li>
            <button
              type="button"
              onClick={() => onChange({ location: null })}
              className={cn("flex min-h-11 w-full items-center rounded-md px-2 text-left hover:bg-muted", !location && "font-semibold")}
            >
              {t("all")}
            </button>
          </li>
          {flat.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                aria-pressed={n.id === params.location}
                onClick={() => onChange({ location: n.id })}
                style={{ paddingLeft: `${0.5 + n.depth * 1.1}rem` }}
                className={cn(
                  "flex min-h-11 w-full items-center rounded-md px-2 text-left hover:bg-muted",
                  n.id === params.location && "bg-accent font-semibold text-accent-foreground",
                )}
              >
                {labels.location(n)}
              </button>
            </li>
          ))}
        </ul>
      </Chip>

      <Chip
        label={summarize(t("condition"), [...labelOf(conditionOptions, params.conditions), ...(params.archived ? [t("archived")] : [])])}
        active={params.conditions.length > 0 || params.archived}
      >
        <CheckList
          options={[...conditionOptions, { value: "__archived", label: t("archived") }]}
          selected={[...params.conditions, ...(params.archived ? ["__archived"] : [])]}
          onChange={(next) =>
            onChange({
              conditions: next.filter((v) => v !== "__archived") as ItemSearchParams["conditions"],
              archived: next.includes("__archived"),
            })
          }
        />
      </Chip>

      <Chip label={summarize(t("state"), labelOf(stateOptions, nonStockStates))} active={nonStockStates.length > 0}>
        <CheckList
          options={stateOptions}
          selected={nonStockStates}
          onChange={(next) =>
            onChange({ states: [...(next as AlertKind[]), ...params.states.filter((s) => s === "low_stock" || s === "out_of_stock")] })
          }
        />
      </Chip>

      <Chip label={summarize(t("tags"), labelOf(tagOptions, params.tags))} active={params.tags.length > 0}>
        <CheckList options={tagOptions} selected={params.tags} onChange={(tagIds) => onChange({ tags: tagIds })} searchable />
      </Chip>

      <Chip
        label={
          params.priceMin !== null || params.priceMax !== null
            ? t("selected", { label: t("price"), value: `${params.priceMin ?? 0}–${params.priceMax ?? "∞"}` })
            : t("price")
        }
        active={params.priceMin !== null || params.priceMax !== null}
      >
        <form
          className="flex flex-col gap-2 p-1"
          onSubmit={(e) => {
            e.preventDefault();
            const min = priceMin.trim() === "" ? null : Number(priceMin.replace(/\./g, ""));
            const max = priceMax.trim() === "" ? null : Number(priceMax.replace(/\./g, ""));
            onChange({
              priceMin: min !== null && Number.isFinite(min) ? min : null,
              priceMax: max !== null && Number.isFinite(max) ? max : null,
            });
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <Input inputMode="numeric" aria-label={t("priceMin")} placeholder={t("priceMin")} value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
            <Input inputMode="numeric" aria-label={t("priceMax")} placeholder={t("priceMax")} value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
          </div>
          <Button type="submit" size="sm">
            {t("filtersTitle")}
          </Button>
        </form>
      </Chip>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0"
          onClick={() => {
            setPriceMin("");
            setPriceMax("");
            onChange({ categories: [], location: null, conditions: [], tags: [], states: [], priceMin: null, priceMax: null, archived: false });
          }}
        >
          <X />
          {t("clearAll")}
        </Button>
      )}
    </div>
  );
}

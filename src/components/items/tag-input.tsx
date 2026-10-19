"use client";

import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { X } from "lucide-react";
import { useTags } from "@/lib/queries/taxonomy";
import { matchesText } from "@/lib/text";

interface Props {
  value: string[];
  onChange: (tags: string[]) => void;
  id?: string;
}

/** Free-text tags with suggestions from existing tags. */
export function TagInput({ value, onChange, id }: Props) {
  const t = useTranslations("item");
  const tc = useTranslations("common");
  const { data: allTags = [] } = useTags();
  const [draft, setDraft] = useState("");
  const listId = useId();

  const add = (raw: string) => {
    const name = raw.trim().replace(/^#/, "").slice(0, 40);
    if (!name) return;
    if (!value.some((v) => v.toLocaleLowerCase() === name.toLocaleLowerCase()) && value.length < 20) {
      onChange([...value, name]);
    }
    setDraft("");
  };

  const suggestions = draft
    ? allTags.filter((tag) => matchesText(tag.name, draft) && !value.includes(tag.name)).slice(0, 6)
    : [];

  return (
    <div>
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-[var(--radius)] border border-input bg-card px-2 py-1.5 focus-within:border-primary">
        {value.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-muted py-0.5 pr-0.5 pl-2 text-sm font-medium">
            #{tag}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== tag))}
              aria-label={`${tc("delete")} #${tag}`}
              className="flex size-7 items-center justify-center rounded hover:bg-border"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => add(draft)}
          placeholder={value.length ? "" : t("fields.tagsPlaceholder")}
          aria-describedby={suggestions.length ? listId : undefined}
          className="min-w-32 flex-1 bg-transparent px-1 py-1 text-[15px] outline-none placeholder:text-muted-foreground/80"
          maxLength={40}
          enterKeyHint="done"
        />
      </div>
      {suggestions.length > 0 && (
        <div id={listId} className="mt-1.5 flex flex-wrap gap-1.5">
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(tag.name)}
              className="min-h-9 rounded-md border border-border bg-card px-2.5 text-sm hover:bg-muted"
            >
              #{tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

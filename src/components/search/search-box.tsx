"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (value: string) => void;
  /** Debounce for typing, in ms. */
  delay?: number;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  /** Show the "/" keyboard hint and focus on "/" (desktop). */
  slashShortcut?: boolean;
  onSubmit?: (value: string) => void;
}

/** Large search input with debounced updates and a "/" shortcut. */
export function SearchBox({ value, onChange, delay = 200, placeholder, autoFocus, className, slashShortcut, onSubmit }: Props) {
  const t = useTranslations("items");
  const tc = useTranslations("common");
  const [draft, setDraft] = useState(value);
  const [synced, setSynced] = useState(value);
  const input = useRef<HTMLInputElement>(null);

  // Follow external changes (e.g. back/forward navigation) without an effect-driven reset.
  if (value !== synced) {
    setSynced(value);
    setDraft(value);
  }

  useEffect(() => {
    if (draft === value) return;
    const id = setTimeout(() => onChange(draft), delay);
    return () => clearTimeout(id);
  }, [draft, value, delay, onChange]);

  useEffect(() => {
    if (!slashShortcut) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "") && !target?.isContentEditable) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slashShortcut]);

  return (
    <form
      role="search"
      className={cn("relative", className)}
      onSubmit={(e) => {
        e.preventDefault();
        onChange(draft);
        onSubmit?.(draft);
      }}
    >
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <input
        ref={input}
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={placeholder ?? t("searchShort")}
        aria-label={t("searchLabel")}
        autoFocus={autoFocus}
        enterKeyHint="search"
        autoComplete="off"
        maxLength={200}
        className="h-[52px] w-full rounded-md border border-input bg-card pr-14 pl-12 text-base placeholder:text-muted-foreground/80 focus-visible:border-primary focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary/25 [&::-webkit-search-cancel-button]:hidden"
      />
      {draft ? (
        <button
          type="button"
          onClick={() => {
            setDraft("");
            onChange("");
            input.current?.focus();
          }}
          aria-label={tc("clearSearch")}
          className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
        >
          <X className="size-5" aria-hidden />
        </button>
      ) : (
        slashShortcut && (
          <kbd className="absolute top-1/2 right-4 hidden -translate-y-1/2 rounded-md border border-input px-1.5 text-xs text-muted-foreground md:block">
            /
          </kbd>
        )
      )}
    </form>
  );
}

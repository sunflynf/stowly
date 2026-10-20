"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { useErrorToast, unwrap } from "@/components/items/use-item-mutations";
import { setThemeAction } from "@/lib/actions/preferences";
import { qk } from "@/lib/queries/keys";
import { THEME_PREFERENCES, THEME_TOKENS, type Theme, type ThemePreference } from "@/lib/themes";
import { cn } from "@/lib/utils";

/** A miniature of the theme: page, card, primary button and highlight. */
function Swatch({ theme }: { theme: Theme }) {
  const t = THEME_TOKENS[theme];
  return (
    <span className="flex h-full w-full flex-col gap-1 p-2" style={{ background: t.background }} aria-hidden>
      <span className="flex flex-1 flex-col justify-between rounded-md p-1.5" style={{ background: t.card, border: `1px solid ${t.border}` }}>
        <span className="h-1.5 w-2/3 rounded-full" style={{ background: t.foreground }} />
        <span className="flex gap-1">
          <span className="h-3 flex-1 rounded" style={{ background: t.primary }} />
          <span className="h-3 w-3 rounded" style={{ background: t.accent }} />
        </span>
      </span>
    </span>
  );
}

/** Appearance: pick a colour theme (saved per person, applied at once). */
export function ThemePicker({ value }: { value: ThemePreference }) {
  const t = useTranslations("settingsPage.appearance");
  const router = useRouter();
  const qc = useQueryClient();
  const onError = useErrorToast();
  const [selected, setSelected] = useState<ThemePreference>(value);
  const [, startTransition] = useTransition();

  const choose = (theme: ThemePreference) => {
    const previous = selected;
    setSelected(theme);
    // Apply immediately; the server re-renders the status-bar colour on refresh.
    document.documentElement.setAttribute("data-theme", theme);
    startTransition(async () => {
      try {
        unwrap(await setThemeAction(theme));
        await qc.invalidateQueries({ queryKey: qk.profile });
        router.refresh();
      } catch (e) {
        setSelected(previous);
        document.documentElement.setAttribute("data-theme", previous);
        onError(e);
      }
    });
  };

  return (
    <div role="radiogroup" aria-label={t("title")} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {THEME_PREFERENCES.map((theme) => {
        const checked = selected === theme;
        return (
          <button
            key={theme}
            type="button"
            role="radio"
            aria-checked={checked}
            onClick={() => choose(theme)}
            className={cn(
              "flex flex-col overflow-hidden rounded-[var(--radius)] border-2 bg-card text-left",
              checked ? "border-primary" : "border-border hover:border-input",
            )}
          >
            <span className="relative flex h-20">
              {theme === "auto" ? (
                <>
                  <span className="w-1/2 overflow-hidden">
                    <Swatch theme="teal" />
                  </span>
                  <span className="w-1/2 overflow-hidden">
                    <Swatch theme="dark" />
                  </span>
                </>
              ) : (
                <Swatch theme={theme} />
              )}
              {checked && (
                <span className="absolute top-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="size-4" aria-hidden />
                </span>
              )}
            </span>
            <span className="px-3 py-2">
              <span className="block font-semibold">{t(`themes.${theme}`)}</span>
              <span className="block text-sm text-muted-foreground">{t(`hints.${theme}`)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

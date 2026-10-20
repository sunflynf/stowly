"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { defaultFont, fontFamilyVar, fonts, isFont, type AppFont } from "@/i18n/fonts";
import { setFontAction } from "@/lib/actions/preferences";
import { cn } from "@/lib/utils";

function currentFont(): AppFont {
  const value = typeof document === "undefined" ? undefined : document.documentElement.dataset.font;
  return isFont(value) ? value : defaultFont;
}

/** Radio list of UI fonts, each previewed in its own typeface with Vietnamese text. */
export function FontPicker() {
  const t = useTranslations("settingsPage.font");
  const router = useRouter();
  const [selected, setSelected] = useState<AppFont>(currentFont);
  const [pending, startTransition] = useTransition();

  // Apply immediately; the cookie keeps it for server renders.
  useEffect(() => {
    document.documentElement.dataset.font = selected;
  }, [selected]);

  const change = (next: AppFont) => {
    if (next === selected) return;
    setSelected(next);
    startTransition(async () => {
      await setFontAction(next);
      router.refresh();
    });
  };

  return (
    <div role="radiogroup" aria-label={t("title")} className="grid gap-2 sm:grid-cols-2">
      {fonts.map((f) => (
        <button
          key={f}
          type="button"
          role="radio"
          aria-checked={f === selected}
          disabled={pending}
          onClick={() => change(f)}
          className={cn(
            "flex min-h-16 items-start gap-3 rounded-md border px-3.5 py-2.5 text-left transition-colors",
            f === selected ? "border-primary bg-accent text-accent-foreground" : "border-input bg-card hover:bg-muted",
          )}
        >
          <span className="min-w-0 flex-1" style={{ fontFamily: fontFamilyVar[f] }}>
            <span className="block text-[15px] font-semibold">{t(`names.${f}`)}</span>
            <span className="block truncate text-sm text-muted-foreground">{t("sample")}</span>
          </span>
          {f === selected && <Check className="mt-0.5 size-5 shrink-0" aria-hidden />}
        </button>
      ))}
    </div>
  );
}

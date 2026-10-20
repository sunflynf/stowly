"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Languages } from "lucide-react";
import { locales, type Locale } from "@/i18n/config";
import { setLocaleAction } from "@/lib/actions/preferences";
import { cn } from "@/lib/utils";

/** Segmented vi/en switch. */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const change = (next: Locale) => {
    if (next === locale) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  };

  return (
    <div role="group" aria-label={t("language")} className={cn("inline-flex items-center gap-1", className)}>
      <Languages className="mr-1 size-4 text-muted-foreground" aria-hidden />
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          disabled={pending}
          aria-pressed={l === locale}
          onClick={() => change(l)}
          className={cn(
            "min-h-11 rounded-md px-3 text-sm font-semibold transition-colors",
            l === locale ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
          )}
        >
          {t(`languages.${l}`)}
        </button>
      ))}
    </div>
  );
}

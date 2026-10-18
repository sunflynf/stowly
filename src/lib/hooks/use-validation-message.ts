"use client";

import { useTranslations } from "next-intl";
import type { Messages } from "@/lib/messages-type";

type ValidationKey = keyof Messages["validation"];

/** Zod messages are message keys under "validation"; translate them for display. */
export function useValidationMessage() {
  const t = useTranslations("validation");
  return (key: string | undefined) => {
    if (!key) return undefined;
    return t.has(key as ValidationKey) ? t(key as ValidationKey) : t("invalid");
  };
}

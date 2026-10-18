"use server";

import { z } from "zod";
import { locales } from "@/i18n/config";
import { setPreferenceCookies } from "@/lib/preferences";
import { getSupabaseServer } from "@/lib/supabase/server";
import { fail, ok, validationFail, type ActionResult } from "./result";

const localeSchema = z.enum(locales);

/** Changes the UI language. Works before login (cookie only) and after (also saved to the profile). */
export async function setLocaleAction(input: unknown): Promise<ActionResult> {
  const parsed = localeSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  await setPreferenceCookies({ locale: parsed.data });
  const supabase = await getSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) {
    const { error } = await supabase.from("profiles").update({ locale: parsed.data }).eq("id", data.claims.sub);
    if (error) return fail("unknown");
  }
  return ok();
}

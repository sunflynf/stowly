import "server-only";
import { cookies } from "next/headers";
import { FONT_COOKIE, isFont, type AppFont } from "@/i18n/fonts";
import { isLocale, isTimeZone, LOCALE_COOKIE, TIMEZONE_COOKIE, type Locale } from "@/i18n/config";
import type { getSupabaseServer } from "@/lib/supabase/server";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setPreferenceCookies(prefs: { locale?: Locale; timezone?: string; font?: AppFont }) {
  const store = await cookies();
  if (prefs.locale && isLocale(prefs.locale)) {
    store.set(LOCALE_COOKIE, prefs.locale, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  }
  if (prefs.timezone && isTimeZone(prefs.timezone)) {
    store.set(TIMEZONE_COOKIE, prefs.timezone, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  }
  if (prefs.font && isFont(prefs.font)) {
    store.set(FONT_COOKIE, prefs.font, { path: "/", maxAge: ONE_YEAR, sameSite: "lax" });
  }
}

/** After login, copy locale/timezone from the profile into cookies. */
export async function syncPreferenceCookies(supabase: Awaited<ReturnType<typeof getSupabaseServer>>) {
  const { data } = await supabase.from("profiles").select("locale, timezone").maybeSingle();
  if (data) {
    await setPreferenceCookies({ locale: isLocale(data.locale) ? data.locale : undefined, timezone: data.timezone });
  }
}

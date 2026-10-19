import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { defaultLocale, defaultTimeZone, isLocale, isTimeZone, LOCALE_COOKIE, TIMEZONE_COOKIE } from "./config";
import { formats } from "./formats";

// No locale in the URL: the locale comes from a cookie that mirrors the
// user's profile setting (synced on login and when changed in Settings).
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieLocale = store.get(LOCALE_COOKIE)?.value;
  const cookieTz = store.get(TIMEZONE_COOKIE)?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return {
    locale,
    timeZone: isTimeZone(cookieTz) ? cookieTz : defaultTimeZone,
    formats,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});

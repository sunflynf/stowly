"use client";

import { useFormatter } from "next-intl";
import { isoToDate } from "@/lib/dates";

/** Locale-aware formatters: dd/MM/yyyy and "85.000 ₫" in Vietnamese, own conventions in English. */
export function useFormats() {
  const format = useFormatter();
  return {
    /** Calendar date ("yyyy-MM-dd") — formatted in UTC so it never shifts a day. */
    date: (iso: string | null | undefined) =>
      iso ? format.dateTime(isoToDate(iso), { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }) : "",
    dateTime: (ts: string) => format.dateTime(new Date(ts), "dateTime"),
    currency: (n: number, currency = "VND") =>
      format.number(n, { style: "currency", currency, maximumFractionDigits: currency === "VND" ? 0 : 2 }),
    quantity: (n: number | null | undefined) => format.number(Number(n ?? 0), "quantity"),
    integer: (n: number) => format.number(n, "integer"),
  };
}

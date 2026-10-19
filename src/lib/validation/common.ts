import { z } from "zod";

export const uuid = z.uuid("invalid");

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date")
  .refine((v) => !Number.isNaN(Date.parse(v)), "date");

const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

/** Optional date as "yyyy-MM-dd"; empty string becomes null. */
export const optionalDate = z.preprocess(emptyToNull, isoDate.nullable());

/** Optional trimmed text; empty becomes null. */
export const optionalText = (max: number) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? null : v.trim()) : emptyToNull(v)),
    z.string().max(max, "tooLong").nullable(),
  );

const toNumber = (v: unknown) => {
  if (v === "" || v === null || v === undefined) return null;
  if (typeof v === "string") {
    // Accept both "1.5" and Vietnamese "1,5"; drop thousand separators like "85.000" only when unambiguous.
    const s = v.trim().replace(/\s/g, "");
    const normalized = /^\d{1,3}(\.\d{3})+$/.test(s) ? s.replace(/\./g, "") : s.replace(",", ".");
    return normalized === "" ? null : Number(normalized);
  }
  return v;
};

export const optionalNumber = (min = 0, max = 1e9) =>
  z.preprocess(toNumber, z.number("number").finite("number").min(min, "min").max(max, "invalid").nullable());

export const requiredNumber = (min = 0, max = 1e9) =>
  z.preprocess(toNumber, z.number("number").finite("number").min(min, "min").max(max, "invalid"));

export const optionalInt = (min: number, max: number) =>
  z.preprocess(toNumber, z.number("number").int("number").min(min, "min").max(max, "invalid").nullable());

export const requiredName = (max: number) => z.string().trim().min(1, "required").max(max, "tooLong");

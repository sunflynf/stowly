import { z } from "zod";
import { ITEM_CONDITIONS, type ItemCondition } from "@/lib/types";
import { normalizeText } from "@/lib/text";
import type { ImportField } from "./columns";

/** One row ready to send to the server (strings normalised, not yet validated against the DB). */
export type ImportRow = Partial<Record<Exclude<ImportField, "tags" | "archived">, string>> & {
  tags?: string[];
  archived?: boolean;
};

const CONDITION_ALIASES: Record<string, ItemCondition> = {
  new: "new", moi: "new",
  good: "good", tot: "good", ok: "good",
  worn: "worn", cu: "worn", used: "worn",
  broken: "broken", hong: "broken",
  given_away: "given_away", "given away": "given_away", "da cho di": "given_away", "cho di": "given_away",
};

const TRUE_WORDS = new Set(["yes", "y", "true", "1", "x", "co", "da luu tru", "archived"]);

/** Accepts yyyy-mm-dd, dd/mm/yyyy, d/m/yy, dd-mm-yyyy and dd.mm.yyyy (day first, as in Vietnam). */
export function normalizeDate(value: string): string | null {
  const v = value.trim();
  if (!v) return "";
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(v);
  let y: number, mo: number, d: number;
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else {
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(v);
    if (!m) return null;
    [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
    if (y < 100) y += 2000;
  }
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function normalizeCondition(value: string): ItemCondition | null {
  const v = normalizeText(value);
  if (!v) return "good";
  return CONDITION_ALIASES[v] ?? ((ITEM_CONDITIONS as readonly string[]).includes(v) ? (v as ItemCondition) : null);
}

export function splitTags(value: string): string[] {
  return value
    .split(/[;,|]/)
    .map((t) => t.trim().replace(/^#/, ""))
    .filter(Boolean)
    .slice(0, 20);
}

const DATE_FIELDS = ["purchase_date", "expiry_date", "opened_date", "warranty_until", "last_replaced_at"] as const;

export type RowProblem = { field: ImportField; code: "required" | "date" | "condition" | "attributes" };

/** Turns one CSV record into an ImportRow using the column mapping, collecting problems. */
export function buildRow(record: string[], mapping: (ImportField | null)[]): { row: ImportRow; problems: RowProblem[] } {
  const row: ImportRow = {};
  const problems: RowProblem[] = [];
  mapping.forEach((field, i) => {
    if (!field) return;
    const raw = (record[i] ?? "").trim().replace(/^'(?=[=+\-@])/, ""); // undo export's formula guard
    switch (field) {
      case "tags":
        row.tags = splitTags(raw);
        break;
      case "archived":
        row.archived = TRUE_WORDS.has(normalizeText(raw));
        break;
      case "condition": {
        const c = normalizeCondition(raw);
        if (c) row.condition = c;
        else problems.push({ field, code: "condition" });
        break;
      }
      case "attributes":
        if (raw) {
          try {
            const parsed: unknown = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
            row.attributes = raw;
          } catch {
            problems.push({ field, code: "attributes" });
          }
        }
        break;
      default:
        if ((DATE_FIELDS as readonly string[]).includes(field)) {
          const d = normalizeDate(raw);
          if (d === null) problems.push({ field, code: "date" });
          else row[field] = d;
        } else row[field] = raw;
    }
  });
  if (!row.name?.trim()) problems.push({ field: "name", code: "required" });
  return { row, problems };
}

export const DUPLICATE_MODES = ["update", "skip", "create"] as const;
export type DuplicateMode = (typeof DUPLICATE_MODES)[number];

export const importRowSchema = z.object({
  name: z.string().optional(),
  category: z.string().max(80).optional(),
  location: z.string().max(400).optional(),
  quantity: z.string().max(30).optional(),
  unit: z.string().max(40).optional(),
  min_quantity: z.string().max(30).optional(),
  condition: z.string().max(20).optional(),
  purchase_date: z.string().max(20).optional(),
  purchase_price: z.string().max(30).optional(),
  purchase_place: z.string().max(400).optional(),
  expiry_date: z.string().max(20).optional(),
  opened_date: z.string().max(20).optional(),
  warranty_until: z.string().max(20).optional(),
  replace_after_months: z.string().max(10).optional(),
  last_replaced_at: z.string().max(20).optional(),
  tags: z.array(z.string().max(60)).max(20).optional(),
  notes: z.string().max(10000).optional(),
  barcode: z.string().max(80).optional(),
  group: z.string().max(80).optional(),
  attributes: z.string().max(5000).optional(),
  archived: z.boolean().optional(),
  id: z.string().max(40).optional(),
});

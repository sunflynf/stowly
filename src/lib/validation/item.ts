import { z } from "zod";
import { ITEM_CONDITIONS } from "@/lib/types";
import { optionalDate, optionalInt, optionalNumber, optionalText, requiredName, requiredNumber, uuid } from "./common";

export const tagNameSchema = z.string().trim().min(1, "required").max(40, "tooLong");

export const itemInputSchema = z.object({
  name: requiredName(200),
  category_id: z.preprocess((v) => (v === "" ? null : v), uuid.nullable()),
  location_id: z.preprocess((v) => (v === "" ? null : v), uuid.nullable()),
  quantity: requiredNumber(0, 1_000_000),
  unit: optionalText(20),
  min_quantity: optionalNumber(0, 1_000_000),
  condition: z.enum(ITEM_CONDITIONS),
  purchase_date: optionalDate,
  purchase_price: optionalNumber(0, 1e12),
  purchase_place: optionalText(200),
  expiry_date: optionalDate,
  opened_date: optionalDate,
  warranty_until: optionalDate,
  replace_after_months: optionalInt(1, 600),
  last_replaced_at: optionalDate,
  notes: optionalText(5000),
  barcode: z.preprocess(
    (v) => (typeof v === "string" ? v.trim().replace(/\s+/g, "") || null : (v ?? null)),
    z.string().regex(/^[0-9A-Za-z-]{4,64}$/, "invalid").nullable(),
  ),
  attributes: z
    .record(z.string().regex(/^[a-z0-9_]{1,40}$/), z.string().max(500, "tooLong"))
    .transform((attrs) => Object.fromEntries(Object.entries(attrs).filter(([, v]) => v.trim() !== "").map(([k, v]) => [k, v.trim()])))
    .refine((attrs) => Object.keys(attrs).length <= 30, "invalid"),
  tags: z
    .array(tagNameSchema)
    .max(20, "invalid")
    .transform((tags) => {
      const seen = new Set<string>();
      return tags.filter((t) => {
        const key = t.toLocaleLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }),
});

export type ItemInput = z.output<typeof itemInputSchema>;

/** Raw form state: numbers and dates are edited as strings. */
export interface ItemFormValues {
  name: string;
  category_id: string;
  location_id: string;
  quantity: string;
  unit: string;
  min_quantity: string;
  condition: (typeof ITEM_CONDITIONS)[number];
  purchase_date: string;
  purchase_price: string;
  purchase_place: string;
  expiry_date: string;
  opened_date: string;
  warranty_until: string;
  replace_after_months: string;
  last_replaced_at: string;
  notes: string;
  barcode: string;
  attributes: Record<string, string>;
  tags: string[];
}

export const emptyItemForm: ItemFormValues = {
  name: "",
  category_id: "",
  location_id: "",
  quantity: "1",
  unit: "",
  min_quantity: "",
  condition: "good",
  purchase_date: "",
  purchase_price: "",
  purchase_place: "",
  expiry_date: "",
  opened_date: "",
  warranty_until: "",
  replace_after_months: "",
  last_replaced_at: "",
  notes: "",
  barcode: "",
  attributes: {},
  tags: [],
};

export const adjustQuantitySchema = z.object({
  id: uuid,
  delta: z.number().finite().refine((d) => d !== 0 && Math.abs(d) <= 100_000, "invalid"),
  note: optionalText(500).optional(),
});

export const photoInputSchema = z.object({
  itemId: uuid,
  storagePath: z.string().max(300),
  thumbPath: z.string().max(300),
});

/** Category attribute definitions stored in categories.default_attributes. */
export const attributeDefSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]{1,40}$/),
  type: z.enum(["text", "select", "date", "number"]),
  label_vi: z.string().min(1).max(60),
  label_en: z.string().min(1).max(60),
  options: z
    .array(z.object({ value: z.string().min(1).max(40), label_vi: z.string().max(60), label_en: z.string().max(60) }))
    .optional(),
});
export const attributeDefsSchema = z.array(attributeDefSchema).max(30);
export type AttributeDef = z.infer<typeof attributeDefSchema>;

import { normalizeText } from "@/lib/text";

/** Columns the importer understands (same names as the CSV export). */
export const IMPORT_FIELDS = [
  "name",
  "category",
  "location",
  "quantity",
  "unit",
  "min_quantity",
  "condition",
  "purchase_date",
  "purchase_price",
  "purchase_place",
  "expiry_date",
  "opened_date",
  "warranty_until",
  "replace_after_months",
  "last_replaced_at",
  "tags",
  "notes",
  "barcode",
  "group",
  "attributes",
  "archived",
  "id",
] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];

// Header aliases (compared accent-insensitively), English and Vietnamese.
const ALIASES: Record<ImportField, string[]> = {
  name: ["name", "item", "item name", "ten", "ten mon do", "ten do", "mon do", "san pham"],
  category: ["category", "danh muc", "loai", "phan loai"],
  location: ["location", "place", "vi tri", "noi de", "cho de", "duong dan vi tri"],
  quantity: ["quantity", "qty", "so luong", "sl"],
  unit: ["unit", "don vi", "dvt"],
  min_quantity: ["min_quantity", "min quantity", "threshold", "nguong", "nguong canh bao", "bao khi con", "ton toi thieu"],
  condition: ["condition", "status", "tinh trang"],
  purchase_date: ["purchase_date", "purchase date", "bought", "ngay mua"],
  purchase_price: ["purchase_price", "purchase price", "price", "gia", "gia mua"],
  purchase_place: ["purchase_place", "purchase place", "store", "shop", "noi mua", "cua hang"],
  expiry_date: ["expiry_date", "expiry date", "expiry", "expires", "best before", "han su dung", "hsd", "han dung"],
  opened_date: ["opened_date", "opened date", "opened", "ngay mo"],
  warranty_until: ["warranty_until", "warranty until", "warranty", "bao hanh", "bao hanh den", "han bao hanh"],
  replace_after_months: ["replace_after_months", "replace after months", "replace after", "thay sau", "thay sau thang"],
  last_replaced_at: ["last_replaced_at", "last replaced", "lan thay gan nhat", "ngay thay"],
  tags: ["tags", "tag", "the", "nhan"],
  notes: ["notes", "note", "description", "ghi chu", "mo ta"],
  barcode: ["barcode", "ean", "upc", "ma vach"],
  group: ["group", "nhom", "nhom do"],
  attributes: ["attributes", "thuoc tinh", "thong tin them"],
  archived: ["archived", "luu tru", "da luu tru"],
  id: ["id", "item id", "ma"],
};

const lookup = new Map<string, ImportField>();
for (const field of IMPORT_FIELDS) for (const alias of ALIASES[field]) lookup.set(normalizeText(alias).replace(/[_-]+/g, " "), field);

export function fieldForHeader(header: string): ImportField | null {
  return lookup.get(normalizeText(header).replace(/[_-]+/g, " ").replace(/[():]/g, "").trim()) ?? null;
}

/** Maps each header to a field; a field is used at most once (first match wins). */
export function autoMap(headers: string[]): (ImportField | null)[] {
  const used = new Set<ImportField>();
  return headers.map((h) => {
    const field = fieldForHeader(h);
    if (!field || used.has(field)) return null;
    used.add(field);
    return field;
  });
}

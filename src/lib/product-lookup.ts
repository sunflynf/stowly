/** Product data from Open Food Facts / Open Products Facts, reduced to what quick add needs. */
export interface ProductInfo {
  code: string;
  name: string;
  brand: string | null;
  quantity: string | null;
  /** Built-in category key that best matches the product, if any. */
  category: "food" | "household" | "electronics" | "stationery" | "books" | null;
  imageUrl: string | null;
}

interface OffProduct {
  product_name?: string;
  product_name_vi?: string;
  product_name_en?: string;
  generic_name?: string;
  brands?: string;
  quantity?: string;
  categories_tags?: string[];
  image_front_small_url?: string;
}

const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

function guessCategory(source: "food" | "products", tags: string[]): ProductInfo["category"] {
  const t = tags.join(" ");
  if (/books?|livres?/.test(t)) return "books";
  if (/electronics?|batter(y|ies)|cables?|chargers?/.test(t)) return "electronics";
  if (/stationery|office-supplies|pens?/.test(t)) return "stationery";
  if (/cleaning|household|detergents?|hygiene|cosmetics|toothpaste|shampoos?/.test(t)) return "household";
  return source === "food" ? "food" : null;
}

/** Parses an Open Food Facts style API v2 response; null when the product is unknown. */
export function parseProduct(json: unknown, source: "food" | "products", locale: "vi" | "en"): ProductInfo | null {
  if (!json || typeof json !== "object") return null;
  const body = json as { status?: number; code?: string; product?: OffProduct };
  if (body.status !== 1 || !body.product) return null;
  const p = body.product;
  const localized = locale === "vi" ? str(p.product_name_vi) : str(p.product_name_en);
  const name = localized ?? str(p.product_name) ?? str(p.generic_name);
  if (!name) return null;
  const brand = str(p.brands)?.split(",")[0]?.trim() ?? null;
  return {
    code: String(body.code ?? ""),
    name: name.slice(0, 200),
    brand,
    quantity: str(p.quantity),
    category: guessCategory(source, p.categories_tags ?? []),
    imageUrl: str(p.image_front_small_url),
  };
}

/** Suggested item name: "Brand Name 500 g", without repeating the brand. */
export function suggestedName(p: ProductInfo): string {
  const parts = [p.name];
  if (p.brand && !p.name.toLowerCase().includes(p.brand.toLowerCase())) parts.unshift(p.brand);
  if (p.quantity && !p.name.includes(p.quantity)) parts.push(p.quantity);
  return parts.join(" ").slice(0, 200);
}

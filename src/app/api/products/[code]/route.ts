import { NextResponse, type NextRequest } from "next/server";
import { getLocale } from "next-intl/server";
import { requireUser } from "@/lib/actions/auth-guard";
import { parseProduct, type ProductInfo } from "@/lib/product-lookup";
import { normalizeBarcode } from "@/lib/scan";

export const dynamic = "force-dynamic";

// Open Food Facts covers food and drinks; Open Products Facts covers other goods.
// Both are free, keyless and ask for an identifying User-Agent.
const SOURCES = [
  { source: "food", base: process.env.PRODUCT_LOOKUP_FOOD_URL ?? "https://world.openfoodfacts.org" },
  { source: "products", base: process.env.PRODUCT_LOOKUP_PRODUCTS_URL ?? "https://world.openproductsfacts.org" },
] as const;
const FIELDS = "product_name,product_name_vi,product_name_en,generic_name,brands,quantity,categories_tags,image_front_small_url";

/** Looks up a barcode in public product databases. Signed-in users only (not an open proxy). */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/products/[code]">) {
  const auth = await requireUser();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { code: raw } = await ctx.params;
  const code = normalizeBarcode(raw);
  if (!code || !/^\d{6,14}$/.test(code)) return NextResponse.json({ product: null });

  const locale = (await getLocale()) === "en" ? "en" : "vi";
  for (const { source, base } of SOURCES) {
    try {
      const response = await fetch(`${base}/api/v2/product/${code}.json?fields=${FIELDS}`, {
        headers: { "User-Agent": "Stowly/1.0 (personal inventory; https://github.com/sunflynf/stowly)" },
        signal: AbortSignal.timeout(4000),
        next: { revalidate: 60 * 60 * 24 * 7 },
      });
      if (!response.ok) continue;
      const product: ProductInfo | null = parseProduct(await response.json(), source, locale);
      if (product) return NextResponse.json({ product });
    } catch {
      // Timeout or network error: try the next source, then give up quietly.
    }
  }
  return NextResponse.json({ product: null });
}

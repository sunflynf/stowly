import { describe, expect, it } from "vitest";
import { parseProduct, suggestedName } from "@/lib/product-lookup";
import { normalizeBarcode, resolveScan } from "@/lib/scan";

const ID = "3f1c2a9e-1b2c-4d5e-8f90-123456789abc";

describe("resolveScan", () => {
  it("opens location labels on any host", () => {
    expect(resolveScan(`https://stowly.app/l/${ID}`, "http://localhost:3000")).toEqual({ type: "location", id: ID });
    expect(resolveScan(`http://localhost:3000/locations/${ID.toUpperCase()}`, "http://localhost:3000")).toEqual({ type: "location", id: ID });
  });
  it("opens item links and same-origin paths", () => {
    expect(resolveScan(`https://x.dev/items/${ID}`, "https://stowly.app")).toEqual({ type: "item", id: ID });
    expect(resolveScan("https://stowly.app/shopping", "https://stowly.app")).toEqual({ type: "path", path: "/shopping" });
  });
  it("treats everything else as a product code", () => {
    expect(resolveScan(" 8934563138164 ", "https://stowly.app")).toEqual({ type: "code", code: "8934563138164" });
    expect(resolveScan("https://evil.example/phish", "https://stowly.app")).toEqual({ type: "code", code: "https://evil.example/phish" });
  });
  it("normalises barcodes", () => {
    expect(normalizeBarcode(" 8934 5631 38164 ")).toBe("8934563138164");
    expect(normalizeBarcode("https://x")).toBeNull();
  });
});

describe("parseProduct", () => {
  const response = {
    status: 1,
    code: "8934563138164",
    product: {
      product_name: "Instant noodles",
      product_name_vi: "Mì Hảo Hảo tôm chua cay",
      brands: "Acecook,Hảo Hảo",
      quantity: "75 g",
      categories_tags: ["en:plant-based-foods", "en:noodles"],
    },
  };
  it("prefers the localised name and guesses a category", () => {
    const p = parseProduct(response, "food", "vi");
    expect(p).toMatchObject({ name: "Mì Hảo Hảo tôm chua cay", brand: "Acecook", quantity: "75 g", category: "food" });
    expect(suggestedName(p!)).toBe("Acecook Mì Hảo Hảo tôm chua cay 75 g");
    expect(parseProduct(response, "food", "en")?.name).toBe("Instant noodles");
  });
  it("returns null for unknown products", () => {
    expect(parseProduct({ status: 0, status_verbose: "product not found" }, "food", "vi")).toBeNull();
    expect(parseProduct(null, "food", "vi")).toBeNull();
  });
  it("maps non-food categories", () => {
    const p = parseProduct({ status: 1, code: "1", product: { product_name: "AA batteries", categories_tags: ["en:batteries"] } }, "products", "en");
    expect(p?.category).toBe("electronics");
  });
});

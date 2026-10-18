import { describe, expect, it } from "vitest";
import { emptyItemForm, itemInputSchema } from "@/lib/validation/item";

const parse = (patch: Partial<typeof emptyItemForm>) => itemInputSchema.safeParse({ ...emptyItemForm, name: "Pin AA", ...patch });

describe("itemInputSchema", () => {
  it("accepts a minimal quick-add payload and nulls empty optionals", () => {
    const r = parse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data).toMatchObject({ name: "Pin AA", quantity: 1, min_quantity: null, category_id: null, expiry_date: null, tags: [] });
    }
  });

  it("parses Vietnamese number formats", () => {
    const r = parse({ purchase_price: "85.000", quantity: "1,5" });
    expect(r.success && r.data.purchase_price).toBe(85000);
    expect(r.success && r.data.quantity).toBe(1.5);
  });

  it("rejects missing name, negative quantity and bad dates", () => {
    expect(parse({ name: "  " }).success).toBe(false);
    expect(parse({ quantity: "-1" }).success).toBe(false);
    expect(parse({ expiry_date: "2026-13-45" }).success).toBe(false);
    expect(parse({ category_id: "not-a-uuid" }).success).toBe(false);
  });

  it("dedupes tags case-insensitively and drops empty attributes", () => {
    const r = parse({ tags: ["Sạc", "sạc", "USB"], attributes: { brand: "Anker", model: " " } });
    expect(r.success && r.data.tags).toEqual(["Sạc", "USB"]);
    expect(r.success && r.data.attributes).toEqual({ brand: "Anker" });
  });
});

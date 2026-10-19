import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUser, type Client } from "./helpers";

let a: { id: string; client: Client };
let b: { id: string; client: Client };
const ids: Record<string, string> = {};
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  const { data: loc } = await a.client.from("locations").select("id").eq("builtin_key", "desk").single();
  const { data: cat } = await a.client.from("categories").select("id").eq("builtin_key", "electronics").single();
  const { data, error } = await a.client
    .from("items")
    .insert([
      { name: "Laptop", purchase_price: 20_000_000, purchase_date: daysAgo(40), category_id: cat!.id, location_id: loc!.id },
      { name: "Chuột", purchase_price: 500_000, purchase_date: daysAgo(10), category_id: cat!.id, location_id: loc!.id },
      { name: "Bàn phím cũ", purchase_price: 1_000_000, purchase_date: daysAgo(500), condition: "worn" },
      { name: "Cáp HDMI", location_id: loc!.id },
      { name: "cáp hdmi", location_id: loc!.id },
      { name: "Máy ảnh", purchase_date: daysAgo(20) },
    ], { defaultToNull: false })
    .select("id, name");
  if (error) throw error;
  data.forEach((d) => (ids[d.name] = d.id));
  // Backdate history: the old keyboard and the laptop have not been touched for 2 years.
  const admin = adminClient();
  const old = new Date(Date.now() - 730 * 86_400_000).toISOString();
  await admin.from("item_events").update({ created_at: old }).in("item_id", [ids["Bàn phím cũ"], ids["Laptop"]]);
});

afterAll(async () => {
  await deleteTestUser(a.id);
  await deleteTestUser(b.id);
});

describe("spending_stats", () => {
  it("sums purchases in range by month, category and room, with the top list", async () => {
    const { data, error } = await a.client.rpc("spending_stats", { p_from: daysAgo(60), p_to: daysAgo(0) });
    expect(error).toBeNull();
    const s = data as {
      total: number; count: number; unpriced: number; by_month: { total: number }[];
      by_category: { total: number }[]; by_room: { total: number }[]; top: { name: string }[]; currency: string;
    };
    expect(Number(s.total)).toBe(20_500_000);
    expect(s.count).toBe(2);
    expect(s.unpriced).toBe(1); // "Máy ảnh" bought in range without a price
    expect(s.currency).toBe("VND");
    expect(s.by_month.reduce((sum, m) => sum + Number(m.total), 0)).toBe(20_500_000);
    expect(Number(s.by_category[0].total)).toBe(20_500_000);
    expect(Number(s.by_room[0].total)).toBe(20_500_000);
    expect(s.top.map((t) => t.name)).toEqual(["Laptop", "Chuột"]);
  });

  it("is private", async () => {
    const { data } = await b.client.rpc("spending_stats", { p_from: daysAgo(60), p_to: daysAgo(0) });
    expect(Number((data as { total: number }).total)).toBe(0);
  });
});

describe("unused_suggestions", () => {
  const reasons = async (client: Client) => {
    const { data, error } = await client.rpc("unused_suggestions");
    if (error) throw error;
    // The two HDMI rows were inserted together; which one is "older" is a tie-break.
    return data.map((r) => `${r.reason === "duplicate" ? r.name.toLowerCase() : r.name}:${r.reason}`).sort();
  };

  it("finds idle, worn and duplicate items", async () => {
    expect(await reasons(a.client)).toEqual(["Bàn phím cũ:idle", "Bàn phím cũ:worn", "Laptop:idle", "cáp hdmi:duplicate"]);
  });

  it("respects keep / snooze and is private", async () => {
    await a.client.from("suggestion_dismissals").insert({ item_id: ids["Laptop"], reason: "idle", until: daysAgo(-30) });
    await a.client.from("suggestion_dismissals").insert({ item_id: ids["Bàn phím cũ"], reason: "worn", until: null });
    expect(await reasons(a.client)).toEqual(["Bàn phím cũ:idle", "cáp hdmi:duplicate"]);
    expect(await reasons(b.client)).toEqual([]);
  });

  it("counts a quantity change as use", async () => {
    await a.client.rpc("adjust_item_quantity", { p_item_id: ids["Bàn phím cũ"], p_delta: 1 });
    expect(await reasons(a.client)).toEqual(["cáp hdmi:duplicate"]);
  });
});

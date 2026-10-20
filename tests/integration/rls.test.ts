import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { anonClient, createTestUser, deleteTestUser, type TestUser } from "./helpers";

let a: TestUser;
let b: TestUser;
let itemId: string;
let categoryId: string;
let locationId: string;

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  const { data: cat } = await a.client.from("categories").select("id").eq("builtin_key", "electronics").single();
  const { data: loc } = await a.client.from("locations").select("id").eq("builtin_key", "desk").single();
  categoryId = cat!.id;
  locationId = loc!.id;
  const { data, error } = await a.client
    .from("items")
    .insert({ name: "Dây sạc USB-C", category_id: categoryId, location_id: locationId, quantity: 2, min_quantity: 3 })
    .select("id")
    .single();
  if (error) throw error;
  itemId = data.id;
});

afterAll(async () => {
  await deleteTestUser(a.id);
  await deleteTestUser(b.id);
});

describe("signup defaults", () => {
  it("seeds a profile, built-in categories and default locations", async () => {
    const { data: profile } = await b.client.from("profiles").select("locale, timezone, expiry_lead_days").single();
    expect(profile).toEqual({ locale: "vi", timezone: "Asia/Ho_Chi_Minh", expiry_lead_days: [30, 7, 1] });
    const { count: cats } = await b.client.from("categories").select("*", { count: "exact", head: true });
    expect(cats).toBe(7);
    const { data: wardrobe } = await b.client.from("locations").select("path_text, path_text_en").eq("builtin_key", "wardrobe").single();
    expect(wardrobe).toEqual({ path_text: "Phòng ngủ › Tủ quần áo", path_text_en: "Bedroom › Wardrobe" });
  });
});

describe("row level security", () => {
  it("owner can read their item", async () => {
    const { data } = await a.client.from("items").select("id").eq("id", itemId);
    expect(data).toHaveLength(1);
  });

  it("another user cannot read, update or delete it", async () => {
    const { data: read } = await b.client.from("items").select("id").eq("id", itemId);
    expect(read).toHaveLength(0);

    const { data: updated } = await b.client.from("items").update({ name: "hacked" }).eq("id", itemId).select("id");
    expect(updated).toHaveLength(0);

    const { data: deleted } = await b.client.from("items").delete().eq("id", itemId).select("id");
    expect(deleted).toHaveLength(0);

    const { data: still } = await a.client.from("items").select("name").eq("id", itemId).single();
    expect(still?.name).toBe("Dây sạc USB-C");
  });

  it("another user cannot insert rows owned by someone else", async () => {
    const { error } = await b.client.from("items").insert({ name: "spoof", household_id: a.householdId });
    expect(error).not.toBeNull();
  });

  it("another user cannot reference someone else's category or location", async () => {
    const { error: catError } = await b.client.from("items").insert({ name: "x", category_id: categoryId });
    expect(catError).not.toBeNull();
    const { error: locError } = await b.client.from("items").insert({ name: "x", location_id: locationId });
    expect(locError).not.toBeNull();
  });

  it("another user cannot adjust quantity, see history, alerts or search results", async () => {
    const { error } = await b.client.rpc("adjust_item_quantity", { p_item_id: itemId, p_delta: 5 });
    expect(error).not.toBeNull();
    const { data: events } = await b.client.from("item_events").select("id").eq("item_id", itemId);
    expect(events).toHaveLength(0);
    const { data: alerts } = await b.client.from("item_alerts").select("item_id");
    expect(alerts).toHaveLength(0);
    const { data: results } = await b.client.rpc("search_items", { p_query: "sac" });
    expect(results).toHaveLength(0);
  });

  it("profiles are private", async () => {
    const { data } = await b.client.from("profiles").select("id").eq("id", a.id);
    expect(data).toHaveLength(0);
  });

  it("users cannot write the notification log", async () => {
    const { error } = await a.client
      .from("notifications_log")
      .insert({ user_id: a.id, household_id: a.householdId, item_id: itemId, kind: "low_stock", threshold_key: "low", channel: "email" });
    expect(error).not.toBeNull();
  });

  it("anonymous visitors see nothing", async () => {
    const anon = anonClient();
    const { data } = await anon.from("items").select("id");
    expect(data ?? []).toHaveLength(0);
    const { data: cats } = await anon.from("categories").select("id");
    expect(cats ?? []).toHaveLength(0);
  });

  it("photos in storage are only readable by their owner", async () => {
    const path = `${a.householdId}/${itemId}/test.webp`;
    const bytes = new Uint8Array([82, 73, 70, 70]);
    const { error: upErr } = await a.client.storage.from("item-photos").upload(path, bytes, { contentType: "image/webp" });
    expect(upErr).toBeNull();
    const { error: bReadErr } = await b.client.storage.from("item-photos").download(path);
    expect(bReadErr).not.toBeNull();
    const { error: bUpErr } = await b.client.storage
      .from("item-photos")
      .upload(`${a.householdId}/${itemId}/evil.webp`, bytes, { contentType: "image/webp" });
    expect(bUpErr).not.toBeNull();
    await a.client.storage.from("item-photos").remove([path]);
  });
});

describe("quantity stepper", () => {
  it("adjusts atomically, never below zero, and logs history", async () => {
    const { data: q1 } = await a.client.rpc("adjust_item_quantity", { p_item_id: itemId, p_delta: 1, p_note: "mua thêm" });
    expect(Number(q1)).toBe(3);
    const { data: q2 } = await a.client.rpc("adjust_item_quantity", { p_item_id: itemId, p_delta: -10 });
    expect(Number(q2)).toBe(0);
    const { data: events } = await a.client
      .from("item_events")
      .select("type, delta, quantity_after, note")
      .eq("item_id", itemId)
      .order("created_at");
    expect(events?.map((e) => [e.type, Number(e.delta), Number(e.quantity_after)])).toEqual([
      ["created", 2, 2],
      ["quantity_change", 1, 3],
      ["quantity_change", -3, 0],
    ]);
    expect(events?.[1]?.note).toBe("mua thêm");
  });
});

describe("search", () => {
  it("is accent-insensitive, prefix and typo tolerant", async () => {
    await a.client.from("items").insert([
      { name: "Áo khoác mùa đông" },
      { name: "Cáp Lightning" },
      { name: "Sách Nhà giả kim" },
    ]);
    const names = async (q: string) => {
      const { data, error } = await a.client.rpc("search_items", { p_query: q });
      if (error) throw error;
      return data.map((r) => r.name);
    };
    expect(await names("ao khoac")).toContain("Áo khoác mùa đông");
    expect(await names("ÁO KHOÁC")).toContain("Áo khoác mùa đông");
    expect(await names("khoa")).toContain("Áo khoác mùa đông");
    expect(await names("lightnig")).toContain("Cáp Lightning");
    // typed accents rank the exact match first ("sạc" before "Sách", which also prefix-matches)
    expect((await names("sạc"))[0]).toBe("Dây sạc USB-C");
    // location path is searchable
    expect(await names("ban lam viec")).toContain("Dây sạc USB-C");
  });
});

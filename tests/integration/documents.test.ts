import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { createTestUser, deleteTestUser, type TestUser } from "./helpers";

let a: TestUser;
let b: TestUser;
let itemId: string;
const BUCKET = "item-documents";
const pdf = new Uint8Array([37, 80, 68, 70, 45, 49, 46, 52, 10]); // "%PDF-1.4\n"

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  const { data } = await a.client.from("items").insert({ name: "Tủ lạnh Panasonic", purchase_price: 12_000_000 }).select("id").single();
  itemId = data!.id;
});

afterAll(async () => {
  await deleteTestUser(a.id);
  await deleteTestUser(b.id);
});

describe("document storage", () => {
  it("accepts PDFs and images in the household folder, rejects other types and other folders", async () => {
    const path = `${a.householdId}/${itemId}/${randomUUID()}.pdf`;
    expect((await a.client.storage.from(BUCKET).upload(path, pdf, { contentType: "application/pdf" })).error).toBeNull();
    const text = await a.client.storage
      .from(BUCKET)
      .upload(`${a.householdId}/${itemId}/${randomUUID()}.txt`, new Uint8Array([104, 105]), { contentType: "text/plain" });
    expect(text.error).not.toBeNull();
    const elsewhere = await a.client.storage
      .from(BUCKET)
      .upload(`${b.householdId}/${itemId}/${randomUUID()}.pdf`, pdf, { contentType: "application/pdf" });
    expect(elsewhere.error).not.toBeNull();
    expect((await b.client.storage.from(BUCKET).download(path)).error).not.toBeNull();
    expect((await a.client.storage.from(BUCKET).download(path)).error).toBeNull();
    await a.client.storage.from(BUCKET).remove([path]);
  });

  it("rejects files over 10 MB", async () => {
    const big = new Uint8Array(10 * 1024 * 1024 + 1);
    const { error } = await a.client.storage
      .from(BUCKET)
      .upload(`${a.householdId}/${itemId}/${randomUUID()}.pdf`, big, { contentType: "application/pdf" });
    expect(error).not.toBeNull();
  });
});

describe("document rows", () => {
  const row = (over: Record<string, unknown> = {}) => ({
    item_id: itemId,
    kind: "warranty" as const,
    title: "phieu-bao-hanh.pdf",
    storage_path: `${a.householdId}/${itemId}/${randomUUID()}.pdf`,
    mime_type: "application/pdf",
    size_bytes: 1234,
    ...over,
  });

  it("must point into the item's folder, with an allowed type and size", async () => {
    expect((await a.client.from("item_documents").insert(row())).error).toBeNull();
    expect((await a.client.from("item_documents").insert(row({ storage_path: `${a.householdId}/other/${randomUUID()}.pdf` }))).error).not.toBeNull();
    expect((await a.client.from("item_documents").insert(row({ mime_type: "text/plain" }))).error).not.toBeNull();
    expect((await a.client.from("item_documents").insert(row({ size_bytes: 10 * 1024 * 1024 + 1 }))).error).not.toBeNull();
  });

  it("are limited to 20 per item", async () => {
    const { data: item } = await a.client.from("items").insert({ name: "Many docs" }).select("id").single();
    const rows = Array.from({ length: 20 }, () =>
      row({ item_id: item!.id, storage_path: `${a.householdId}/${item!.id}/${randomUUID()}.pdf` }),
    );
    expect((await a.client.from("item_documents").insert(rows)).error).toBeNull();
    const extra = await a.client
      .from("item_documents")
      .insert(row({ item_id: item!.id, storage_path: `${a.householdId}/${item!.id}/${randomUUID()}.pdf` }));
    expect(extra.error?.message).toContain("document_limit_reached");
  });

  it("are deleted with the item and invisible to other households", async () => {
    const { data: item } = await a.client.from("items").insert({ name: "Temp" }).select("id").single();
    const { data: doc } = await a.client
      .from("item_documents")
      .insert(row({ item_id: item!.id, storage_path: `${a.householdId}/${item!.id}/${randomUUID()}.pdf` }))
      .select("id")
      .single();
    expect((await b.client.from("item_documents").select("id").eq("id", doc!.id)).data).toHaveLength(0);
    await a.client.from("items").delete().eq("id", item!.id);
    expect((await a.client.from("item_documents").select("id").eq("id", doc!.id)).data).toHaveLength(0);
  });
});

describe("insurance report", () => {
  it("lists priced items by value with filters, totals and unpriced count", async () => {
    const { data: cats } = await a.client.from("categories").select("id, builtin_key");
    const { data: locs } = await a.client.from("locations").select("id, builtin_key");
    const cat = (k: string) => cats!.find((c) => c.builtin_key === k)!.id;
    const loc = (k: string) => locs!.find((l) => l.builtin_key === k)!.id;
    await a.client.from("items").insert([
      { name: "Laptop", purchase_price: 25_000_000, purchase_date: "2026-01-10", category_id: cat("electronics"), location_id: loc("desk"), attributes: { brand: "Dell", model: "XPS 13", serial: "SN-123" } },
      { name: "TV", purchase_price: 15_000_000, category_id: cat("electronics"), location_id: loc("tv_cabinet") },
      { name: "Áo khoác", purchase_price: 800_000, category_id: cat("clothing"), location_id: loc("wardrobe") },
      { name: "Sạc dự phòng", category_id: cat("electronics"), location_id: loc("desk") },
      { name: "Old", purchase_price: 9_000_000, archived_at: new Date().toISOString() },
    ], { defaultToNull: false });

    type Report = { total: number; count: number; unpriced: number; rows: { name: string; serial: string | null; model: string | null; brand: string | null }[] };
    const report = async (args: { p_min_value?: number; p_category_ids?: string[]; p_location_id?: string }) =>
      (await a.client.rpc("insurance_report", args)).data as Report;

    const all = await report({ p_min_value: 1_000_000 });
    expect(all.rows.map((r) => r.name)).toEqual(["Laptop", "TV", "Tủ lạnh Panasonic"]);
    expect(all.total).toBe(52_000_000);
    expect(all.rows[0]).toMatchObject({ brand: "Dell", model: "XPS 13", serial: "SN-123" });

    const electronics = await report({ p_category_ids: [cat("electronics")] });
    expect(electronics.rows.map((r) => r.name)).toEqual(["Laptop", "TV"]);
    expect(electronics.unpriced).toBe(1);

    // A room includes the places inside it (TV cabinet is in the living room).
    const living = await report({ p_location_id: loc("living_room") });
    expect(living.rows.map((r) => r.name)).toEqual(["TV"]);

    expect((await b.client.rpc("insurance_report", {})).data).toMatchObject({ count: 0, total: 0 });
  });
});

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runAlertDigest } from "@/lib/alerts/digest";
import { adminClient, createTestUser, deleteTestUser, type TestUser } from "./helpers";

let a: TestUser;
const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

beforeAll(async () => {
  a = await createTestUser();
});
afterAll(async () => {
  await deleteTestUser(a.id);
});

/** An item with `quantity` left and backdated decreases (days ago, amount). */
async function itemWithUse(name: string, quantity: number, uses: [number, number][], extra: Record<string, unknown> = {}) {
  const { data, error } = await a.client.from("items").insert({ name, quantity, ...extra }).select("id").single();
  if (error) throw error;
  const admin = adminClient();
  // The item was added before it was used (as the demo seed backdates history).
  const oldest = Math.max(...uses.map(([days]) => days), 0) + 5;
  await admin.from("item_events").update({ created_at: ago(oldest) }).eq("item_id", data.id).eq("type", "created");
  for (const [days, amount] of uses) {
    const { error: e } = await admin.from("item_events").insert({
      household_id: a.householdId,
      item_id: data.id,
      type: "quantity_change",
      delta: -amount,
      quantity_after: quantity,
      created_at: ago(days),
    });
    if (e) throw e;
  }
  return data.id;
}

async function usageOf(id: string) {
  const { data } = await a.client.from("items").select("usage_per_day, usage_last_at").eq("id", id).single();
  return data!;
}

describe("usage rate", () => {
  it("is learned from at least 3 decreases spread over a week or more", async () => {
    // Used 1 on days -30, -20 and -10: 2 units over 20 days after the first.
    const soap = await itemWithUse("Nước rửa chén", 1, [[30, 1], [20, 1], [10, 1]]);
    const u = await usageOf(soap);
    expect(Number(u.usage_per_day)).toBeCloseTo(0.1, 3);
    expect(u.usage_last_at).toBe(ago(10).slice(0, 10));

    const two = await itemWithUse("Two uses", 5, [[20, 1], [10, 1]]);
    expect((await usageOf(two)).usage_per_day).toBeNull();
    const quick = await itemWithUse("Same week", 5, [[3, 1], [2, 1], [1, 1]]);
    expect((await usageOf(quick)).usage_per_day).toBeNull();
  });

  it("raises running_out when the estimate is within 7 days, not otherwise", async () => {
    // 1 left at 0.1/day, last change 5 days ago: empty in ~5 days.
    const soon = await itemWithUse("Kem đánh răng", 1, [[35, 1], [25, 1], [15, 1], [5, 1]]);
    // 10 left at the same rate: ~95 days.
    const plenty = await itemWithUse("Giấy vệ sinh", 10, [[35, 1], [25, 1], [15, 1], [5, 1]]);
    // At its threshold: low_stock covers it, no extra running_out.
    const low = await itemWithUse("Pin AA", 1, [[35, 1], [25, 1], [15, 1], [5, 1]], { min_quantity: 2 });

    const { data } = await a.client.from("item_alerts").select("item_id, kind, days_left").in("item_id", [soon, plenty, low]);
    const kinds = (id: string) => data!.filter((r) => r.item_id === id).map((r) => r.kind);
    expect(kinds(soon)).toEqual(["running_out"]);
    expect(kinds(plenty)).toEqual([]);
    expect(kinds(low)).toEqual(["low_stock"]);
    const row = data!.find((r) => r.item_id === soon)!;
    expect(row.days_left).toBeGreaterThanOrEqual(0);
    expect(row.days_left).toBeLessThanOrEqual(7);

    const [digest] = await runAlertDigest({ force: true, dryRun: true, userId: a.id });
    expect(digest.preview?.push).toContain("Kem đánh răng (running_out)");
  });

  it("follows the stepper: using some updates the rate and the last-known date", async () => {
    const id = await itemWithUse("Cà phê", 3, [[30, 1], [20, 1], [10, 1]]);
    const { error } = await a.client.rpc("adjust_item_quantity", { p_item_id: id, p_delta: -1 });
    expect(error).toBeNull();
    const u = await usageOf(id);
    expect(u.usage_last_at).toBe(new Date().toISOString().slice(0, 10));
    // 3 units after the first decrease, over 30 days.
    expect(Number(u.usage_per_day)).toBeCloseTo(0.1, 2);
  });
});

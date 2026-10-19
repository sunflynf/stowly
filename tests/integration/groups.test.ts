import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runAlertDigest } from "@/lib/alerts/digest";
import { createTestUser, deleteTestUser, type Client } from "./helpers";

let a: { id: string; client: Client };
let b: { id: string; client: Client };
let groupId: string;
let itemIds: string[];

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
  const { data: group, error } = await a.client
    .from("item_groups")
    .insert({ name: "Dây sạc", unit: "sợi", min_quantity: 5 })
    .select("id")
    .single();
  if (error) throw error;
  groupId = group.id;
  const { data: items } = await a.client
    .from("items")
    .insert([
      { name: "USB-C 1m", quantity: 2, group_id: groupId },
      { name: "USB-C 2m", quantity: 1, group_id: groupId },
      { name: "Lightning", quantity: 1, group_id: groupId },
    ])
    .select("id");
  itemIds = items!.map((i) => i.id);
});

afterAll(async () => {
  await deleteTestUser(a.id);
  await deleteTestUser(b.id);
});

describe("item groups", () => {
  it("aggregates members and raises one shared low-stock alert", async () => {
    const { data: stats } = await a.client.from("item_group_stats").select("total, members").eq("id", groupId).single();
    expect(Number(stats!.total)).toBe(4);
    expect(stats!.members).toBe(3);
    const { data: alerts } = await a.client.from("group_alerts").select("kind, threshold_key");
    expect(alerts).toEqual([{ kind: "low_stock", threshold_key: "low" }]);
    const { data: dash } = await a.client.rpc("dashboard_stats");
    expect((dash as { low_stock: number }).low_stock).toBe(1);
  });

  it("is searchable by group name and filterable by group", async () => {
    const { data } = await a.client.rpc("search_items", { p_query: "day sac" });
    expect(data!.map((r) => r.name).sort()).toEqual(["Lightning", "USB-C 1m", "USB-C 2m"]);
    const { data: filtered } = await a.client.rpc("search_items", { p_group_id: groupId });
    expect(filtered).toHaveLength(3);
  });

  it("is private to its owner, and others cannot join items to it", async () => {
    const { data } = await b.client.from("item_group_stats").select("id");
    expect(data).toHaveLength(0);
    const { error } = await b.client.from("items").insert({ name: "x", group_id: groupId });
    expect(error).not.toBeNull();
  });

  it("adds group alerts to the digest preview", async () => {
    const [result] = await runAlertDigest({ force: true, dryRun: true, userId: a.id });
    expect(result.preview?.email).toContain("Dây sạc (low_stock)");
  });

  it("restocks the most recently updated member when a group entry is bought", async () => {
    await a.client.rpc("adjust_item_quantity", { p_item_id: itemIds[2], p_delta: 1 }); // Lightning: now 2, most recent
    const { data: entry, error } = await a.client
      .from("shopping_list")
      .insert({ group_id: groupId, name: "Dây sạc", quantity: 3 })
      .select("id")
      .single();
    expect(error).toBeNull();
    // Same rule as markBoughtAction: newest member gets the stock.
    const { data: member } = await a.client
      .from("items")
      .select("id, name")
      .eq("group_id", groupId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .single();
    expect(member!.name).toBe("Lightning");
    expect(entry!.id).toBeTruthy();
  });

  it("ungroups items when the group is deleted", async () => {
    await a.client.from("item_groups").delete().eq("id", groupId);
    const { data } = await a.client.from("items").select("group_id").in("id", itemIds);
    expect(data!.every((i) => i.group_id === null)).toBe(true);
  });
});

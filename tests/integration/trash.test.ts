import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { purgeExpiredTrash } from "@/lib/trash";
import { adminClient, createTestUser, deleteTestUser, type TestUser } from "./helpers";

let owner: TestUser;
let viewer: TestUser;
let outsider: TestUser;

beforeAll(async () => {
  [owner, viewer, outsider] = await Promise.all([createTestUser(), createTestUser(), createTestUser()]);
  const token = randomUUID();
  await owner.client
    .from("household_invites")
    .insert({ email: viewer.email, role: "viewer", token_hash: createHash("sha256").update(token).digest("hex") });
  await viewer.client.rpc("accept_household_invite", { p_token: token });
});
afterAll(async () => {
  for (const u of [owner, viewer, outsider]) await deleteTestUser(u.id);
});

async function item(name: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await owner.client.from("items").insert({ name, ...extra }).select("id").single();
  if (error) throw error;
  return data.id;
}

describe("trash", () => {
  it("hides a trashed item everywhere, lists it in the trash, and restores it", async () => {
    const id = await item("Máy sấy tóc", { expiry_date: "2020-01-01" });
    expect((await owner.client.rpc("trash_item", { p_item_id: id })).error).toBeNull();

    expect((await owner.client.from("items").select("id").eq("id", id)).data).toHaveLength(0);
    expect((await owner.client.from("items").select("id").eq("id", id).not("archived_at", "is", null)).data).toHaveLength(0);
    const { data: found } = await owner.client.rpc("search_items", { p_query: "may say toc", p_archived: true });
    expect(found).toHaveLength(0);
    expect((await owner.client.from("item_alerts").select("item_id").eq("item_id", id)).data).toHaveLength(0);
    // The scheduled digest (service role, no RLS) skips it too: trashed items are archived.
    const { data: digest } = await adminClient().rpc("user_item_alerts", { p_user_id: owner.id }).select("item_id").eq("item_id", id);
    expect(digest).toHaveLength(0);

    const { data: trash } = await viewer.client.rpc("trash_items");
    expect(trash?.map((t) => [t.id, t.deleted_by_name])).toEqual([[id, owner.email.split("@")[0]]]);
    expect((await outsider.client.rpc("trash_items")).data).toHaveLength(0);

    expect((await owner.client.rpc("restore_item", { p_item_id: id })).error).toBeNull();
    const { data: back } = await owner.client.from("items").select("archived_at, deleted_at").eq("id", id).single();
    expect(back).toEqual({ archived_at: null, deleted_at: null });
  });

  it("restoring keeps an item archived if it was archived before", async () => {
    const id = await item("Áo cũ", { archived_at: new Date().toISOString() });
    await owner.client.rpc("trash_item", { p_item_id: id });
    await owner.client.rpc("restore_item", { p_item_id: id });
    const { data } = await owner.client.from("items").select("archived_at").eq("id", id).single();
    expect(data?.archived_at).not.toBeNull();
  });

  it("viewers and outsiders cannot trash, restore or delete; trashed rows cannot be edited", async () => {
    const id = await item("Đèn pin");
    expect((await viewer.client.rpc("trash_item", { p_item_id: id })).error).not.toBeNull();
    expect((await outsider.client.rpc("trash_item", { p_item_id: id })).error).not.toBeNull();
    await owner.client.rpc("trash_item", { p_item_id: id });
    expect((await viewer.client.rpc("restore_item", { p_item_id: id })).error).not.toBeNull();
    expect((await viewer.client.rpc("delete_item_forever", { p_item_id: id })).error).not.toBeNull();
    const { data: updated } = await owner.client.from("items").update({ name: "x" }).eq("id", id).select("id");
    expect(updated ?? []).toHaveLength(0);
  });

  it("deletes for good only from the trash, returning the files to remove", async () => {
    const id = await item("Tivi cũ");
    await adminClient().from("item_photos").insert({ household_id: owner.householdId, item_id: id, storage_path: `${owner.householdId}/${id}/a.webp`, thumb_path: `${owner.householdId}/${id}/a_t.webp` });
    expect((await owner.client.rpc("delete_item_forever", { p_item_id: id })).error).not.toBeNull();
    await owner.client.rpc("trash_item", { p_item_id: id });
    const { data: files, error } = await owner.client.rpc("delete_item_forever", { p_item_id: id });
    expect(error).toBeNull();
    expect(files?.map((f) => f.path).sort()).toEqual([`${owner.householdId}/${id}/a.webp`, `${owner.householdId}/${id}/a_t.webp`]);
    const { count } = await adminClient().from("items").select("id", { count: "exact", head: true }).eq("id", id);
    expect(count).toBe(0);
  });

  it("the cron purge removes items trashed more than 30 days ago", async () => {
    const old = await item("Old");
    const recent = await item("Recent");
    await owner.client.rpc("trash_item", { p_item_id: old });
    await owner.client.rpc("trash_item", { p_item_id: recent });
    const admin = adminClient();
    await admin.from("items").update({ deleted_at: new Date(Date.now() - 31 * 86_400_000).toISOString() }).eq("id", old);
    await admin.from("items").update({ deleted_at: new Date(Date.now() - 10 * 86_400_000).toISOString() }).eq("id", recent);
    const result = await purgeExpiredTrash();
    expect(result.errors).toEqual([]);
    const { data } = await admin.from("items").select("id").in("id", [old, recent]);
    expect(data?.map((r) => r.id)).toEqual([recent]);
  });
});

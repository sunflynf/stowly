import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import { adminClient, createTestUser, deleteTestUser, type TestUser } from "./helpers";
import type { Database } from "@/lib/database.types";

type Role = Database["public"]["Enums"]["household_role"];
type Tables = Database["public"]["Tables"];

// owner: created the household. editor/viewer: joined by invite. outsider: never
// a member. removed: joined as editor, then removed by the owner.
let owner: TestUser;
let editor: TestUser;
let viewer: TestUser;
let outsider: TestUser;
let removed: TestUser;
let household: string;
let itemId: string;

const sha256 = (token: string) => createHash("sha256").update(token).digest("hex");

/** Owner invites the user's email with a role; the user accepts the link. */
async function invite(user: TestUser, role: Exclude<Role, "owner">) {
  const token = randomUUID() + randomUUID();
  const { error } = await owner.client.from("household_invites").insert({ email: user.email, role, token_hash: sha256(token) });
  if (error) throw error;
  const { data, error: acceptError } = await user.client.rpc("accept_household_invite", { p_token: token });
  if (acceptError) throw acceptError;
  return data;
}

async function newItem(name = `item-${randomUUID()}`) {
  const { data, error } = await owner.client.from("items").insert({ name }).select("id").single();
  if (error) throw error;
  return data.id;
}

beforeAll(async () => {
  [owner, editor, viewer, outsider, removed] = await Promise.all([
    createTestUser(),
    createTestUser(),
    createTestUser(),
    createTestUser(),
    createTestUser(),
  ]);
  household = owner.householdId;
  itemId = await newItem("Máy lọc không khí");
  await invite(editor, "editor");
  await invite(viewer, "viewer");
  await invite(removed, "editor");
  const { error } = await owner.client.from("household_members").delete().eq("household_id", household).eq("user_id", removed.id);
  if (error) throw error;
});

afterAll(async () => {
  for (const u of [owner, editor, viewer, outsider, removed]) await deleteTestUser(u.id);
});

describe("invites", () => {
  it("joins the household with the invited role and switches to it", async () => {
    const { data } = await editor.client.rpc("current_household_id");
    expect(data).toBe(household);
    const { data: role } = await viewer.client.rpc("current_household_role");
    expect(role).toBe("viewer");
    const { data: list } = await editor.client.rpc("household_member_list");
    expect(list?.map((m) => [m.email, m.role])).toEqual([
      [owner.email, "owner"],
      [editor.email, "editor"],
      [viewer.email, "viewer"],
    ]);
  });

  it("keeps each person's own household available to switch back to", async () => {
    const { data } = await editor.client.rpc("my_households");
    expect(data?.map((h) => [h.id, h.role, h.active])).toEqual([
      [editor.householdId, "owner", false],
      [household, "editor", true],
    ]);
  });

  it("only works once, for the invited email, before it expires", async () => {
    const token = randomUUID();
    const someone = await createTestUser();
    try {
      await owner.client.from("household_invites").insert({ email: someone.email, role: "viewer", token_hash: sha256(token) });
      const { data: preview } = await outsider.client.rpc("household_invite_preview", { p_token: token });
      expect(preview?.[0]).toMatchObject({ email: someone.email, role: "viewer", status: "pending" });

      const wrong = await outsider.client.rpc("accept_household_invite", { p_token: token });
      expect(wrong.error?.message).toContain("invite_wrong_email");
      const bad = await someone.client.rpc("accept_household_invite", { p_token: "not-a-token" });
      expect(bad.error?.message).toContain("invite_not_found");
      expect((await someone.client.rpc("accept_household_invite", { p_token: token })).error).toBeNull();
      const again = await someone.client.rpc("accept_household_invite", { p_token: token });
      expect(again.error?.message).toContain("invite_used");

      const expiredToken = randomUUID();
      await adminClient()
        .from("household_invites")
        .insert({
          household_id: household,
          email: outsider.email,
          role: "viewer",
          token_hash: sha256(expiredToken),
          expires_at: new Date(Date.now() - 1000).toISOString(),
        });
      const expired = await outsider.client.rpc("accept_household_invite", { p_token: expiredToken });
      expect(expired.error?.message).toContain("invite_expired");
    } finally {
      await deleteTestUser(someone.id);
    }
  });

  it("only the owner can see or create invites", async () => {
    for (const u of [editor, viewer]) {
      const { error } = await u.client
        .from("household_invites")
        .insert({ email: `x-${randomUUID()}@stowly.test`, role: "viewer", token_hash: sha256(randomUUID()) });
      expect(error).not.toBeNull();
      const { data } = await u.client.from("household_invites").select("id");
      expect(data).toHaveLength(0);
    }
    const { data } = await owner.client.from("household_invites").select("id");
    expect(data!.length).toBeGreaterThan(0);
  });

  it("cannot invite someone as owner", async () => {
    const { error } = await owner.client
      .from("household_invites")
      .insert({ email: `x-${randomUUID()}@stowly.test`, role: "owner", token_hash: sha256(randomUUID()) });
    expect(error).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Every shared table × every role
// ---------------------------------------------------------------------------

type SharedTable = Exclude<
  keyof Tables,
  | "profiles"
  | "push_subscriptions"
  | "households"
  | "household_members"
  | "household_invites"
  | "notifications_log"
  | "group_notifications_log"
  | "maintenance_notifications_log"
>;

interface TableSpec {
  /** A row the owner creates, identified by `match`, for update/delete attempts. */
  seed: () => Promise<Record<string, string>>;
  /** A new row to insert (prerequisites are created by the owner). */
  insert: () => Promise<Record<string, unknown>>;
  /** A column change for update attempts; absent = table is not updatable. */
  update?: Record<string, unknown>;
}

const unique = () => randomUUID().slice(0, 8);

async function ownerInsert(table: SharedTable, row: Record<string, unknown>, key: string[] = ["id"]) {
  const { data, error } = await owner.client.from(table).insert(row as never).select(key.join(",")).single();
  if (error) throw error;
  return data as unknown as Record<string, string>;
}

const SPECS: Record<SharedTable, TableSpec> = {
  categories: {
    seed: () => ownerInsert("categories", { name: `c-${unique()}` }),
    insert: async () => ({ name: `c-${unique()}` }),
    update: { name: "renamed" },
  },
  locations: {
    seed: () => ownerInsert("locations", { name: `l-${unique()}` }),
    insert: async () => ({ name: `l-${unique()}` }),
    update: { name: "renamed" },
  },
  items: {
    seed: () => ownerInsert("items", { name: `i-${unique()}` }),
    insert: async () => ({ name: `i-${unique()}` }),
    update: { name: "renamed" },
  },
  item_photos: {
    seed: async () => ownerInsert("item_photos", { item_id: await newItem(), storage_path: `${household}/${unique()}.webp` }),
    insert: async () => ({ item_id: await newItem(), storage_path: `${household}/${unique()}.webp` }),
    update: { sort_order: 3 },
  },
  tags: {
    seed: () => ownerInsert("tags", { name: `t-${unique()}` }),
    insert: async () => ({ name: `t-${unique()}` }),
    update: { name: `renamed-${unique()}` },
  },
  item_tags: {
    seed: async () => {
      const tag = await ownerInsert("tags", { name: `t-${unique()}` });
      return ownerInsert("item_tags", { item_id: await newItem(), tag_id: tag.id }, ["item_id", "tag_id"]);
    },
    insert: async () => {
      const tag = await ownerInsert("tags", { name: `t-${unique()}` });
      return { item_id: await newItem(), tag_id: tag.id };
    },
  },
  item_events: {
    seed: () => ownerInsert("item_events", { item_id: itemId, type: "quantity_change", delta: 0, note: "seed" }),
    insert: async () => ({ item_id: itemId, type: "quantity_change", delta: 0 }),
    update: { note: "rewritten" },
  },
  shopping_list: {
    seed: () => ownerInsert("shopping_list", { name: `s-${unique()}` }),
    insert: async () => ({ name: `s-${unique()}` }),
    update: { done: true },
  },
  alert_snoozes: {
    seed: async () => ownerInsert("alert_snoozes", { item_id: await newItem(), kind: "low_stock", until: "2099-01-01" }, ["item_id", "kind"]),
    insert: async () => ({ item_id: await newItem(), kind: "low_stock", until: "2099-01-01" }),
    update: { until: "2099-02-01" },
  },
  item_groups: {
    seed: () => ownerInsert("item_groups", { name: `g-${unique()}` }),
    insert: async () => ({ name: `g-${unique()}` }),
    update: { min_quantity: 2 },
  },
  suggestion_dismissals: {
    seed: async () => ownerInsert("suggestion_dismissals", { item_id: await newItem(), reason: "idle" }, ["item_id", "reason"]),
    insert: async () => ({ item_id: await newItem(), reason: "idle" }),
    update: { until: "2099-01-01" },
  },
  item_documents: {
    seed: async () => {
      const item = await newItem();
      return ownerInsert("item_documents", {
        item_id: item,
        kind: "warranty",
        title: "phieu-bao-hanh.pdf",
        storage_path: `${household}/${item}/${unique()}.pdf`,
        mime_type: "application/pdf",
        size_bytes: 1000,
      });
    },
    insert: async () => {
      const item = await newItem();
      return {
        item_id: item,
        kind: "invoice",
        title: "hoa-don.pdf",
        storage_path: `${household}/${item}/${unique()}.pdf`,
        mime_type: "application/pdf",
        size_bytes: 2000,
      };
    },
    update: { kind: "manual" },
  },
  maintenance_tasks: {
    seed: () => ownerInsert("maintenance_tasks", { title: `m-${unique()}`, interval_count: 3, interval_unit: "month", item_id: itemId }),
    insert: async () => ({ title: `m-${unique()}`, interval_count: 1, interval_unit: "year" }),
    update: { title: "renamed" },
  },
  maintenance_log: {
    seed: async () => {
      const task = await ownerInsert("maintenance_tasks", { title: `m-${unique()}`, interval_count: 1, interval_unit: "week" });
      return ownerInsert("maintenance_log", { task_id: task.id, done_on: "2026-01-01" });
    },
    insert: async () => {
      const task = await ownerInsert("maintenance_tasks", { title: `m-${unique()}`, interval_count: 1, interval_unit: "week" });
      return { task_id: task.id, done_on: "2026-01-02" };
    },
    update: { note: "rewritten" },
  },
};

type Actor = "owner" | "editor" | "viewer" | "outsider" | "removed";
const actor = (name: Actor) => ({ owner, editor, viewer, outsider, removed })[name];
const canRead: Actor[] = ["owner", "editor", "viewer"];
const canWrite: Actor[] = ["owner", "editor"];
const APPEND_ONLY: SharedTable[] = ["item_events", "maintenance_log"];

describe.each(Object.keys(SPECS) as SharedTable[])("%s", (table) => {
  const spec = SPECS[table];

  it.each(["owner", "editor", "viewer", "outsider", "removed"] as Actor[])("as %s", async (name) => {
    const user = actor(name);
    const row = await spec.seed();
    const client = user.client;

    // Read
    const { data: read } = await client.from(table).select("*").match(row);
    expect(read ?? []).toHaveLength(canRead.includes(name) ? 1 : 0);

    // Insert (into the shared household, explicitly)
    const payload = { ...(await spec.insert()), household_id: household };
    const { error: insertError } = await client.from(table).insert(payload as never);
    if (canWrite.includes(name)) expect(insertError).toBeNull();
    else expect(insertError).not.toBeNull();

    // Update: histories are append-only for everyone.
    if (spec.update) {
      const { data: updated } = await client.from(table).update(spec.update as never).match(row).select();
      const allowed = canWrite.includes(name) && !APPEND_ONLY.includes(table);
      expect(updated ?? []).toHaveLength(allowed ? 1 : 0);
    }

    // Delete
    const { data: deleted } = await client.from(table).delete().match(row).select();
    const allowed = canWrite.includes(name) && !APPEND_ONLY.includes(table);
    expect(deleted ?? []).toHaveLength(allowed ? 1 : 0);
  });
});

describe("composite keys", () => {
  it("a member cannot link the shared household's rows to another household's data", async () => {
    // The editor's own household still exists; its category must not be usable here.
    const { data: own } = await adminClient()
      .from("categories")
      .select("id")
      .eq("household_id", editor.householdId)
      .eq("builtin_key", "electronics")
      .single();
    const { error } = await editor.client.from("items").insert({ name: "x", category_id: own!.id });
    expect(error).not.toBeNull();
    const { error: updateError } = await editor.client.from("items").update({ category_id: own!.id }).eq("id", itemId).select();
    expect(updateError).not.toBeNull();
  });

  it("an outsider cannot write into the household even with its id", async () => {
    const { error } = await outsider.client.from("items").insert({ name: "spoof", household_id: household });
    expect(error).not.toBeNull();
  });
});

describe("views, functions and storage", () => {
  it("alerts, search, stats and adjustments follow membership and role", async () => {
    await owner.client.from("items").update({ quantity: 1, min_quantity: 3 }).eq("id", itemId);
    for (const [name, sees] of [["editor", 1], ["viewer", 1], ["outsider", 0], ["removed", 0]] as const) {
      const u = actor(name);
      const { data: alerts } = await u.client.from("item_alerts").select("item_id").eq("item_id", itemId);
      expect(alerts, name).toHaveLength(sees);
      const { data: found } = await u.client.rpc("search_items", { p_query: "may loc" });
      expect(found?.some((r) => r.id === itemId), name).toBe(sees === 1);
    }
    const { error: viewerAdjust } = await viewer.client.rpc("adjust_item_quantity", { p_item_id: itemId, p_delta: 1 });
    expect(viewerAdjust).not.toBeNull();
    const { error: outsiderAdjust } = await outsider.client.rpc("adjust_item_quantity", { p_item_id: itemId, p_delta: 1 });
    expect(outsiderAdjust).not.toBeNull();
    const { data: q } = await editor.client.rpc("adjust_item_quantity", { p_item_id: itemId, p_delta: 1 });
    expect(Number(q)).toBe(2);
  });

  it("records who made each change", async () => {
    const { data: events } = await viewer.client
      .from("item_events")
      .select("type, actor_id")
      .eq("item_id", itemId)
      .order("created_at");
    expect(events?.at(0)).toEqual({ type: "created", actor_id: owner.id });
    expect(events?.at(-1)).toEqual({ type: "quantity_change", actor_id: editor.id });
    const { data: people } = await viewer.client.rpc("household_people");
    const names = new Map(people?.map((p) => [p.user_id, p.display_name]));
    expect(names.get(editor.id)).toBe(editor.email.split("@")[0]);
  });

  it("alert settings and notification logs stay per person", async () => {
    // Each person's lead days apply to their own view of the same items.
    const soon = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);
    const expiring = await newItem();
    await owner.client.from("items").update({ expiry_date: soon }).eq("id", expiring);
    await viewer.client.from("profiles").update({ expiry_lead_days: [7, 1] }).eq("id", viewer.id);
    const { data: ownerView } = await owner.client.from("item_alerts").select("kind").eq("item_id", expiring);
    const { data: viewerView } = await viewer.client.from("item_alerts").select("kind").eq("item_id", expiring);
    expect(ownerView).toEqual([{ kind: "expiring_soon" }]);
    expect(viewerView).toEqual([]);

    const admin = adminClient();
    await admin.from("notifications_log").insert([
      { user_id: owner.id, household_id: household, item_id: itemId, kind: "low_stock", threshold_key: "low", channel: "email" },
      { user_id: editor.id, household_id: household, item_id: itemId, kind: "low_stock", threshold_key: "low", channel: "email" },
    ]);
    const { data: mine } = await editor.client.from("notifications_log").select("user_id");
    expect(mine).toEqual([{ user_id: editor.id }]);
    const { error } = await editor.client
      .from("notifications_log")
      .insert({ user_id: editor.id, household_id: household, item_id: itemId, kind: "low_stock", threshold_key: "x", channel: "push" });
    expect(error).not.toBeNull();
    // The digest reads each person's alerts with the service role.
    const { data: digest } = await admin.rpc("user_item_alerts", { p_user_id: viewer.id }).select("item_id").eq("item_id", itemId);
    expect(digest).toHaveLength(1);
  });

  it("profiles and push subscriptions stay private to each person", async () => {
    const { data } = await editor.client.from("profiles").select("id").eq("id", owner.id);
    expect(data).toHaveLength(0);
    await owner.client.from("push_subscriptions").insert({ endpoint: `https://push.test/${unique()}`, p256dh: "k", auth: "a" });
    const { data: subs } = await editor.client.from("push_subscriptions").select("id");
    expect(subs).toHaveLength(0);
    // Nobody can switch into a household they don't belong to.
    const { error } = await outsider.client.from("profiles").update({ active_household_id: household }).eq("id", outsider.id);
    expect(error?.message).toContain("not_a_member");
  });

  it("photos: members read, editors write, others nothing", async () => {
    const bytes = new Uint8Array([82, 73, 70, 70]);
    const path = `${household}/${itemId}/${unique()}.webp`;
    expect((await editor.client.storage.from("item-photos").upload(path, bytes, { contentType: "image/webp" })).error).toBeNull();
    expect((await viewer.client.storage.from("item-photos").download(path)).error).toBeNull();
    expect((await outsider.client.storage.from("item-photos").download(path)).error).not.toBeNull();
    expect((await removed.client.storage.from("item-photos").download(path)).error).not.toBeNull();
    const viewerUpload = await viewer.client.storage
      .from("item-photos")
      .upload(`${household}/${itemId}/${unique()}.webp`, bytes, { contentType: "image/webp" });
    expect(viewerUpload.error).not.toBeNull();
    const { data: viewerRemoved } = await viewer.client.storage.from("item-photos").remove([path]);
    expect(viewerRemoved ?? []).toHaveLength(0);
    const { data: ownerRemoved } = await owner.client.storage.from("item-photos").remove([path]);
    expect(ownerRemoved).toHaveLength(1);
  });

  it("only the owner can rename the household", async () => {
    const { data: byEditor } = await editor.client.from("households").update({ name: "Hacked" }).eq("id", household).select();
    expect(byEditor).toHaveLength(0);
    const { data: byOwner } = await owner.client.from("households").update({ name: "Nhà Lê" }).eq("id", household).select("name");
    expect(byOwner).toEqual([{ name: "Nhà Lê" }]);
    const { data: seen } = await viewer.client.from("households").select("name").eq("id", household);
    expect(seen).toEqual([{ name: "Nhà Lê" }]);
    const { data: hidden } = await outsider.client.from("households").select("id").eq("id", household);
    expect(hidden).toHaveLength(0);
  });
});

describe("members", () => {
  it("only the owner changes roles", async () => {
    const { data: byEditor } = await editor.client
      .from("household_members")
      .update({ role: "owner" })
      .eq("household_id", household)
      .eq("user_id", editor.id)
      .select();
    expect(byEditor).toHaveLength(0);
    const { data: byViewer } = await viewer.client
      .from("household_members")
      .delete()
      .eq("household_id", household)
      .eq("user_id", editor.id)
      .select();
    expect(byViewer).toHaveLength(0);
    const { data: byOwner } = await owner.client
      .from("household_members")
      .update({ role: "editor" })
      .eq("household_id", household)
      .eq("user_id", viewer.id)
      .select("role");
    expect(byOwner).toEqual([{ role: "editor" }]);
    await owner.client.from("household_members").update({ role: "viewer" }).eq("household_id", household).eq("user_id", viewer.id);
  });

  it("the last owner can neither leave nor step down", async () => {
    const leave = await owner.client.from("household_members").delete().eq("household_id", household).eq("user_id", owner.id);
    expect(leave.error?.message).toContain("last_owner");
    const demote = await owner.client
      .from("household_members")
      .update({ role: "editor" })
      .eq("household_id", household)
      .eq("user_id", owner.id);
    expect(demote.error?.message).toContain("last_owner");
  });

  it("a removed member loses access and is moved back to their own household", async () => {
    const { data: items } = await removed.client.from("items").select("id").eq("household_id", household);
    expect(items).toHaveLength(0);
    const { data: current } = await removed.client.rpc("current_household_id");
    expect(current).toBe(removed.householdId);
    const { data: own } = await removed.client.from("categories").select("id");
    expect(own?.length).toBe(7);
  });

  it("a member can leave; they lose access", async () => {
    const leaver = await createTestUser();
    try {
      await invite(leaver, "editor");
      expect((await leaver.client.from("items").select("id").eq("id", itemId)).data).toHaveLength(1);
      const { error } = await leaver.client.from("household_members").delete().eq("household_id", household).eq("user_id", leaver.id);
      expect(error).toBeNull();
      expect((await leaver.client.from("items").select("id").eq("id", itemId)).data).toHaveLength(0);
      expect((await leaver.client.rpc("current_household_id")).data).toBe(leaver.householdId);
    } finally {
      await deleteTestUser(leaver.id);
    }
  });

  it("an owner who handed over ownership can leave", async () => {
    const first = await createTestUser();
    const second = await createTestUser();
    try {
      const token = randomUUID();
      await first.client.from("household_invites").insert({ email: second.email, role: "editor", token_hash: sha256(token) });
      await second.client.rpc("accept_household_invite", { p_token: token });
      await first.client.from("household_members").update({ role: "owner" }).eq("household_id", first.householdId).eq("user_id", second.id);
      const { error } = await first.client.from("household_members").delete().eq("household_id", first.householdId).eq("user_id", first.id);
      expect(error).toBeNull();
      // Left their only household: a fresh one is created for them.
      const { data: now } = await first.client.rpc("my_households");
      expect(now).toHaveLength(1);
      expect(now?.[0].id).not.toBe(first.householdId);
      expect((await second.client.from("categories").select("id")).data?.length).toBe(7);
    } finally {
      await deleteTestUser(first.id);
      await deleteTestUser(second.id);
    }
  });

  it("deleting the last owner's account hands the household to the next member", async () => {
    const first = await createTestUser();
    const second = await createTestUser();
    try {
      const token = randomUUID();
      await first.client.from("household_invites").insert({ email: second.email, role: "viewer", token_hash: sha256(token) });
      await second.client.rpc("accept_household_invite", { p_token: token });
      await deleteTestUser(first.id);
      const { data } = await second.client.rpc("current_household_role");
      expect(data).toBe("owner");
      expect((await second.client.from("categories").select("id")).data?.length).toBe(7);
    } finally {
      await deleteTestUser(second.id);
    }
  });

  it("an empty household is deleted with its data", async () => {
    const solo = await createTestUser();
    await solo.client.from("items").insert({ name: "x" });
    await deleteTestUser(solo.id);
    const admin = adminClient();
    const { count: households } = await admin.from("households").select("id", { count: "exact", head: true }).eq("id", solo.householdId);
    const { count: rows } = await admin.from("items").select("id", { count: "exact", head: true }).eq("household_id", solo.householdId);
    expect([households, rows]).toEqual([0, 0]);
  });
});

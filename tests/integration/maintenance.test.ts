import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { adminClient, createTestUser, deleteTestUser, type TestUser } from "./helpers";

let a: TestUser;
let b: TestUser;

/** "yyyy-MM-dd" in Asia/Ho_Chi_Minh (the test users' timezone), shifted by days. */
function day(offset = 0) {
  const d = new Date(Date.now() + offset * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(d);
}

async function task(row: { title: string; interval_count: number; interval_unit: "day" | "week" | "month" | "year"; start_date?: string; item_id?: string }) {
  const { data, error } = await a.client.from("maintenance_tasks").insert(row).select("id, next_due").single();
  if (error) throw error;
  return data;
}

beforeAll(async () => {
  a = await createTestUser();
  b = await createTestUser();
});

afterAll(async () => {
  await deleteTestUser(a.id);
  await deleteTestUser(b.id);
});

describe("due dates", () => {
  it("starts on the start date, or one interval after creation", async () => {
    expect((await task({ title: "Bảo dưỡng xe máy", interval_count: 6, interval_unit: "month", start_date: "2026-12-01" })).next_due).toBe(
      "2026-12-01",
    );
    const today = day();
    const weekly = await task({ title: "Tưới cây", interval_count: 2, interval_unit: "week" });
    expect(weekly.next_due).toBe(day(14));
    const { data } = await a.client.rpc("add_interval", { p_from: today, p_count: 1, p_unit: "year" });
    expect(data).toBe(`${Number(today.slice(0, 4)) + 1}${today.slice(4)}`);
  });

  it("months clamp to the end of shorter months", async () => {
    const { data } = await a.client.rpc("add_interval", { p_from: "2026-01-31", p_count: 1, p_unit: "month" });
    expect(data).toBe("2026-02-28");
  });

  it("marking done logs history (also on the item) and moves the next due date", async () => {
    const { data: item } = await a.client.from("items").insert({ name: "Máy lạnh phòng ngủ" }).select("id").single();
    const t = await task({ title: "Vệ sinh lưới lọc", interval_count: 3, interval_unit: "month", start_date: day(-10), item_id: item!.id });
    await a.client.from("maintenance_tasks").update({ snoozed_until: day(5) }).eq("id", t.id);

    const { data: next, error } = await a.client.rpc("complete_maintenance_task", { p_task_id: t.id, p_note: "thay lưới mới" });
    expect(error).toBeNull();
    const { data: expected } = await a.client.rpc("add_interval", { p_from: day(), p_count: 3, p_unit: "month" });
    expect(next).toBe(expected);

    const { data: row } = await a.client.from("maintenance_tasks").select("last_done_on, next_due, snoozed_until").eq("id", t.id).single();
    expect(row).toEqual({ last_done_on: day(), next_due: expected, snoozed_until: null });
    const { data: log } = await a.client.from("maintenance_log").select("done_on, note, actor_id").eq("task_id", t.id);
    expect(log).toEqual([{ done_on: day(), note: "thay lưới mới", actor_id: a.id }]);
    const { data: events } = await a.client.from("item_events").select("type, note").eq("item_id", item!.id).eq("type", "maintenance");
    expect(events).toEqual([{ type: "maintenance", note: "Vệ sinh lưới lọc" }]);
  });

  it("rejects done dates in the future", async () => {
    const t = await task({ title: "x", interval_count: 1, interval_unit: "day" });
    const { error } = await a.client.rpc("complete_maintenance_task", { p_task_id: t.id, p_done_on: day(30) });
    expect(error).not.toBeNull();
  });
});

describe("alerts", () => {
  it("overdue and due-within-lead-days tasks are alerts; later ones are not", async () => {
    const overdue = await task({ title: "Overdue", interval_count: 1, interval_unit: "month", start_date: day(-3) });
    const soon = await task({ title: "Soon", interval_count: 1, interval_unit: "month", start_date: day(5) });
    const later = await task({ title: "Later", interval_count: 1, interval_unit: "month", start_date: day(30) });
    const { data } = await a.client.from("maintenance_alerts").select("task_id, kind, severity, days_left, threshold_key");
    const byId = new Map(data?.map((r) => [r.task_id, r]));
    expect(byId.get(overdue.id)).toMatchObject({ kind: "maintenance_overdue", severity: 3, days_left: -3, threshold_key: `${day(-3)}:over` });
    expect(byId.get(soon.id)).toMatchObject({ kind: "maintenance_due", severity: 2, days_left: 5, threshold_key: `${day(5)}:due` });
    expect(byId.has(later.id)).toBe(false);

    // Lead days are per person.
    await a.client.from("profiles").update({ maintenance_lead_days: 0 }).eq("id", a.id);
    const { data: narrow } = await a.client.from("maintenance_alerts").select("task_id").eq("task_id", soon.id);
    expect(narrow).toHaveLength(0);
    await a.client.from("profiles").update({ maintenance_lead_days: 7 }).eq("id", a.id);
  });

  it("snoozing hides a task from the dashboard count until the date passes", async () => {
    const t = await task({ title: "Snooze me", interval_count: 1, interval_unit: "year", start_date: day(-1) });
    const before = (await a.client.rpc("dashboard_stats")).data as { maintenance_due: number; attention: number };
    await a.client.from("maintenance_tasks").update({ snoozed_until: day(7) }).eq("id", t.id);
    const after = (await a.client.rpc("dashboard_stats")).data as { maintenance_due: number; attention: number };
    expect(after.maintenance_due).toBe(before.maintenance_due - 1);
    expect(after.attention).toBe(before.attention - 1);
    const { data } = await a.client.from("maintenance_alerts").select("snoozed, snoozed_until").eq("task_id", t.id).single();
    expect(data).toEqual({ snoozed: true, snoozed_until: day(7) });
  });

  it("archived tasks raise nothing", async () => {
    const t = await task({ title: "Old", interval_count: 1, interval_unit: "day", start_date: day(-5) });
    await a.client.from("maintenance_tasks").update({ archived_at: new Date().toISOString() }).eq("id", t.id);
    const { data } = await a.client.from("maintenance_alerts").select("task_id").eq("task_id", t.id);
    expect(data).toHaveLength(0);
  });

  it("are private to the household and readable per person by the digest", async () => {
    const { data: other } = await b.client.from("maintenance_alerts").select("task_id");
    expect(other).toHaveLength(0);
    const { error } = await b.client.rpc("complete_maintenance_task", {
      p_task_id: (await task({ title: "Mine", interval_count: 1, interval_unit: "day" })).id,
    });
    expect(error).not.toBeNull();
    const { data: digest } = await adminClient().rpc("user_maintenance_alerts", { p_user_id: a.id }).select("task_id");
    expect(digest!.length).toBeGreaterThan(0);
  });

  it("deleting the item deletes its schedules", async () => {
    const { data: item } = await a.client.from("items").insert({ name: "Xe máy" }).select("id").single();
    const t = await task({ title: "Thay nhớt", interval_count: 3, interval_unit: "month", item_id: item!.id });
    await a.client.from("items").delete().eq("id", item!.id);
    const { data } = await a.client.from("maintenance_tasks").select("id").eq("id", t.id);
    expect(data).toHaveLength(0);
  });

  it("a task cannot point at another household's item", async () => {
    const { data: item } = await b.client.from("items").insert({ name: "B's item" }).select("id").single();
    const { error } = await a.client.from("maintenance_tasks").insert({ title: "x", interval_count: 1, interval_unit: "day", item_id: item!.id });
    expect(error).not.toBeNull();
  });
});

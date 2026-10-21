import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runAlertDigest } from "@/lib/alerts/digest";
import { createTestUser, deleteTestUser, type TestUser } from "./helpers";

let a: TestUser;
const day = (offset: number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date(Date.now() + offset * 86_400_000));

beforeAll(async () => {
  a = await createTestUser();
});
afterAll(async () => {
  await deleteTestUser(a.id);
});

async function item(name: string, attributes: Record<string, string>) {
  const { data, error } = await a.client.from("items").insert({ name, attributes }).select("id").single();
  if (error) throw error;
  return data.id;
}

describe("loan alerts", () => {
  it("lent_overdue works for any item, not only books", async () => {
    const drill = await item("Máy khoan", { lent_to: "Hùng", lent_due: day(-2) });
    const { data } = await a.client.from("item_alerts").select("kind, days_left").eq("item_id", drill);
    expect(data).toEqual([{ kind: "lent_overdue", days_left: -2 }]);
  });

  it("borrow_due: a week before (warning), then late (danger), nothing earlier", async () => {
    const soon = await item("Lều cắm trại", { borrowed_from: "Minh", borrow_due: day(5) });
    const late = await item("Thang nhôm", { borrowed_from: "Lan", borrow_due: day(-1) });
    const later = await item("Sách", { borrowed_from: "Thư viện", borrow_due: day(20) });
    const { data } = await a.client.from("item_alerts").select("item_id, kind, severity, threshold_key").in("item_id", [soon, late, later]);
    const byId = new Map(data?.map((r) => [r.item_id, r]));
    expect(byId.get(soon)).toMatchObject({ kind: "borrow_due", severity: 2, threshold_key: `${day(5)}:soon` });
    expect(byId.get(late)).toMatchObject({ kind: "borrow_due", severity: 3, threshold_key: `${day(-1)}:over` });
    expect(byId.has(later)).toBe(false);
  });

  it("appears in the daily digest", async () => {
    const [result] = await runAlertDigest({ force: true, dryRun: true, userId: a.id });
    expect(result.preview?.email).toEqual(expect.arrayContaining(["Lều cắm trại (borrow_due)", "Máy khoan (lent_overdue)"]));
  });

  it("history accepts lent / borrowed / returned events", async () => {
    const id = await item("Ô", {});
    for (const type of ["lent", "returned", "borrowed"] as const) {
      const { error } = await a.client.from("item_events").insert({ item_id: id, type, note: "Lan" });
      expect(error).toBeNull();
    }
  });
});

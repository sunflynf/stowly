import { describe, expect, it } from "vitest";
import { addDays, daysBetween, monthsBetween, todayIn } from "@/lib/dates";
import { alertStatus, itemStatus, type ItemStatusInput } from "@/lib/status";

const base: ItemStatusInput = {
  quantity: 4,
  min_quantity: null,
  condition: "good",
  expiry_date: null,
  warranty_until: null,
};
const today = "2026-10-19";

describe("dates", () => {
  it("computes today in a timezone", () => {
    // 2026-10-18T20:00Z is already the 19th in Ho Chi Minh City (UTC+7).
    expect(todayIn("Asia/Ho_Chi_Minh", new Date("2026-10-18T20:00:00Z"))).toBe("2026-10-19");
    expect(todayIn("UTC", new Date("2026-10-18T20:00:00Z"))).toBe("2026-10-18");
  });
  it("counts days and months", () => {
    expect(daysBetween("2026-10-19", "2026-11-02")).toBe(14);
    expect(daysBetween("2026-10-19", "2026-10-16")).toBe(-3);
    expect(monthsBetween("2025-03-20", "2026-10-19")).toBe(18);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});

describe("itemStatus", () => {
  it("shows expired with days overdue", () => {
    expect(itemStatus({ ...base, expiry_date: "2026-10-16" }, ["expired"], today)).toEqual({
      key: "expired",
      tone: "danger",
      values: { days: 3 },
    });
  });
  it("expiring soon is danger within a week, calm further out", () => {
    expect(itemStatus({ ...base, expiry_date: "2026-10-21" }, ["expiring_soon"], today).tone).toBe("danger");
    expect(itemStatus({ ...base, expiry_date: "2026-11-14" }, ["expiring_soon"], today)).toMatchObject({
      tone: "success",
      values: { days: 26 },
    });
  });
  it("prefers the most severe alert", () => {
    expect(itemStatus({ ...base, quantity: 0, min_quantity: 2 }, ["low_stock", "out_of_stock"], today).key).toBe("out_of_stock");
  });
  it("falls back to calm statuses", () => {
    expect(itemStatus({ ...base, min_quantity: 3 }, [], today).key).toBe("enough");
    expect(itemStatus({ ...base, condition: "worn" }, [], today).key).toBe("worn");
    expect(itemStatus({ ...base, warranty_until: "2027-06-25" }, [], today)).toMatchObject({
      key: "warranty_left",
      values: { months: 8 },
    });
    expect(itemStatus(base, [], today).key).toBe("good");
  });
  it("reports months in use for replacement", () => {
    expect(itemStatus({ ...base, purchase_date: "2025-03-01" }, ["replace_due"], today).values.months).toBe(19);
  });
});

describe("alertStatus", () => {
  it("maps severity to tone and normalises days", () => {
    expect(alertStatus({ kind: "expired", severity: 3, days_left: -3 })).toEqual({ key: "expired", tone: "danger", values: { days: 3 } });
    expect(alertStatus({ kind: "warranty_ending", severity: 2, days_left: 14 }).tone).toBe("warning");
    expect(alertStatus({ kind: "expiring_soon", severity: 1, days_left: 26 }).tone).toBe("success");
  });
});

import { matchesText, normalizeText } from "@/lib/text";

describe("normalizeText", () => {
  it("strips Vietnamese accents including đ", () => {
    expect(normalizeText("Áo khoác  ĐỎ")).toBe("ao khoac do");
    expect(matchesText("Phòng ngủ › Tủ quần áo", "tu quan")).toBe(true);
  });
});

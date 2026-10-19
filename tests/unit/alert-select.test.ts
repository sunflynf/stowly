import { describe, expect, it } from "vitest";
import { isDigestHour, selectNewAlerts, staleLogEntries, type DigestAlert, type LogEntry } from "@/lib/alerts/select";

const alerts: DigestAlert[] = [
  { item_id: "milk", kind: "expiring_soon", threshold_key: "2026-10-21:7" },
  { item_id: "cable", kind: "low_stock", threshold_key: "low" },
];

describe("selectNewAlerts", () => {
  it("skips alerts already sent for the same threshold on that channel", () => {
    const log: LogEntry[] = [{ item_id: "cable", kind: "low_stock", threshold_key: "low", channel: "email" }];
    expect(selectNewAlerts(alerts, log, "email").map((a) => a.item_id)).toEqual(["milk"]);
    expect(selectNewAlerts(alerts, log, "push").map((a) => a.item_id)).toEqual(["milk", "cable"]);
  });

  it("sends again when the threshold changes (30 → 7 → 1 days)", () => {
    const log: LogEntry[] = [{ item_id: "milk", kind: "expiring_soon", threshold_key: "2026-10-21:30", channel: "email" }];
    expect(selectNewAlerts(alerts, log, "email").map((a) => a.item_id)).toEqual(["milk", "cable"]);
  });
});

describe("staleLogEntries", () => {
  it("returns log rows for alerts that are no longer active", () => {
    const log: LogEntry[] = [
      { item_id: "cable", kind: "low_stock", threshold_key: "low", channel: "email" },
      { item_id: "battery", kind: "out_of_stock", threshold_key: "out", channel: "push" },
    ];
    expect(staleLogEntries(alerts, log).map((l) => l.item_id)).toEqual(["battery"]);
  });
});

describe("isDigestHour", () => {
  it("evaluates the hour in the user's timezone", () => {
    const now = new Date("2026-10-19T00:30:00Z"); // 07:30 in Ho Chi Minh City
    expect(isDigestHour(now, "Asia/Ho_Chi_Minh", 7)).toBe(true);
    expect(isDigestHour(now, "Europe/Berlin", 7)).toBe(false);
  });
});

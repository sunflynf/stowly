import { describe, expect, it } from "vitest";
import { emptyOn, usageSummary } from "@/lib/usage";
import { alertStatus } from "@/lib/status";

describe("usage", () => {
  it("describes slow, weekly and daily use", () => {
    expect(usageSummary(1 / 21)).toEqual({ kind: "perDays", days: 21 });
    expect(usageSummary(3 / 7)).toEqual({ kind: "perWeek", amount: 3 });
    expect(usageSummary(2)).toEqual({ kind: "perDay", amount: 2 });
    expect(usageSummary(0)).toBeNull();
  });

  it("estimates the empty day like the alert (last change + quantity / rate, rounded up)", () => {
    expect(emptyOn(2, 0.1, "2026-10-10")).toBe("2026-10-30");
    expect(emptyOn(1, 0.3, "2026-10-10")).toBe("2026-10-14");
    expect(emptyOn(0, 0.3, "2026-10-10")).toBeNull();
  });

  it("labels the running_out alert with the days left", () => {
    expect(alertStatus({ kind: "running_out", severity: 2, days_left: 4 })).toEqual({ key: "running_out", tone: "warning", values: { days: 4 } });
  });
});

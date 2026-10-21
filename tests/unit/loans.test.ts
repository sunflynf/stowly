import { describe, expect, it } from "vitest";
import { alertStatus } from "@/lib/status";
import { loanOf } from "@/lib/validation/loans";

describe("loanOf", () => {
  it("reads a loan from item attributes (also the books category's fields)", () => {
    expect(loanOf({ lent_to: "Lan", lent_due: "2026-11-01", lent_on: "2026-10-20" })).toEqual({
      kind: "lent",
      person: "Lan",
      due: "2026-11-01",
      since: "2026-10-20",
    });
    expect(loanOf({ borrowed_from: " Minh ", borrow_due: "not a date" })).toEqual({ kind: "borrowed", person: "Minh", due: null, since: null });
  });

  it("is null without a person", () => {
    expect(loanOf({ lent_due: "2026-11-01" })).toBeNull();
    expect(loanOf({ lent_to: "  " })).toBeNull();
    expect(loanOf(null)).toBeNull();
  });
});

describe("borrow_due status", () => {
  it("counts down, then shows days late", () => {
    expect(alertStatus({ kind: "borrow_due", severity: 2, days_left: 3 })).toEqual({ key: "borrow_due", tone: "warning", values: { days: 3 } });
    expect(alertStatus({ kind: "borrow_due", severity: 3, days_left: -2 })).toEqual({ key: "borrow_overdue", tone: "danger", values: { days: 2 } });
  });
});

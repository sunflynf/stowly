import { describe, expect, it } from "vitest";
import { monthsCovered, niceTicks, percentChange, periodRange } from "@/lib/insights";

describe("periodRange", () => {
  it("covers the current month and the 11 before it", () => {
    expect(periodRange("12m", "2026-10-19")).toEqual({ from: "2025-11-01", to: "2026-10-19" });
    expect(periodRange("12m", "2026-12-05")).toEqual({ from: "2026-01-01", to: "2026-12-05" });
  });
  it("handles calendar years and all time", () => {
    expect(periodRange("ytd", "2026-10-19")).toEqual({ from: "2026-01-01", to: "2026-10-19" });
    expect(periodRange("lastYear", "2026-10-19")).toEqual({ from: "2025-01-01", to: "2025-12-31" });
    expect(periodRange("all", "2026-10-19")).toEqual({ from: null, to: "2026-10-19" });
  });
});

describe("helpers", () => {
  it("computes percentage change", () => {
    expect(percentChange(110, 100)).toBe(10);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(5, 0)).toBeNull();
  });
  it("makes clean ticks", () => {
    expect(niceTicks(83_000_000)).toEqual([0, 25_000_000, 50_000_000, 75_000_000, 100_000_000]);
    expect(niceTicks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(niceTicks(0)).toEqual([0]);
  });
  it("counts months", () => {
    expect(monthsCovered("2025-11-01", "2026-10-19")).toBe(12);
    expect(monthsCovered("2026-10-01", "2026-10-19")).toBe(1);
  });
});

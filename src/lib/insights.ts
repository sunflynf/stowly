export const PERIODS = ["12m", "ytd", "lastYear", "all"] as const;
export type Period = (typeof PERIODS)[number];

/** Date range for a period preset, relative to `today` ("yyyy-MM-dd"). `from: null` = since the first purchase. */
export function periodRange(period: Period, today: string): { from: string | null; to: string } {
  const year = Number(today.slice(0, 4));
  switch (period) {
    case "12m": {
      // The current month plus the 11 before it, starting on the 1st.
      const [y, m] = today.split("-").map(Number);
      const startMonth = m - 11;
      const sy = startMonth <= 0 ? y - 1 : y;
      const sm = startMonth <= 0 ? startMonth + 12 : startMonth;
      return { from: `${sy}-${String(sm).padStart(2, "0")}-01`, to: today };
    }
    case "ytd":
      return { from: `${year}-01-01`, to: today };
    case "lastYear":
      return { from: `${year - 1}-01-01`, to: `${year - 1}-12-31` };
    case "all":
      return { from: null, to: today };
  }
}

/** Signed percentage change, or null when there is nothing to compare with. */
export function percentChange(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 100);
}

/** 3–5 clean axis ticks from 0 to just above `max` (1, 2, 2.5 or 5 × 10^n steps). */
export function niceTicks(max: number, target = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / target;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const ticks: number[] = [];
  for (let v = 0; v < max + step * 0.999; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** Number of whole months covered by [from, to] (inclusive, at least 1). */
export function monthsCovered(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return Math.max(1, (ty - fy) * 12 + (tm - fm) + 1);
}


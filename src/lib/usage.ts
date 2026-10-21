// How fast an item is used, for display. The rate itself is learned in the
// database (items.usage_per_day, see the usage_rate migration).

export type UsageSummary = { kind: "perDays"; days: number } | { kind: "perWeek"; amount: number } | { kind: "perDay"; amount: number };

/** "1 every 21 days" for slow use, "3 a week" or "2 a day" for faster use. */
export function usageSummary(perDay: number): UsageSummary | null {
  if (!(perDay > 0)) return null;
  if (perDay >= 1) return { kind: "perDay", amount: Math.round(perDay * 10) / 10 };
  if (perDay * 7 >= 1) return { kind: "perWeek", amount: Math.round(perDay * 7 * 10) / 10 };
  return { kind: "perDays", days: Math.round(1 / perDay) };
}

/** Estimated day the stock runs out: last known quantity / rate, from that day. Same formula as the alert. */
export function emptyOn(quantity: number, perDay: number, lastAt: string): string | null {
  if (!(perDay > 0) || !(quantity > 0)) return null;
  const d = new Date(`${lastAt}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + Math.ceil(quantity / perDay));
  return d.toISOString().slice(0, 10);
}

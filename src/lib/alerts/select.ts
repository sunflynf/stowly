import type { AlertKind } from "@/lib/types";

export type Channel = "email" | "push";

export interface DigestAlert {
  item_id: string;
  kind: AlertKind;
  threshold_key: string;
}

export interface LogEntry {
  item_id: string;
  kind: AlertKind;
  threshold_key: string;
  channel: Channel;
}

const key = (a: { item_id: string; kind: string; threshold_key: string }) => `${a.item_id}|${a.kind}|${a.threshold_key}`;

/** Alerts not yet sent on `channel` for their current threshold. */
export function selectNewAlerts<T extends DigestAlert>(alerts: T[], log: LogEntry[], channel: Channel): T[] {
  const sent = new Set(log.filter((l) => l.channel === channel).map(key));
  return alerts.filter((a) => !sent.has(key(a)));
}

/**
 * Log entries whose (item, kind) is no longer alerting. Deleting them lets the
 * alert fire again if the condition comes back (e.g. restocked, then low again).
 */
export function staleLogEntries(alerts: DigestAlert[], log: LogEntry[]): LogEntry[] {
  const active = new Set(alerts.map((a) => `${a.item_id}|${a.kind}`));
  return log.filter((l) => !active.has(`${l.item_id}|${l.kind}`));
}

/** True when the user's local time is within their digest hour. */
export function isDigestHour(now: Date, timeZone: string, digestHour: number): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", hourCycle: "h23" }).format(now),
  );
  return hour === digestHour;
}

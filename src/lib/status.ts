import { daysBetween, monthsBetween } from "@/lib/dates";
import type { AlertKind, ItemCondition } from "@/lib/types";

export type Tone = "danger" | "warning" | "neutral" | "success";

/** An alert as produced by the database (compute_item_alerts / item_alerts). */
export interface AlertInfo {
  kind: AlertKind;
  severity?: number | null;
  days_left?: number | null;
  /** Months in use (replace_due), when known. */
  months?: number | null;
}

export function severityTone(severity: number | null | undefined): Tone {
  if (severity === 3) return "danger";
  if (severity === 2) return "warning";
  return "success";
}

const KIND_SEVERITY: Record<AlertKind, number> = {
  expired: 3,
  out_of_stock: 3,
  expiring_soon: 2,
  low_stock: 2,
  warranty_ending: 2,
  replace_due: 2,
  lent_overdue: 2,
  maintenance_overdue: 3,
  maintenance_due: 2,
  borrow_due: 2,
};

export interface ItemStatusInput {
  quantity: number;
  min_quantity: number | null;
  condition: ItemCondition;
  expiry_date: string | null;
  warranty_until: string | null;
  purchase_date?: string | null;
  last_replaced_at?: string | null;
  created_at?: string | null;
  archived_at?: string | null;
}

export type StatusKey =
  | AlertKind
  | "enough"
  | "worn"
  | "broken"
  | "given_away"
  | "good"
  | "new"
  | "warranty_left"
  | "archived"
  | "borrow_overdue"
  | "borrowed";

export interface ItemStatus {
  key: StatusKey;
  tone: Tone;
  values: { days?: number; months?: number };
}

/**
 * Picks the single most relevant status badge for an item row. Which alerts
 * apply comes from the database (`kinds`); this only adds the numbers shown
 * in the label and a calm fallback when nothing is flagged.
 */
export function itemStatus(item: ItemStatusInput, kinds: readonly AlertKind[], today: string): ItemStatus {
  if (item.archived_at) return { key: "archived", tone: "neutral", values: {} };

  const sorted = [...kinds].sort((a, b) => KIND_SEVERITY[b] - KIND_SEVERITY[a]);
  const top = sorted[0];
  if (top) {
    const values: ItemStatus["values"] = {};
    if ((top === "expired" || top === "expiring_soon") && item.expiry_date) {
      values.days = Math.abs(daysBetween(today, item.expiry_date));
    }
    if (top === "warranty_ending" && item.warranty_until) values.days = daysBetween(today, item.warranty_until);
    if (top === "replace_due") {
      const since = item.last_replaced_at ?? item.purchase_date ?? item.created_at ?? null;
      values.months = since ? monthsBetween(since, today) : 0;
    }
    if (top === "lent_overdue") values.days = 0;
    // Rows from search do not carry the agreed date: a plain "to give back" badge.
    if (top === "borrow_due") return { key: "borrowed", tone: "warning", values: {} };
    let tone: Tone = KIND_SEVERITY[top] === 3 ? "danger" : "warning";
    if (top === "expiring_soon") tone = (values.days ?? 0) <= 7 ? "danger" : "success";
    return { key: top, tone, values };
  }

  if (item.condition === "broken") return { key: "broken", tone: "danger", values: {} };
  if (item.condition === "given_away") return { key: "given_away", tone: "neutral", values: {} };
  if (item.condition === "worn") return { key: "worn", tone: "neutral", values: {} };
  if (item.warranty_until && daysBetween(today, item.warranty_until) > 0) {
    return { key: "warranty_left", tone: "success", values: { months: monthsBetween(today, item.warranty_until) } };
  }
  if (item.min_quantity !== null && item.quantity > item.min_quantity) return { key: "enough", tone: "neutral", values: {} };
  if (item.condition === "new") return { key: "new", tone: "success", values: {} };
  return { key: "good", tone: "success", values: {} };
}

/** Badge for one alert from the item_alerts view. */
export function alertStatus(alert: AlertInfo): ItemStatus {
  const days = alert.days_left ?? 0;
  const values: ItemStatus["values"] = {};
  switch (alert.kind) {
    case "expired":
    case "lent_overdue":
    case "maintenance_overdue":
      values.days = Math.abs(days);
      break;
    case "expiring_soon":
    case "warranty_ending":
    case "maintenance_due":
      values.days = Math.max(0, days);
      break;
    case "replace_due":
      values.months = alert.months ?? 0;
      break;
  }
  if (alert.kind === "borrow_due") {
    // Something borrowed: "give back in N days", or "N days late" once overdue.
    const late = days < 0;
    return { key: late ? "borrow_overdue" : "borrow_due", tone: late ? "danger" : "warning", values: { days: Math.abs(days) } };
  }
  return { key: alert.kind, tone: severityTone(alert.severity ?? KIND_SEVERITY[alert.kind]), values };
}

import type { Database } from "@/lib/database.types";

type Tables = Database["public"]["Tables"];
export type Row<T extends keyof Tables> = Tables[T]["Row"];

export type ItemRow = Row<"items">;
export type CategoryRow = Row<"categories">;
export type LocationRow = Row<"locations">;
export type TagRow = Row<"tags">;
export type PhotoRow = Row<"item_photos">;
export type ItemEventRow = Row<"item_events">;
export type ShoppingRow = Row<"shopping_list">;
export type ProfileRow = Row<"profiles">;

export type ItemCondition = Database["public"]["Enums"]["item_condition"];
export type AlertKind = Database["public"]["Enums"]["alert_kind"];

export const ITEM_CONDITIONS = ["new", "good", "worn", "broken", "given_away"] as const satisfies readonly ItemCondition[];
export const ALERT_KINDS = [
  "expired",
  "expiring_soon",
  "out_of_stock",
  "low_stock",
  "warranty_ending",
  "replace_due",
  "lent_overdue",
] as const satisfies readonly AlertKind[];

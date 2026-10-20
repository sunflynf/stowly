import { z } from "zod";
import { optionalDate, optionalText, requiredName, uuid } from "./common";

export const INTERVAL_UNITS = ["day", "week", "month", "year"] as const;
export type IntervalUnit = (typeof INTERVAL_UNITS)[number];

export const maintenanceTaskSchema = z.object({
  title: requiredName(120),
  item_id: z.preprocess((v) => (v === "" ? null : v), uuid.nullable()),
  interval_count: z.coerce.number("number").int("number").min(1, "min").max(1000, "invalid"),
  interval_unit: z.enum(INTERVAL_UNITS),
  start_date: optionalDate,
  notes: optionalText(2000),
});
export type MaintenanceTaskInput = z.input<typeof maintenanceTaskSchema>;

export const completeTaskSchema = z.object({
  id: uuid,
  done_on: optionalDate,
  note: optionalText(500),
});

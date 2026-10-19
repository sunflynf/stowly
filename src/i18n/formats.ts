import type { Formats } from "next-intl";

// Shared format presets. Vietnamese renders dd/MM/yyyy, "2.384", "85.000 ₫";
// English uses its own conventions via the same presets.
export const formats = {
  dateTime: {
    short: { day: "2-digit", month: "2-digit", year: "numeric" },
    dayMonth: { day: "2-digit", month: "2-digit" },
    long: { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" },
    weekdayDayMonth: { weekday: "long", day: "2-digit", month: "2-digit" },
    dateTime: { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" },
  },
  number: {
    integer: { maximumFractionDigits: 0 },
    quantity: { maximumFractionDigits: 3 },
  },
} satisfies Formats;

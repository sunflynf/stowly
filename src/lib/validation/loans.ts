import { z } from "zod";
import { optionalDate, optionalText, uuid } from "./common";

export const LOAN_KINDS = ["lent", "borrowed"] as const;
export type LoanKind = (typeof LOAN_KINDS)[number];

export const loanSchema = z.object({
  itemId: uuid,
  kind: z.enum(LOAN_KINDS),
  person: z.string().trim().min(1, "required").max(80, "tooLong"),
  due: optionalDate,
  note: optionalText(300),
});

/** Attribute keys that hold a loan (shared with the books category's fields). */
export const LOAN_KEYS = {
  lent: { person: "lent_to", due: "lent_due", since: "lent_on" },
  borrowed: { person: "borrowed_from", due: "borrow_due", since: "borrowed_on" },
} as const;

export interface Loan {
  kind: LoanKind;
  person: string;
  due: string | null;
  since: string | null;
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** The item's current loan, read from its attributes (lent wins if both are set). */
export function loanOf(attributes: unknown): Loan | null {
  const attrs = (attributes && typeof attributes === "object" ? attributes : {}) as Record<string, unknown>;
  for (const kind of LOAN_KINDS) {
    const keys = LOAN_KEYS[kind];
    const person = attrs[keys.person];
    if (typeof person === "string" && person.trim()) {
      return {
        kind,
        person: person.trim(),
        due: isDate(attrs[keys.due]) ? (attrs[keys.due] as string) : null,
        since: isDate(attrs[keys.since]) ? (attrs[keys.since] as string) : null,
      };
    }
  }
  return null;
}

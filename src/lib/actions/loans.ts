"use server";

import { todayIn } from "@/lib/dates";
import type { Json } from "@/lib/database.types";
import { uuid } from "@/lib/validation/common";
import { LOAN_KEYS, LOAN_KINDS, loanOf, loanSchema } from "@/lib/validation/loans";
import { requireEditor, type ServerSupabase } from "./auth-guard";
import { fail, mapDbError, ok, validationFail, type ActionResult } from "./result";

async function readAttributes(supabase: ServerSupabase, itemId: string) {
  const { data } = await supabase.from("items").select("attributes").eq("id", itemId).maybeSingle();
  if (!data) return null;
  return { ...((data.attributes ?? {}) as Record<string, Json>) };
}

/** Lends an item to someone, or records that it was borrowed from someone. */
export async function startLoanAction(input: unknown): Promise<ActionResult> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsed = loanSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { itemId, kind, person, due, note } = parsed.data;

  const attrs = await readAttributes(auth.supabase, itemId);
  if (!attrs) return fail("notFound");
  if (loanOf(attrs)) return fail("conflict");
  const { data: profile } = await auth.supabase.from("profiles").select("timezone").maybeSingle();
  const keys = LOAN_KEYS[kind];
  attrs[keys.person] = person;
  attrs[keys.since] = todayIn(profile?.timezone ?? "Asia/Ho_Chi_Minh");
  if (due) attrs[keys.due] = due;
  else delete attrs[keys.due];

  const { error } = await auth.supabase.from("items").update({ attributes: attrs }).eq("id", itemId);
  if (error) return fail(mapDbError(error));
  await auth.supabase
    .from("item_events")
    .insert({ item_id: itemId, type: kind, note: note ? `${person} · ${note}`.slice(0, 500) : person });
  return ok();
}

/** The loan is over: it came back to us, or we gave it back. Clears the loan and logs it. */
export async function endLoanAction(itemId: unknown): Promise<ActionResult> {
  const auth = await requireEditor();
  if ("error" in auth) return fail(auth.error);
  const parsedId = uuid.safeParse(itemId);
  if (!parsedId.success) return validationFail(parsedId.error);

  const attrs = await readAttributes(auth.supabase, parsedId.data);
  if (!attrs) return fail("notFound");
  const loan = loanOf(attrs);
  if (!loan) return fail("notFound");
  for (const kind of LOAN_KINDS) for (const key of Object.values(LOAN_KEYS[kind])) delete attrs[key];

  const { error } = await auth.supabase.from("items").update({ attributes: attrs }).eq("id", parsedId.data);
  if (error) return fail(mapDbError(error));
  await auth.supabase.from("item_events").insert({ item_id: parsedId.data, type: "returned", note: loan.person });
  // Snoozed loan reminders should not carry over to a future loan.
  await auth.supabase.from("alert_snoozes").delete().eq("item_id", parsedId.data).in("kind", ["lent_overdue", "borrow_due"]);
  return ok();
}

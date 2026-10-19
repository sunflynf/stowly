import type { z } from "zod";

/** Uniform result for server actions. `error` is a message key under "errors". */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: ActionError; fieldErrors?: Record<string, string[]> };

export type ActionError =
  | "unauthorized"
  | "forbidden"
  | "validation"
  | "notFound"
  | "conflict"
  | "invalidCredentials"
  | "signupNotAllowed"
  | "rateLimited"
  | "photoLimit"
  | "documentLimit"
  | "locationCycle"
  | "locationTooDeep"
  | "locationNotEmpty"
  | "categoryInUse"
  | "lastOwner"
  | "alreadyMember"
  | "inviteNotFound"
  | "inviteExpired"
  | "inviteUsed"
  | "inviteWrongEmail"
  | "unknown";

export function ok(): { ok: true; data: void };
export function ok<T>(data: T): { ok: true; data: T };
export function ok<T>(data?: T): { ok: true; data: T | undefined } {
  return { ok: true, data };
}

export function fail(error: ActionError, fieldErrors?: Record<string, string[]>) {
  return { ok: false as const, error, fieldErrors };
}

export function validationFail(error: z.ZodError) {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return fail("validation", fieldErrors);
}

/** Maps Postgres / PostgREST errors raised by our triggers to action errors. */
export function mapDbError(error: { code?: string; message?: string } | null): ActionError {
  if (!error) return "unknown";
  const msg = error.message ?? "";
  if (msg.includes("photo_limit_reached")) return "photoLimit";
  if (msg.includes("document_limit_reached")) return "documentLimit";
  if (msg.includes("location_cycle")) return "locationCycle";
  if (msg.includes("location_too_deep")) return "locationTooDeep";
  if (msg.includes("last_owner")) return "lastOwner";
  if (msg.includes("invite_not_found")) return "inviteNotFound";
  if (msg.includes("invite_expired")) return "inviteExpired";
  if (msg.includes("invite_used")) return "inviteUsed";
  if (msg.includes("invite_wrong_email")) return "inviteWrongEmail";
  if (msg.includes("not_a_member")) return "forbidden";
  // Row level security rejected the write (e.g. a viewer).
  if (error.code === "42501") return "forbidden";
  if (error.code === "23503") return "conflict";
  if (error.code === "23505") return "conflict";
  if (error.code === "P0002" || error.code === "PGRST116") return "notFound";
  if (error.code === "23514" || error.code === "22023" || error.code === "22P02") return "validation";
  return "unknown";
}

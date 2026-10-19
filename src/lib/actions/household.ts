"use server";

import { randomBytes, createHash } from "node:crypto";
import { getLocale } from "next-intl/server";
import { isLocale } from "@/i18n/config";
import { emailConfigured, sendEmail } from "@/lib/alerts/email";
import { publicEnv } from "@/lib/env";
import { renderInviteEmail } from "@/lib/invites/render";
import {
  displayNameSchema,
  householdNameSchema,
  inviteSchema,
  inviteTokenSchema,
  memberRoleSchema,
} from "@/lib/validation/household";
import { uuid } from "@/lib/validation/common";
import { requireOwner, requireRole, requireUser } from "./auth-guard";
import { fail, mapDbError, ok, validationFail, type ActionResult } from "./result";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Creates an invite (replacing an open one for the same email) and emails the
 * link when Resend is configured. The link is always returned so the owner can
 * also share it directly; only its hash is stored.
 */
export async function inviteMemberAction(input: unknown): Promise<ActionResult<{ link: string; emailed: boolean }>> {
  const auth = await requireOwner();
  if ("error" in auth) return fail(auth.error);
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { email, role } = parsed.data;

  const { data: members } = await auth.supabase.rpc("household_member_list");
  if (members?.some((m) => m.email.toLowerCase() === email)) return fail("alreadyMember");

  const token = randomBytes(32).toString("base64url");
  await auth.supabase.from("household_invites").delete().eq("email", email).is("accepted_at", null);
  const { error } = await auth.supabase
    .from("household_invites")
    .insert({ household_id: auth.householdId, email, role, token_hash: hashToken(token) });
  if (error) return fail(mapDbError(error));

  const link = `${publicEnv.siteUrl()}/invite/${token}`;
  let emailed = false;
  if (emailConfigured()) {
    const [{ data: households }, locale] = await Promise.all([auth.supabase.rpc("my_households"), getLocale()]);
    const active = households?.find((h) => h.active);
    const inviter = members?.find((m) => m.user_id === auth.userId)?.display_name ?? "Stowly";
    const owner = active?.owner_name ?? inviter;
    const loc = isLocale(locale) ? locale : "vi";
    const household = active?.name ?? (loc === "en" ? `${owner}'s home` : `Nhà của ${owner}`);
    try {
      await sendEmail(email, renderInviteEmail({ locale: loc, inviter, household, role, link }));
      emailed = true;
    } catch {
      // The owner still gets the link to share by other means.
      emailed = false;
    }
  }
  return ok({ link, emailed });
}

export async function revokeInviteAction(id: unknown): Promise<ActionResult> {
  const auth = await requireOwner();
  if ("error" in auth) return fail(auth.error);
  const parsed = uuid.safeParse(id);
  if (!parsed.success) return validationFail(parsed.error);
  const { error } = await auth.supabase.from("household_invites").delete().eq("id", parsed.data);
  if (error) return fail(mapDbError(error));
  return ok();
}

export async function changeMemberRoleAction(input: unknown): Promise<ActionResult> {
  const auth = await requireOwner();
  if ("error" in auth) return fail(auth.error);
  const parsed = memberRoleSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  const { data, error } = await auth.supabase
    .from("household_members")
    .update({ role: parsed.data.role })
    .eq("household_id", auth.householdId)
    .eq("user_id", parsed.data.userId)
    .select("user_id");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  return ok();
}

export async function removeMemberAction(userId: unknown): Promise<ActionResult> {
  const auth = await requireOwner();
  if ("error" in auth) return fail(auth.error);
  const parsed = uuid.safeParse(userId);
  if (!parsed.success) return validationFail(parsed.error);
  const { data, error } = await auth.supabase
    .from("household_members")
    .delete()
    .eq("household_id", auth.householdId)
    .eq("user_id", parsed.data)
    .select("user_id");
  if (error) return fail(mapDbError(error));
  if (!data.length) return fail("notFound");
  return ok();
}

/** Leaves the active household. The database moves the person to another household (or a new one). */
export async function leaveHouseholdAction(): Promise<ActionResult> {
  const auth = await requireRole("viewer");
  if ("error" in auth) return fail(auth.error);
  const { error } = await auth.supabase
    .from("household_members")
    .delete()
    .eq("household_id", auth.householdId)
    .eq("user_id", auth.userId);
  if (error) return fail(mapDbError(error));
  return ok();
}

export async function switchHouseholdAction(householdId: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsed = uuid.safeParse(householdId);
  if (!parsed.success) return validationFail(parsed.error);
  const { error } = await auth.supabase.from("profiles").update({ active_household_id: parsed.data }).eq("id", auth.userId);
  if (error) return fail(mapDbError(error));
  return ok();
}

export async function renameHouseholdAction(name: unknown): Promise<ActionResult> {
  const auth = await requireOwner();
  if ("error" in auth) return fail(auth.error);
  const parsed = householdNameSchema.safeParse(name);
  if (!parsed.success) return validationFail(parsed.error);
  const { error } = await auth.supabase.from("households").update({ name: parsed.data }).eq("id", auth.householdId);
  if (error) return fail(mapDbError(error));
  return ok();
}

export async function updateDisplayNameAction(name: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsed = displayNameSchema.safeParse(name);
  if (!parsed.success) return validationFail(parsed.error);
  const { error } = await auth.supabase.from("profiles").update({ display_name: parsed.data }).eq("id", auth.userId);
  if (error) return fail(mapDbError(error));
  return ok();
}

export async function acceptInviteAction(token: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsed = inviteTokenSchema.safeParse(token);
  if (!parsed.success) return fail("inviteNotFound");
  const { error } = await auth.supabase.rpc("accept_household_invite", { p_token: parsed.data });
  if (error) return fail(mapDbError(error));
  return ok();
}

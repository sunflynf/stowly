import { z } from "zod";
import { emailSchema } from "./auth";
import { uuid } from "./common";

export const INVITE_ROLES = ["editor", "viewer"] as const;
export const MEMBER_ROLES = ["owner", "editor", "viewer"] as const;

export const inviteSchema = z.object({
  email: emailSchema,
  role: z.enum(INVITE_ROLES),
});
export type InviteInput = z.infer<typeof inviteSchema>;

export const memberRoleSchema = z.object({
  userId: uuid,
  role: z.enum(MEMBER_ROLES),
});

export const householdNameSchema = z
  .string()
  .trim()
  .max(80, "tooLong")
  .transform((s) => (s === "" ? null : s));

export const displayNameSchema = z
  .string()
  .trim()
  .max(60, "tooLong")
  .transform((s) => (s === "" ? null : s));

/** Invite tokens are 32 random bytes, base64url-encoded (43 characters). */
export const inviteTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

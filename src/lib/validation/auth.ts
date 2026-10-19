import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("email").max(254, "tooLong");

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "required").max(200, "tooLong"),
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: z.string().min(8, "passwordMin").max(200, "tooLong"),
});

export const magicLinkSchema = z.object({ email: emailSchema });

/** Only allow same-origin relative redirects after login. */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  return next;
}

"use server";

import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getSupabaseServer } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";
import { syncPreferenceCookies } from "@/lib/preferences";
import { magicLinkSchema, safeNextPath, signInSchema, signUpSchema } from "@/lib/validation/auth";
import { fail, ok, validationFail, type ActionResult } from "./result";

function isAllowedEmail(email: string) {
  const allowed = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  return !allowed || allowed === email;
}

function authError(error: { status?: number; code?: string; message: string }) {
  if (error.status === 429 || error.code === "over_email_send_rate_limit") return fail("rateLimited");
  if (error.message.includes("signup_not_allowed") || error.code === "signup_disabled") return fail("signupNotAllowed");
  return fail("invalidCredentials");
}

export async function signInAction(input: unknown, next?: string): Promise<ActionResult> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return authError(error);

  await syncPreferenceCookies(supabase);
  redirect(safeNextPath(next));
}

export async function signUpAction(input: unknown): Promise<ActionResult<{ needsConfirmation: boolean }>> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);
  if (!isAllowedEmail(parsed.data.email)) return fail("signupNotAllowed");

  const supabase = await getSupabaseServer();
  const locale = await getLocale();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      data: { locale },
      emailRedirectTo: `${publicEnv.siteUrl()}/auth/callback`,
    },
  });
  if (error) return authError(error);
  if (data.session) {
    await syncPreferenceCookies(supabase);
    redirect("/");
  }
  return ok({ needsConfirmation: true });
}

export async function magicLinkAction(input: unknown, next?: string): Promise<ActionResult> {
  const parsed = magicLinkSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  const supabase = await getSupabaseServer();
  const locale = await getLocale();
  const callback = new URL("/auth/callback", publicEnv.siteUrl());
  callback.searchParams.set("next", safeNextPath(next));
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      // Magic links only sign in existing accounts; sign-up is a separate, allowlisted flow.
      shouldCreateUser: false,
      emailRedirectTo: callback.toString(),
      data: { locale },
    },
  });
  if (error && error.code !== "otp_disabled" && error.status !== 422) return authError(error);
  // Do not reveal whether the account exists.
  return ok();
}

export async function signOutAction() {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}

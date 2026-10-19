"use server";

import { z } from "zod";
import { isLocale, isTimeZone } from "@/i18n/config";
import { pushConfigured, sendPush } from "@/lib/alerts/push";
import { renderTestPush } from "@/lib/alerts/render";
import { setPreferenceCookies } from "@/lib/preferences";
import { requireUser } from "./auth-guard";
import { fail, mapDbError, ok, validationFail, type ActionResult } from "./result";

const profileSchema = z
  .object({
    timezone: z.string().refine(isTimeZone, "invalid"),
    currency: z.enum(["VND", "USD", "EUR"]),
    expiry_lead_days: z
      .array(z.number().int().min(1).max(365))
      .min(1)
      .max(6)
      .transform((days) => [...new Set(days)].sort((a, b) => b - a)),
    warranty_lead_days: z.number().int().min(1).max(365),
    notify_email: z.boolean(),
    notify_push: z.boolean(),
    digest_hour: z.number().int().min(0).max(23),
    unused_after_days: z.number().int().min(30).max(3650),
  })
  .partial();

export async function updateProfileAction(input: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  const { error } = await auth.supabase.from("profiles").update(parsed.data).eq("id", auth.userId);
  if (error) return fail(mapDbError(error));
  if (parsed.data.timezone) await setPreferenceCookies({ timezone: parsed.data.timezone });
  return ok();
}

const subscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
  userAgent: z.string().max(300).optional(),
});

export async function savePushSubscriptionAction(input: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return validationFail(parsed.error);

  // An endpoint belongs to one browser; re-subscribing replaces the old row.
  await auth.supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  const { error } = await auth.supabase.from("push_subscriptions").insert({
    endpoint: parsed.data.endpoint,
    p256dh: parsed.data.keys.p256dh,
    auth: parsed.data.keys.auth,
    user_agent: parsed.data.userAgent ?? null,
  });
  if (error) return fail(mapDbError(error));
  return ok();
}

export async function deletePushSubscriptionAction(endpoint: unknown): Promise<ActionResult> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  const parsed = z.url().safeParse(endpoint);
  if (!parsed.success) return validationFail(parsed.error);
  const { error } = await auth.supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data);
  if (error) return fail(mapDbError(error));
  return ok();
}

/** Sends a test notification to this user's subscribed devices. */
export async function sendTestPushAction(): Promise<ActionResult<{ delivered: number }>> {
  const auth = await requireUser();
  if (!auth) return fail("unauthorized");
  if (!pushConfigured()) return fail("unknown");
  const [{ data: subs }, { data: profile }] = await Promise.all([
    auth.supabase.from("push_subscriptions").select("id, endpoint, p256dh, auth"),
    auth.supabase.from("profiles").select("locale").maybeSingle(),
  ]);
  if (!subs?.length) return fail("notFound");
  const locale = isLocale(profile?.locale) ? profile.locale : "vi";
  const { delivered, expired } = await sendPush(subs, renderTestPush(locale));
  if (expired.length) await auth.supabase.from("push_subscriptions").delete().in("id", expired);
  return ok({ delivered });
}

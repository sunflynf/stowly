import "server-only";
import { isLocale, type Locale } from "@/i18n/config";
import { publicEnv } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { emailConfigured, sendEmail } from "./email";
import { pushConfigured, sendPush } from "./push";
import { renderDigestEmail, renderDigestPush, type RenderAlert } from "./render";
import { isDigestHour, selectNewAlerts, staleLogEntries, type Channel, type LogEntry } from "./select";

export interface DigestOptions {
  now?: Date;
  /** Ignore the per-user digest hour (manual runs, tests). */
  force?: boolean;
  /** Only process this user. */
  userId?: string;
  /** Compute what would be sent without sending or logging anything. */
  dryRun?: boolean;
}

export interface UserDigestResult {
  userId: string;
  email: number;
  push: number;
  skipped?: string;
  /** Dry run only: alert names that would be sent per channel. */
  preview?: Record<Channel, string[]>;
  errors: string[];
}

type Alert = RenderAlert & { threshold_key: string };

/**
 * Evaluates alert states per user (in their timezone) and sends one email digest
 * and one push notification with alerts that were not sent before. Idempotent:
 * notifications_log prevents re-sending the same item/threshold.
 */
export async function runAlertDigest(options: DigestOptions = {}): Promise<UserDigestResult[]> {
  const db = getSupabaseAdmin();
  const now = options.now ?? new Date();

  let query = db.from("profiles").select("id, locale, timezone, notify_email, notify_push, digest_hour");
  if (options.userId) query = query.eq("id", options.userId);
  const { data: profiles, error } = await query;
  if (error) throw error;

  const results: UserDigestResult[] = [];
  for (const profile of profiles) {
    const result: UserDigestResult = { userId: profile.id, email: 0, push: 0, errors: [] };
    results.push(result);
    if (!options.force && !isDigestHour(now, profile.timezone, profile.digest_hour)) {
      result.skipped = "not-digest-hour";
      continue;
    }
    if (!profile.notify_email && !profile.notify_push) {
      result.skipped = "notifications-off";
      continue;
    }

    const [{ data: rawAlerts, error: alertError }, { data: rawLog, error: logError }] = await Promise.all([
      db
        .from("item_alerts")
        .select("item_id, name, kind, severity, days_left, threshold_key, replace_after_months, location_path, location_path_en, snoozed")
        .eq("user_id", profile.id),
      db.from("notifications_log").select("id, item_id, kind, threshold_key, channel").eq("user_id", profile.id),
    ]);
    if (alertError || logError) {
      result.errors.push((alertError ?? logError)!.message);
      continue;
    }

    const alerts: Alert[] = rawAlerts
      .filter((a) => !a.snoozed)
      .map((a) => ({
        item_id: a.item_id!,
        name: a.name!,
        kind: a.kind!,
        severity: a.severity ?? 1,
        days_left: a.days_left,
        threshold_key: a.threshold_key!,
        replace_after_months: a.replace_after_months,
        location_path: a.location_path,
        location_path_en: a.location_path_en,
      }))
      .sort((x, y) => y.severity - x.severity || (x.days_left ?? 0) - (y.days_left ?? 0));
    const log = rawLog as (LogEntry & { id: string })[];

    if (options.dryRun) {
      const preview = (channel: Channel) => selectNewAlerts(alerts, log, channel).map((a) => `${a.name} (${a.kind})`);
      result.preview = {
        email: profile.notify_email ? preview("email") : [],
        push: profile.notify_push ? preview("push") : [],
      };
      continue;
    }

    // Resolved alerts may fire again later.
    const stale = staleLogEntries(alerts, log) as (LogEntry & { id: string })[];
    if (stale.length) await db.from("notifications_log").delete().in("id", stale.map((s) => s.id));

    const locale: Locale = isLocale(profile.locale) ? profile.locale : "vi";
    const markSent = async (channel: Channel, sent: Alert[]) => {
      if (!sent.length) return;
      const { error: insertError } = await db.from("notifications_log").upsert(
        sent.map((a) => ({ user_id: profile.id, item_id: a.item_id, kind: a.kind, threshold_key: a.threshold_key, channel })),
        { onConflict: "item_id,kind,threshold_key,channel", ignoreDuplicates: true },
      );
      if (insertError) result.errors.push(insertError.message);
    };

    if (profile.notify_email && emailConfigured()) {
      const fresh = selectNewAlerts(alerts, log, "email");
      if (fresh.length) {
        try {
          const { data: user } = await db.auth.admin.getUserById(profile.id);
          const to = user.user?.email;
          if (!to) throw new Error("user has no email");
          await sendEmail(to, renderDigestEmail({ locale, timeZone: profile.timezone, siteUrl: publicEnv.siteUrl(), alerts: fresh }));
          await markSent("email", fresh);
          result.email = fresh.length;
        } catch (e) {
          result.errors.push(`email: ${(e as Error).message}`);
        }
      }
    }

    if (profile.notify_push && pushConfigured()) {
      const fresh = selectNewAlerts(alerts, log, "push");
      if (fresh.length) {
        const { data: subs } = await db.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", profile.id);
        if (subs?.length) {
          const { delivered, expired } = await sendPush(subs, renderDigestPush({ locale, timeZone: profile.timezone, alerts: fresh }));
          if (expired.length) await db.from("push_subscriptions").delete().in("id", expired);
          if (delivered > 0) {
            await markSent("push", fresh);
            result.push = fresh.length;
          }
        }
      }
    }
  }
  return results;
}

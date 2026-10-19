import { createFormatter, createTranslator } from "next-intl";
import en from "../../../messages/en.json";
import vi from "../../../messages/vi.json";
import { formats } from "@/i18n/formats";
import type { Locale } from "@/i18n/config";
import { alertStatus } from "@/lib/status";
import type { AlertKind } from "@/lib/types";

const MESSAGES = { vi, en } as const;

export interface RenderAlert {
  item_id: string;
  name: string;
  kind: AlertKind;
  severity: number;
  days_left: number | null;
  replace_after_months: number | null;
  location_path: string | null;
  location_path_en: string | null;
}

const TONE_STYLE = {
  danger: "background:#FDE8E6;color:#9F1D14",
  warning: "background:#FDEFD6;color:#8A4B00",
  success: "background:#E3F1EE;color:#0A5A51",
  neutral: "background:#EEF1EF;color:#3B4A44",
} as const;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function translators(locale: Locale, timeZone: string) {
  const messages = MESSAGES[locale];
  return {
    t: createTranslator({ locale, messages, namespace: "notifications" }),
    ts: createTranslator({ locale, messages, namespace: "status" }),
    format: createFormatter({ locale, timeZone, formats }),
  };
}

function statusText(locale: Locale, timeZone: string, a: RenderAlert) {
  const { ts } = translators(locale, timeZone);
  const months = (a.replace_after_months ?? 0) + Math.floor(Math.max(0, -(a.days_left ?? 0)) / 30.44);
  const status = alertStatus({ kind: a.kind, severity: a.severity, days_left: a.days_left, months });
  return { status, label: ts(status.key, { days: status.values.days ?? 0, months: status.values.months ?? 0 }) };
}

/** Daily digest email (HTML + plain text) in the user's language. */
export function renderDigestEmail(opts: { locale: Locale; timeZone: string; siteUrl: string; alerts: RenderAlert[] }) {
  const { locale, timeZone, siteUrl, alerts } = opts;
  const { t, format } = translators(locale, timeZone);
  const count = alerts.length;
  const date = format.dateTime(new Date(), "long");
  const path = (a: RenderAlert) => (locale === "en" && a.location_path_en ? a.location_path_en : a.location_path) ?? "";

  const rows = alerts
    .map((a) => {
      const { status, label } = statusText(locale, timeZone, a);
      const url = `${siteUrl}/items/${a.item_id}`;
      return `<tr>
  <td style="padding:12px 0;border-bottom:1px solid #E2E8E5">
    <a href="${url}" style="color:#14201C;font-weight:600;text-decoration:none">${escapeHtml(a.name)}</a>
    <div style="color:#4B5C55;font-size:13px">${escapeHtml(path(a))}</div>
  </td>
  <td style="padding:12px 0;border-bottom:1px solid #E2E8E5;text-align:right;white-space:nowrap">
    <span style="${TONE_STYLE[status.tone]};border-radius:6px;padding:3px 8px;font-size:13px;font-weight:600">${escapeHtml(label)}</span>
  </td>
</tr>`;
    })
    .join("\n");

  const html = `<!doctype html>
<html lang="${locale}"><body style="margin:0;background:#F3F5F4;font-family:'Be Vietnam Pro',Arial,sans-serif;color:#14201C">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E2E8E5;border-radius:14px;padding:24px">
<tr><td>
  <p style="margin:0 0 4px;color:#4B5C55;font-size:13px">${escapeHtml(date)}</p>
  <h1 style="margin:0 0 8px;font-size:20px">${escapeHtml(t("heading"))}</h1>
  <p style="margin:0 0 16px;color:#4B5C55">${escapeHtml(t("intro", { count }))}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  <p style="margin:24px 0 0"><a href="${siteUrl}/alerts" style="display:inline-block;background:#0B6E63;color:#FFFFFF;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px">${escapeHtml(t("open"))}</a></p>
  <p style="margin:24px 0 0;color:#4B5C55;font-size:12px">${escapeHtml(t("footer"))}</p>
</td></tr></table>
</td></tr></table>
</body></html>`;

  const text = [
    t("heading"),
    t("intro", { count }),
    "",
    ...alerts.map((a) => `• ${a.name} — ${statusText(locale, timeZone, a).label}${path(a) ? ` (${path(a)})` : ""}`),
    "",
    `${t("open")}: ${siteUrl}/alerts`,
  ].join("\n");

  return { subject: t("subject", { count }), html, text };
}

/** Single push notification summarising new alerts. */
export function renderDigestPush(opts: { locale: Locale; timeZone: string; alerts: RenderAlert[] }) {
  const { locale, timeZone, alerts } = opts;
  const { t } = translators(locale, timeZone);
  const top = alerts.slice(0, 3).map((a) => `${a.name}: ${statusText(locale, timeZone, a).label}`);
  const more = alerts.length > 3 ? [t("pushMore", { count: alerts.length - 3 })] : [];
  return { title: t("pushTitle", { count: alerts.length }), body: [...top, ...more].join("\n"), url: "/alerts", tag: "stowly-digest" };
}

export function renderTestPush(locale: Locale) {
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: "notifications" });
  return { title: t("testTitle"), body: t("testBody"), url: "/settings", tag: "stowly-test" };
}

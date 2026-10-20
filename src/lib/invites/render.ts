import { createTranslator } from "next-intl";
import en from "../../../messages/en.json";
import vi from "../../../messages/vi.json";
import type { Locale } from "@/i18n/config";
import type { HouseholdRole } from "@/lib/types";

const MESSAGES = { vi, en } as const;

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Household invitation email (HTML + plain text), in the inviter's language. */
export function renderInviteEmail(opts: {
  locale: Locale;
  inviter: string;
  household: string;
  role: HouseholdRole;
  link: string;
}) {
  const t = createTranslator({ locale: opts.locale, messages: MESSAGES[opts.locale], namespace: "invite" });
  const tr = createTranslator({ locale: opts.locale, messages: MESSAGES[opts.locale], namespace: "members.roles" });
  const values = { inviter: opts.inviter, household: opts.household, role: tr(opts.role) };

  const html = `<!doctype html>
<html lang="${opts.locale}"><body style="margin:0;background:#F3F5F4;font-family:'Be Vietnam Pro',Arial,sans-serif;color:#14201C">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E2E8E5;border-radius:14px;padding:24px">
<tr><td>
  <h1 style="margin:0 0 8px;font-size:20px">${escapeHtml(t("emailHeading", values))}</h1>
  <p style="margin:0 0 16px;color:#4B5C55">${escapeHtml(t("emailBody", values))}</p>
  <p style="margin:24px 0 0"><a href="${escapeHtml(opts.link)}" style="display:inline-block;background:#0B6E63;color:#FFFFFF;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:12px">${escapeHtml(t("emailButton"))}</a></p>
  <p style="margin:24px 0 0;color:#4B5C55;font-size:12px">${escapeHtml(t("emailFooter"))}</p>
</td></tr></table>
</td></tr></table>
</body></html>`;

  const text = [t("emailHeading", values), "", t("emailBody", values), "", `${t("emailButton")}: ${opts.link}`, "", t("emailFooter")].join("\n");
  return { subject: t("emailSubject", values), html, text };
}

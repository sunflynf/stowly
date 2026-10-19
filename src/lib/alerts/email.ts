import "server-only";
import { Resend } from "resend";

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(to: string, message: { subject: string; html: string; text: string }) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.ALERT_EMAIL_FROM ?? "Stowly <onboarding@resend.dev>",
    to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });
  if (error) throw new Error(error.message);
}

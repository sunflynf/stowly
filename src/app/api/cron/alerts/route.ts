import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { runAlertDigest } from "@/lib/alerts/digest";
import { emailConfigured } from "@/lib/alerts/email";
import { pushConfigured } from "@/lib/alerts/push";

// Called hourly by Supabase pg_cron (pg_net) or Vercel Cron with
// "Authorization: Bearer <CRON_SECRET>". Each user is processed in the hour
// matching their digest time in their own timezone.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

async function handle(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const force = request.nextUrl.searchParams.get("force") === "1";
  const dryRun = request.nextUrl.searchParams.get("dry") === "1";
  const results = await runAlertDigest({ force, dryRun });
  const sent = results.reduce((acc, r) => ({ email: acc.email + r.email, push: acc.push + r.push }), { email: 0, push: 0 });
  return NextResponse.json({
    ok: true,
    users: results.length,
    sent,
    channels: { email: emailConfigured(), push: pushConfigured() },
    results,
  });
}

export const GET = handle;
export const POST = handle;

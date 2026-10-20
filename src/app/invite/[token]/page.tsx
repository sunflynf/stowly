import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Home } from "lucide-react";
import { LanguageSwitcher } from "@/components/app-shell/language-switcher";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/lib/actions/auth";
import { getSupabaseServer } from "@/lib/supabase/server";
import { inviteTokenSchema } from "@/lib/validation/household";
import { AcceptInviteButton } from "./accept-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invite");
  return { title: t("title") };
}

// Reachable signed out: shows what the invite is for, then signs in or up with
// the invited email and comes back here to accept.
export default async function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const t = await getTranslations("invite");
  const tm = await getTranslations("members");
  const supabase = await getSupabaseServer();

  const valid = inviteTokenSchema.safeParse(token).success;
  const [{ data: preview }, { data: claims }] = await Promise.all([
    valid ? supabase.rpc("household_invite_preview", { p_token: token }) : Promise.resolve({ data: null }),
    supabase.auth.getClaims(),
  ]);
  const invite = preview?.[0] ?? null;
  const currentEmail = typeof claims?.claims.email === "string" ? claims.claims.email.toLowerCase() : null;
  const here = `/invite/${token}`;

  let body: React.ReactNode;
  if (!invite) {
    body = <p className="text-muted-foreground">{t("notFound")}</p>;
  } else if (invite.status !== "pending") {
    body = <p className="text-muted-foreground">{invite.status === "expired" ? t("expired") : t("used")}</p>;
  } else {
    const household = invite.household_name ?? tm("defaultName", { name: invite.owner_name ?? "" });
    const intro = (
      <>
        <p className="text-lg font-semibold">{t("heading", { inviter: invite.inviter_name ?? "", household })}</p>
        <p className="text-muted-foreground">{t("roleLine", { role: tm(`roles.${invite.role}`) })}</p>
        <p className="text-sm text-muted-foreground">{tm(`roleHints.${invite.role}`)}</p>
      </>
    );
    if (!currentEmail) {
      const email = encodeURIComponent(invite.email);
      const next = encodeURIComponent(here);
      body = (
        <>
          {intro}
          <p className="text-[15px]">{t("signedOutHint", { email: invite.email })}</p>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/login?mode=signup&email=${email}&next=${next}`}>{t("signUp")}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/login?email=${email}&next=${next}`}>{t("signIn")}</Link>
            </Button>
          </div>
        </>
      );
    } else if (currentEmail !== invite.email) {
      body = (
        <>
          {intro}
          <p role="alert" className="rounded-[var(--radius)] bg-warning px-3 py-2 text-sm font-medium text-warning-foreground">
            {t("wrongEmail", { email: invite.email, current: currentEmail })}
          </p>
          <form action={signOutAction}>
            <Button type="submit" variant="outline">
              {t("switchAccount")}
            </Button>
          </form>
        </>
      );
    } else {
      body = (
        <>
          {intro}
          <AcceptInviteButton token={token} />
        </>
      );
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-4 rounded-[var(--radius-lg)] border border-border bg-card p-5">
          <h1 className="text-xl font-bold">{t("title")}</h1>
          {body}
          {currentEmail && (
            <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary underline-offset-4 hover:underline">
              <Home className="size-4" aria-hidden />
              {t("goHome")}
            </Link>
          )}
        </div>
        <div className="mt-8 flex justify-center">
          <LanguageSwitcher />
        </div>
      </div>
    </main>
  );
}

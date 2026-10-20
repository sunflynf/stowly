"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, Download, LogOut, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { LanguageSwitcher } from "@/components/app-shell/language-switcher";
import { PageHeader } from "@/components/app-shell/page-header";
import { unwrap, useErrorToast, useInvalidateItems } from "@/components/items/use-item-mutations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { FontPicker } from "./font-picker";
import { DEFAULT_THEME, isThemePreference } from "@/lib/themes";
import { MembersSection } from "./members-section";
import { ThemePicker } from "./theme-picker";
import { signOutAction } from "@/lib/actions/auth";
import { sendTestPushAction, updateProfileAction } from "@/lib/actions/settings";
import { getPushState, subscribePush, unsubscribePush, type PushState } from "@/lib/push-client";
import { useProfile } from "@/lib/queries/stats";

function timeZones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return ["Asia/Ho_Chi_Minh", "Asia/Bangkok", "Asia/Singapore", "Asia/Tokyo", "Europe/London", "America/New_York", "UTC"];
  }
}

function PushControls() {
  const t = useTranslations("settingsPage.channels");
  const onError = useErrorToast();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    void getPushState().then((s) => alive && setState(s));
    return () => {
      alive = false;
    };
  }, []);

  const run = async (fn: () => Promise<PushState>) => {
    setBusy(true);
    try {
      setState(await fn());
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  if (state === null) return <Skeleton className="h-11 w-56" />;
  if (state === "unsupported") return <p className="text-sm text-muted-foreground">{t("pushUnsupported")}</p>;
  if (state === "not-configured") return <p className="text-sm text-muted-foreground">{t("pushNotConfigured")}</p>;
  if (state === "denied") return <p className="text-sm text-warning-foreground">{t("pushDenied")}</p>;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {state === "subscribed" ? (
        <>
          <span className="text-sm font-medium text-success-foreground">{t("pushEnabled")}</span>
          <Button
            variant="secondary"
            size="sm"
            disabled={busy}
            onClick={async () => {
              const r = await sendTestPushAction();
              if (r.ok && r.data.delivered > 0) toast.success(t("testSent"));
              else toast.error(t("testFailed"));
            }}
          >
            <Bell />
            {t("test")}
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => void run(unsubscribePush)}>
            {t("disablePush")}
          </Button>
        </>
      ) : (
        <Button variant="outline" disabled={busy} onClick={() => void run(subscribePush)}>
          <Bell />
          {t("enablePush")}
        </Button>
      )}
    </div>
  );
}

export function SettingsPage() {
  const t = useTranslations("settingsPage");
  const tn = useTranslations("nav");
  const qc = useQueryClient();
  const invalidate = useInvalidateItems();
  const onError = useErrorToast();
  const { data: profile } = useProfile();
  const zones = useMemo(() => timeZones(), []);
  const [newLead, setNewLead] = useState("");

  const save = useMutation({
    mutationFn: async (patch: Parameters<typeof updateProfileAction>[0]) => unwrap(await updateProfileAction(patch)),
    onSuccess: async () => {
      toast.success(t("saved"));
      await qc.invalidateQueries({ queryKey: ["profile"] });
      // Lead days and timezone change which alerts are active.
      await invalidate();
    },
    onError,
  });

  if (!profile) {
    return (
      <div className="mx-auto max-w-2xl">
        <PageHeader title={t("title")} />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const leads = profile.expiry_lead_days;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader title={t("title")} className="mb-0" />

      <MembersSection />

      <Card>
        <CardHeader>
          <CardTitle>{t("language.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <LanguageSwitcher />
          <p className="text-sm text-muted-foreground">{t("language.hint")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("appearance.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <ThemePicker value={isThemePreference(profile.theme) ? profile.theme : DEFAULT_THEME} />
          <p className="text-sm text-muted-foreground">{t("appearance.hint")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("font.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <FontPicker />
          <p className="text-sm text-muted-foreground">{t("font.hint")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("region.title")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field label={t("region.timezone")} htmlFor="tz" hint={t("region.timezoneHint")}>
            <NativeSelect id="tz" value={profile.timezone} onChange={(e) => save.mutate({ timezone: e.target.value })} aria-describedby="tz-hint">
              {zones.map((z) => (
                <option key={z} value={z}>
                  {z.replace(/_/g, " ")}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label={t("region.currency")} htmlFor="currency">
            <NativeSelect
              id="currency"
              value={profile.currency}
              onChange={(e) => save.mutate({ currency: e.target.value as "VND" | "USD" | "EUR" })}
            >
              <option value="VND">VND (₫)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </NativeSelect>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("alerts.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-sm font-semibold">{t("alerts.expiryLead")}</legend>
            <div className="flex flex-wrap items-center gap-2">
              {leads.map((d) => (
                <span key={d} className="inline-flex items-center gap-1 rounded-full bg-accent py-1 pr-1 pl-3 font-semibold text-accent-foreground">
                  {d}
                  <button
                    type="button"
                    disabled={leads.length <= 1 || save.isPending}
                    onClick={() => save.mutate({ expiry_lead_days: leads.filter((x) => x !== d) })}
                    aria-label={t("alerts.removeLead", { days: d })}
                    className="flex size-9 items-center justify-center rounded-full hover:bg-white/60 disabled:opacity-40"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </span>
              ))}
              {leads.length < 6 && (
                <form
                  className="flex items-center gap-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = Number(newLead);
                    if (Number.isInteger(n) && n >= 1 && n <= 365) {
                      save.mutate({ expiry_lead_days: [...leads, n] });
                      setNewLead("");
                    }
                  }}
                >
                  <Input
                    value={newLead}
                    onChange={(e) => setNewLead(e.target.value)}
                    inputMode="numeric"
                    aria-label={t("alerts.addLead")}
                    placeholder="14"
                    className="w-20"
                  />
                  <Button type="submit" variant="ghost" size="icon" aria-label={t("alerts.addLead")}>
                    <Plus />
                  </Button>
                </form>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{t("alerts.expiryLeadHint")}</p>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("alerts.warrantyLead")} htmlFor="wlead">
              <Input
                id="wlead"
                inputMode="numeric"
                defaultValue={profile.warranty_lead_days}
                onBlur={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isInteger(n) && n >= 1 && n <= 365 && n !== profile.warranty_lead_days) save.mutate({ warranty_lead_days: n });
                }}
              />
            </Field>
            <Field label={t("alerts.unusedAfter")} htmlFor="unused">
              <NativeSelect id="unused" value={profile.unused_after_days} onChange={(e) => save.mutate({ unused_after_days: Number(e.target.value) })}>
                {[90, 180, 365, 730, 1095].map((d) => (
                  <option key={d} value={d}>
                    {t("alerts.unusedOption", { days: d })}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field label={t("alerts.digestHour")} htmlFor="hour">
              <NativeSelect id="hour" value={profile.digest_hour} onChange={(e) => save.mutate({ digest_hour: Number(e.target.value) })}>
                {Array.from({ length: 24 }, (_, h) => (
                  <option key={h} value={h}>
                    {t("alerts.hour", { hour: String(h).padStart(2, "0") })}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("channels.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <label htmlFor="notify-email" className="font-medium">
                {t("channels.email")}
              </label>
              <p className="text-sm text-muted-foreground">{t("channels.emailHint", { email: profile.email })}</p>
            </div>
            <Switch id="notify-email" checked={profile.notify_email} onCheckedChange={(c) => save.mutate({ notify_email: c })} />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <label htmlFor="notify-push" className="font-medium">
                  {t("channels.push")}
                </label>
                <p className="text-sm text-muted-foreground">{t("channels.pushHint")}</p>
              </div>
              <Switch id="notify-push" checked={profile.notify_push} onCheckedChange={(c) => save.mutate({ notify_push: c })} />
            </div>
            {profile.notify_push && <PushControls />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("data.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <Link href="/import">
                <Upload />
                {t("data.import")}
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <a href="/api/export/items" download>
                <Download />
                {t("data.exportCsv")}
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/api/export/backup" download>
                <Download />
                {t("data.exportJson")}
              </a>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t("data.exportHint")}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("account.title")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[15px]">{t("account.signedInAs", { email: profile.email })}</p>
          <form action={signOutAction}>
            <Button type="submit" variant="secondary">
              <LogOut />
              {tn("signOut")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

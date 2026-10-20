"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Check, Copy, LogOut, Send, Trash2, UserMinus } from "lucide-react";
import { toast } from "sonner";
import { unwrap, useErrorToast } from "@/components/items/use-item-mutations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  changeMemberRoleAction,
  inviteMemberAction,
  leaveHouseholdAction,
  removeMemberAction,
  renameHouseholdAction,
  revokeInviteAction,
  switchHouseholdAction,
  updateDisplayNameAction,
} from "@/lib/actions/household";
import { useHousehold, useHouseholdName, useHouseholds, useInvites, useMembers } from "@/lib/queries/household";
import { qk } from "@/lib/queries/keys";
import { useProfile } from "@/lib/queries/stats";
import type { HouseholdRole } from "@/lib/types";
import { INVITE_ROLES, MEMBER_ROLES } from "@/lib/validation/household";

const ROLE_TONE = { owner: "success", editor: "neutral", viewer: "outline" } as const;

/** Everything shown is per household: after switching or leaving, drop every cached query. */
function useResetHousehold() {
  const qc = useQueryClient();
  const router = useRouter();
  return async () => {
    qc.clear();
    router.refresh();
  };
}

function InviteForm() {
  const t = useTranslations("members");
  const onError = useErrorToast();
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<(typeof INVITE_ROLES)[number]>("editor");
  const [result, setResult] = useState<{ email: string; link: string; emailed: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const invite = useMutation({
    mutationFn: async () => unwrap(await inviteMemberAction({ email, role })),
    onSuccess: async (data) => {
      setResult({ email: email.trim().toLowerCase(), ...data });
      setCopied(false);
      setEmail("");
      await qc.invalidateQueries({ queryKey: qk.invites });
    },
    onError,
  });

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">{t("inviteTitle")}</h3>
      <form
        className="grid gap-3 sm:grid-cols-[1fr_auto_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.trim()) invite.mutate();
        }}
      >
        <Field label={t("inviteEmail")} htmlFor="invite-email">
          <Input
            id="invite-email"
            type="email"
            inputMode="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ten@example.com"
          />
        </Field>
        <Field label={t("inviteRole")} htmlFor="invite-role">
          <NativeSelect id="invite-role" value={role} onChange={(e) => setRole(e.target.value as (typeof INVITE_ROLES)[number])}>
            {INVITE_ROLES.map((r) => (
              <option key={r} value={r}>
                {t(`roles.${r}`)}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Button type="submit" disabled={invite.isPending || !email.trim()}>
          <Send />
          {t("inviteSend")}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">{t(`roleHints.${role}`)}</p>
      {result && (
        <div role="status" className="flex flex-col gap-2 rounded-md bg-accent px-3 py-3 text-sm text-accent-foreground">
          <p className="font-medium">{result.emailed ? t("inviteSent", { email: result.email }) : t("inviteLinkOnly", { email: result.email })}</p>
          <div className="flex items-center gap-2">
            <Input readOnly value={result.link} aria-label={t("inviteLink")} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(result.link);
                  setCopied(true);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? <Check /> : <Copy />}
              {copied ? t("copied") : t("copy")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PendingInvites() {
  const t = useTranslations("members");
  const format = useFormatter();
  const onError = useErrorToast();
  const qc = useQueryClient();
  const { data: invites = [] } = useInvites(true);
  const revoke = useMutation({
    mutationFn: async (id: string) => unwrap(await revokeInviteAction(id)),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.invites }),
    onError,
  });
  if (!invites.length) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold">{t("pendingTitle")}</h3>
      <ul className="flex flex-col">
        {invites.map((i) => (
          <li key={i.id} className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0">
            <div className="min-w-0">
              <p className="truncate font-medium">{i.email}</p>
              <p className="text-sm text-muted-foreground">
                {t(`roles.${i.role}`)} ·{" "}
                {i.expired
                  ? t("inviteExpired")
                  : t("inviteExpires", { date: format.dateTime(new Date(i.expires_at), "short") })}
              </p>
            </div>
            <Button variant="ghost" size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate(i.id)}>
              <Trash2 />
              {t("revoke")}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MemberList({ isOwner, myId }: { isOwner: boolean; myId: string }) {
  const t = useTranslations("members");
  const tc = useTranslations("common");
  const onError = useErrorToast();
  const qc = useQueryClient();
  const { data: members, isPending } = useMembers();
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const owners = members?.filter((m) => m.role === "owner").length ?? 0;

  const refresh = () =>
    Promise.all([qc.invalidateQueries({ queryKey: qk.members }), qc.invalidateQueries({ queryKey: qk.households })]);
  const changeRole = useMutation({
    mutationFn: async (input: { userId: string; role: HouseholdRole }) => unwrap(await changeMemberRoleAction(input)),
    onSuccess: async () => {
      toast.success(t("roleChanged"));
      await refresh();
    },
    onError,
  });
  const remove = useMutation({
    mutationFn: async (userId: string) => unwrap(await removeMemberAction(userId)),
    onSuccess: async () => {
      setRemoving(null);
      toast.success(t("removed"));
      await refresh();
    },
    onError,
  });

  if (isPending || !members) return <Skeleton className="h-28" />;

  return (
    <>
      <ul className="flex flex-col" aria-label={t("title")}>
        {members.map((m) => {
          const me = m.user_id === myId;
          const lastOwner = m.role === "owner" && owners <= 1;
          return (
            <li key={m.user_id} className="flex flex-wrap items-center justify-between gap-3 border-b border-border py-3 last:border-0">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {m.display_name}
                  {me && <span className="text-muted-foreground"> ({t("you")})</span>}
                </p>
                <p className="truncate text-sm text-muted-foreground">{m.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {isOwner && !lastOwner ? (
                  <NativeSelect
                    aria-label={t("roleFor", { name: m.display_name })}
                    value={m.role}
                    disabled={changeRole.isPending}
                    onChange={(e) => changeRole.mutate({ userId: m.user_id, role: e.target.value as HouseholdRole })}
                    className="w-auto"
                  >
                    {MEMBER_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {t(`roles.${r}`)}
                      </option>
                    ))}
                  </NativeSelect>
                ) : (
                  <Badge tone={ROLE_TONE[m.role]}>{t(`roles.${m.role}`)}</Badge>
                )}
                {isOwner && !me && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("removeNamed", { name: m.display_name })}
                    onClick={() => setRemoving({ id: m.user_id, name: m.display_name })}
                  >
                    <UserMinus />
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <Dialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("remove")}</DialogTitle>
            <DialogDescription>{t("removeConfirm", { name: removing?.name ?? "" })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              {tc("cancel")}
            </Button>
            <Button variant="danger" disabled={remove.isPending} onClick={() => removing && remove.mutate(removing.id)}>
              {t("remove")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HouseholdSwitcher() {
  const t = useTranslations("members");
  const onError = useErrorToast();
  const reset = useResetHousehold();
  const label = useHouseholdName();
  const { data: households = [] } = useHouseholds();
  const switchTo = useMutation({
    mutationFn: async (id: string) => unwrap(await switchHouseholdAction(id)),
    onSuccess: async () => {
      toast.success(t("switched"));
      await reset();
    },
    onError,
  });
  if (households.length < 2) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold">{t("switchTitle")}</h3>
      <ul className="flex flex-col">
        {households.map((h) => (
          <li key={h.id} className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0">
            <div className="min-w-0">
              <p className="truncate font-medium">{label(h)}</p>
              <p className="text-sm text-muted-foreground">
                {t(`roles.${h.role}`)} · {t("memberCount", { count: h.members })}
              </p>
            </div>
            {h.active ? (
              <Badge tone="success">{t("current")}</Badge>
            ) : (
              <Button variant="outline" size="sm" disabled={switchTo.isPending} onClick={() => switchTo.mutate(h.id)}>
                {t("switch")}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MembersSection() {
  const t = useTranslations("members");
  const tc = useTranslations("common");
  const onError = useErrorToast();
  const qc = useQueryClient();
  const reset = useResetHousehold();
  const label = useHouseholdName();
  const { data: profile } = useProfile();
  const { household, isOwner, role } = useHousehold();
  const { data: members = [] } = useMembers();
  const [confirmLeave, setConfirmLeave] = useState(false);

  const rename = useMutation({
    mutationFn: async (name: string) => unwrap(await renameHouseholdAction(name)),
    onSuccess: async () => {
      toast.success(t("renamed"));
      await qc.invalidateQueries({ queryKey: qk.households });
    },
    onError,
  });
  const displayName = useMutation({
    mutationFn: async (name: string) => unwrap(await updateDisplayNameAction(name)),
    onSuccess: async () => {
      toast.success(t("displayNameSaved"));
      await Promise.all([qc.invalidateQueries({ queryKey: qk.profile }), qc.invalidateQueries({ queryKey: qk.households })]);
    },
    onError,
  });
  const leave = useMutation({
    mutationFn: async () => unwrap(await leaveHouseholdAction()),
    onSuccess: async () => {
      setConfirmLeave(false);
      toast.success(t("left"));
      await reset();
    },
    onError,
  });

  if (!household || !profile) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40" />
        </CardContent>
      </Card>
    );
  }

  const lastOwner = isOwner && members.filter((m) => m.role === "owner").length <= 1;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {isOwner ? (
            <Field label={t("householdName")} htmlFor="household-name" hint={t("householdNameHint")}>
              <Input
                id="household-name"
                key={household.name ?? ""}
                defaultValue={household.name ?? ""}
                placeholder={label({ name: null, owner_name: household.owner_name })}
                maxLength={80}
                aria-describedby="household-name-hint"
                onBlur={(e) => {
                  if (e.target.value.trim() !== (household.name ?? "")) rename.mutate(e.target.value);
                }}
              />
            </Field>
          ) : (
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold">{t("householdName")}</p>
              <p className="text-[15px]">{label(household)}</p>
              <p className="text-sm text-muted-foreground">{t("yourRole", { role: t(`roles.${role ?? "viewer"}`) })}</p>
            </div>
          )}
          <Field label={t("displayName")} htmlFor="display-name" hint={t("displayNameHint")}>
            <Input
              id="display-name"
              key={profile.display_name ?? ""}
              defaultValue={profile.display_name ?? ""}
              placeholder={profile.email.split("@")[0]}
              maxLength={60}
              aria-describedby="display-name-hint"
              onBlur={(e) => {
                if (e.target.value.trim() !== (profile.display_name ?? "")) displayName.mutate(e.target.value);
              }}
            />
          </Field>
        </div>

        <MemberList isOwner={isOwner} myId={profile.id} />

        {isOwner && (
          <>
            <InviteForm />
            <PendingInvites />
          </>
        )}

        <HouseholdSwitcher />

        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <div>
            <Button variant="outline" disabled={lastOwner} onClick={() => setConfirmLeave(true)}>
              <LogOut />
              {t("leave")}
            </Button>
          </div>
          {lastOwner && <p className="text-sm text-muted-foreground">{t("lastOwnerHint")}</p>}
        </div>

        <Dialog open={confirmLeave} onOpenChange={setConfirmLeave}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("leave")}</DialogTitle>
              <DialogDescription>{t("leaveConfirm", { name: label(household) })}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="secondary" onClick={() => setConfirmLeave(false)}>
                {tc("cancel")}
              </Button>
              <Button variant="danger" disabled={leave.isPending} onClick={() => leave.mutate()}>
                {t("leave")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

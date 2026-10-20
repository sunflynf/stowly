"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlarmClockOff, BellRing, Boxes, ShoppingCart } from "lucide-react";
import { GroupMeter } from "@/components/groups/group-meter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useFormats } from "@/lib/hooks/use-format";
import type { GroupAlert } from "@/lib/queries/groups";

export function GroupAlertCard({
  alert,
  onShopping,
  onSnooze,
}: {
  alert: GroupAlert;
  onShopping: () => void;
  onSnooze: (days: number) => void;
}) {
  const t = useTranslations("alerts");
  const tg = useTranslations("groups");
  const ts = useTranslations("status");
  const f = useFormats();
  return (
    <li className="rounded-md border border-border bg-card p-4">
      <Link href={`/groups/${alert.id}`} className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Boxes className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold break-words hover:underline">{alert.name}</span>
          <span className="text-sm text-muted-foreground">
            {tg("badge")} · {tg("members", { count: alert.members })}
          </span>
        </span>
        <Badge tone={alert.kind === "out_of_stock" ? "danger" : "warning"}>{ts(alert.kind === "out_of_stock" ? "out_of_stock" : "low_stock")}</Badge>
      </Link>
      <GroupMeter group={alert} className="mt-3" />
      {alert.snoozed && alert.snoozed_until && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
          <BellRing className="size-4" aria-hidden />
          {t("snoozedUntil", { date: f.date(alert.snoozed_until) })}
        </p>
      )}
      <div role="group" aria-label={t("actions.group", { name: alert.name })} className="mt-3 flex flex-wrap gap-2">
        {alert.snoozed ? (
          <Button variant="secondary" size="sm" onClick={() => onSnooze(0)}>
            <BellRing />
            {t("actions.unsnooze")}
          </Button>
        ) : (
          <>
            <Button variant="secondary" size="sm" onClick={onShopping}>
              <ShoppingCart />
              {t("actions.addToShopping")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onSnooze(7)}>
              <AlarmClockOff />
              {t("actions.snooze")}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

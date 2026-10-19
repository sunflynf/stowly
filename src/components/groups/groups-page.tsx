"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Boxes, Plus } from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGroups } from "@/lib/queries/groups";
import { GroupDialog } from "./group-dialog";
import { GroupMeter } from "./group-meter";

export function GroupsPage() {
  const t = useTranslations("groups");
  const ts = useTranslations("status");
  const { data: groups, isPending } = useGroups();
  const [creating, setCreating] = useState(false);

  const addButton = (
    <Button onClick={() => setCreating(true)}>
      <Plus />
      {t("add")}
    </Button>
  );

  return (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} actions={addButton} />
      <div className="mb-4 md:hidden">{addButton}</div>
      {isPending ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : !groups?.length ? (
        <p className="rounded-[var(--radius-lg)] border border-border bg-card p-8 text-center text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {groups.map((g) => {
            const low = g.min_quantity !== null && g.total <= g.min_quantity;
            return (
              <li key={g.id}>
                <Link
                  href={`/groups/${g.id}`}
                  className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-border bg-card p-4 hover:border-input"
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-accent text-accent-foreground">
                        <Boxes className="size-5" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{g.name}</span>
                        <span className="text-sm text-muted-foreground">{t("members", { count: g.members })}</span>
                      </span>
                    </span>
                    {low && <Badge tone={g.total === 0 ? "danger" : "warning"}>{ts(g.total === 0 ? "out_of_stock" : "low_stock")}</Badge>}
                  </span>
                  <GroupMeter group={g} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
      {creating && <GroupDialog open onOpenChange={setCreating} />}
    </>
  );
}

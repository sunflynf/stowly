"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { acceptInviteAction } from "@/lib/actions/household";

export function AcceptInviteButton({ token }: { token: string }) {
  const t = useTranslations();
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <Button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await acceptInviteAction(token);
            if (!result.ok) {
              setError(t(`errors.${result.error}`));
              return;
            }
            // Everything cached belonged to the previous household.
            qc.clear();
            router.push("/");
          })
        }
      >
        {t("invite.accept")}
      </Button>
      {error && (
        <p role="alert" className="text-sm font-medium text-danger-foreground">
          {error}
        </p>
      )}
    </div>
  );
}

"use client";

import { useTimeZone, useTranslations } from "next-intl";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { CanEdit } from "@/components/app-shell/can-edit";
import { StatusBadge } from "@/components/items/status-badge";
import { unwrap, useErrorToast, useInvalidateItems } from "@/components/items/use-item-mutations";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { endLoanAction, startLoanAction } from "@/lib/actions/loans";
import { daysBetween, todayIn } from "@/lib/dates";
import { useFormats } from "@/lib/hooks/use-format";
import { alertStatus } from "@/lib/status";
import { loanOf, type Loan, type LoanKind } from "@/lib/validation/loans";

/** Status badge for a loan's due date, from the same rules as the alerts. */
export function useLoanStatus() {
  const timeZone = useTimeZone() ?? "Asia/Ho_Chi_Minh";
  return (loan: Loan) => {
    if (!loan.due) return null;
    const days = daysBetween(todayIn(timeZone), loan.due);
    if (loan.kind === "lent") return days < 0 ? alertStatus({ kind: "lent_overdue", severity: 2, days_left: days }) : null;
    return days <= 7 ? alertStatus({ kind: "borrow_due", severity: days < 0 ? 3 : 2, days_left: days }) : null;
  };
}

export function LoanDialog({ itemId, kind, onClose }: { itemId: string; kind: LoanKind; onClose: () => void }) {
  const t = useTranslations("loans");
  const tc = useTranslations("common");
  const onError = useErrorToast();
  const invalidate = useInvalidateItems();
  const [person, setPerson] = useState("");
  const [due, setDue] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      unwrap(await startLoanAction({ itemId, kind, person, due, note }));
      toast.success(kind === "lent" ? t("lentToast", { person: person.trim() }) : t("borrowedToast", { person: person.trim() }));
      await invalidate(itemId);
      onClose();
    } catch (e) {
      onError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (person.trim()) void save();
          }}
        >
          <DialogHeader>
            <DialogTitle>{kind === "lent" ? t("lend") : t("borrow")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <Field label={kind === "lent" ? t("lentTo") : t("borrowedFrom")} htmlFor="loan-person">
              <Input id="loan-person" value={person} onChange={(e) => setPerson(e.target.value)} maxLength={80} autoFocus />
            </Field>
            <Field label={kind === "lent" ? t("dueBack") : t("giveBackBy")} htmlFor="loan-due" hint={t("dueHint")}>
              <Input id="loan-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-describedby="loan-due-hint" />
            </Field>
            <Field label={t("note")} htmlFor="loan-note">
              <Input id="loan-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={onClose}>
              {tc("cancel")}
            </Button>
            <Button type="submit" disabled={busy || !person.trim()}>
              {tc("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Return button shared by the item card and the loans page. */
export function EndLoanButton({ itemId, loan, size = "sm" }: { itemId: string; loan: Loan; size?: "sm" | "default" }) {
  const t = useTranslations("loans");
  const onError = useErrorToast();
  const invalidate = useInvalidateItems();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      variant="secondary"
      size={size}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          unwrap(await endLoanAction(itemId));
          toast.success(loan.kind === "lent" ? t("returnedToast") : t("givenBackToast"));
          await invalidate(itemId);
        } catch (e) {
          onError(e);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Undo2 />
      {loan.kind === "lent" ? t("markReturned") : t("markGivenBack")}
    </Button>
  );
}

/** Loan state on the item page: who has it (or whom we owe it), since when, until when. */
export function LoanCard({ itemId, attributes }: { itemId: string; attributes: unknown }) {
  const t = useTranslations("loans");
  const f = useFormats();
  const status = useLoanStatus();
  const loan = loanOf(attributes);
  const [starting, setStarting] = useState<LoanKind | null>(null);
  const badge = loan ? status(loan) : null;

  return (
    <section className="rounded-md border border-border bg-card p-4 md:p-5" aria-labelledby="item-loan">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 id="item-loan" className="font-semibold">
          {t("title")}
        </h2>
        {badge && <StatusBadge status={badge} />}
      </div>
      {loan ? (
        <>
          <p className="text-[15px]">{loan.kind === "lent" ? t("lentNow", { person: loan.person }) : t("borrowedNow", { person: loan.person })}</p>
          <p className="text-sm text-muted-foreground">
            {[
              loan.since ? t("since", { date: f.date(loan.since) }) : null,
              loan.due ? (loan.kind === "lent" ? t("dueBackOn", { date: f.date(loan.due) }) : t("giveBackOn", { date: f.date(loan.due) })) : t("noDue"),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <CanEdit>
            <div className="mt-3">
              <EndLoanButton itemId={itemId} loan={loan} />
            </div>
          </CanEdit>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">{t("none")}</p>
          <CanEdit>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setStarting("lent")}>
                <ArrowUpRight />
                {t("lend")}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setStarting("borrowed")}>
                <ArrowDownLeft />
                {t("borrow")}
              </Button>
            </div>
          </CanEdit>
        </>
      )}
      {starting && <LoanDialog itemId={itemId} kind={starting} onClose={() => setStarting(null)} />}
    </section>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError, FieldHint, Label } from "@/components/ui/label";
import { magicLinkAction, signInAction, signUpAction } from "@/lib/actions/auth";
import { useValidationMessage } from "@/lib/hooks/use-validation-message";
import { signUpSchema } from "@/lib/validation/auth";
import { z } from "zod";

type Mode = "signin" | "signup";

const formSchema = z.object({
  email: z.string().trim().min(1, "required").email("email"),
  password: z.string(),
});
type FormValues = z.infer<typeof formSchema>;

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations();
  const vm = useValidationMessage();
  const [mode, setMode] = useState<Mode>("signin");
  const [message, setMessage] = useState<{ tone: "error" | "info"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit((values) => {
    setMessage(null);
    if (mode === "signup") {
      const parsed = signUpSchema.safeParse(values);
      if (!parsed.success) {
        form.setError("password", { message: parsed.error.issues[0]?.message });
        return;
      }
    } else if (!values.password) {
      form.setError("password", { message: "required" });
      return;
    }
    startTransition(async () => {
      const result = mode === "signin" ? await signInAction(values, next) : await signUpAction(values);
      if (!result.ok) {
        setMessage({ tone: "error", text: t(`errors.${result.error}`) });
      } else if (mode === "signup") {
        setMessage({ tone: "info", text: t("auth.signUpDone") });
      }
    });
  });

  const sendMagicLink = () => {
    setMessage(null);
    void form.trigger("email").then((valid) => {
      if (!valid) return;
      const email = form.getValues("email");
      startTransition(async () => {
        const result = await magicLinkAction({ email }, next);
        setMessage(
          result.ok
            ? { tone: "info", text: t("auth.magicLinkSent", { email }) }
            : { tone: "error", text: t(`errors.${result.error}`) },
        );
      });
    });
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-border bg-card p-5">
      <h2 className="mb-4 text-lg font-semibold">{mode === "signin" ? t("auth.title") : t("auth.createAccount")}</h2>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">{t("auth.email")}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            {...form.register("email")}
          />
          <FieldError id="email-error" message={vm(errors.email?.message)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">{t("auth.password")}</Label>
          <Input
            id="password"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? "password-error" : "password-hint"}
            {...form.register("password")}
          />
          {mode === "signup" && !errors.password && <FieldHint id="password-hint">{t("auth.passwordHint")}</FieldHint>}
          <FieldError id="password-error" message={vm(errors.password?.message)} />
        </div>

        {message && (
          <p
            role={message.tone === "error" ? "alert" : "status"}
            className={
              message.tone === "error"
                ? "rounded-[var(--radius)] bg-danger px-3 py-2 text-sm font-medium text-danger-foreground"
                : "rounded-[var(--radius)] bg-accent px-3 py-2 text-sm font-medium text-accent-foreground"
            }
          >
            {message.text}
          </p>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? t("auth.signingIn") : mode === "signin" ? t("auth.signIn") : t("auth.signUp")}
        </Button>
      </form>

      {mode === "signin" && (
        <>
          <div className="my-4 flex items-center gap-3 text-sm text-muted-foreground" aria-hidden>
            <span className="h-px flex-1 bg-border" />
            {t("auth.or")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="outline" className="w-full" disabled={pending} onClick={sendMagicLink}>
            <Mail />
            {t("auth.magicLink")}
          </Button>
        </>
      )}

      <p className="mt-5 text-center text-sm text-muted-foreground">
        {mode === "signin" ? t("auth.noAccount") : t("auth.haveAccount")}{" "}
        <button
          type="button"
          className="inline-flex min-h-11 items-center font-semibold text-primary underline-offset-4 hover:underline"
          onClick={() => {
            setMessage(null);
            form.clearErrors();
            setMode(mode === "signin" ? "signup" : "signin");
          }}
        >
          {mode === "signin" ? t("auth.createAccount") : t("auth.backToSignIn")}
        </button>
      </p>
    </div>
  );
}

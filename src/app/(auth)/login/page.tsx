import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "./login-form";
import { LanguageSwitcher } from "@/components/app-shell/language-switcher";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("title") };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const linkError = params.error === "link";
  const t = await getTranslations();

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-[var(--radius)] bg-primary text-primary-foreground">
            <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" />
              <path d="m3 8 9 5 9-5M12 13v8" />
            </svg>
          </span>
          <div>
            <h1 className="text-2xl font-bold">{t("app.name")}</h1>
            <p className="text-sm text-muted-foreground">{t("auth.subtitle")}</p>
          </div>
        </div>
        {linkError && (
          <p role="alert" className="mb-4 rounded-[var(--radius)] bg-danger px-4 py-3 text-sm font-medium text-danger-foreground">
            {t("auth.linkInvalid")}
          </p>
        )}
        <LoginForm next={next} />
        <div className="mt-8 flex justify-center">
          <LanguageSwitcher />
        </div>
      </div>
    </main>
  );
}

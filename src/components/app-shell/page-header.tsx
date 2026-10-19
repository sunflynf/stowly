"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileMenu } from "./mobile-menu";

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  /** Primary actions (shown right on desktop, below the title on phones unless `compactActions`). */
  actions?: React.ReactNode;
  /** Sub-page: phones get a compact top bar with a back button. */
  back?: string | true;
  /** Extra action shown in the mobile top bar (e.g. a "more" menu). */
  mobileAction?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, back, mobileAction, className }: PageHeaderProps) {
  const t = useTranslations("common");
  const router = useRouter();

  const goBack = () => {
    if (typeof back === "string") router.push(back);
    else if (window.history.length > 1) router.back();
    else router.push("/");
  };

  return (
    <>
      {back && (
        <div className="sticky top-0 z-30 -mx-4 mb-3 flex h-14 items-center justify-between gap-2 border-b border-border bg-card px-1 md:hidden print:hidden">
          <button
            type="button"
            onClick={goBack}
            aria-label={t("back")}
            className="flex size-11 items-center justify-center rounded-full hover:bg-muted"
          >
            <ChevronLeft className="size-6" aria-hidden />
          </button>
          <p className="truncate text-base font-semibold">{title}</p>
          <div className="flex size-11 items-center justify-center">{mobileAction}</div>
        </div>
      )}
      <header
        className={cn(
          "mb-5 flex flex-wrap items-start justify-between gap-3",
          back && "hidden md:flex",
          className,
        )}
      >
        <div className="min-w-0 flex-1">
          {back && (
            <button
              type="button"
              onClick={goBack}
              className="mb-1 hidden min-h-9 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground md:inline-flex"
            >
              <ChevronLeft className="size-4" aria-hidden />
              {t("back")}
            </button>
          )}
          <h1 className="text-[26px] leading-tight font-bold md:text-[30px]">{title}</h1>
          {subtitle && <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>}
        </div>
        <div className="flex items-center gap-2">
          {actions && <div className="hidden items-center gap-2 md:flex">{actions}</div>}
          {!back && <MobileMenu />}
        </div>
      </header>
    </>
  );
}

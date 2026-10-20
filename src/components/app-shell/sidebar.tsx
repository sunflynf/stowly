"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo";
import { isActive, primaryNav, secondaryNav, settingsNav, type NavItem } from "./nav-config";
import { useNavCounts } from "./use-nav-counts";

function NavLink({ item, count }: { item: NavItem; count?: number }) {
  const t = useTranslations("nav");
  const format = useFormatter();
  const pathname = usePathname();
  const search = useSearchParams();
  const active = isActive(item, pathname, search);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-[15px] font-medium transition-colors",
        active ? "bg-accent font-semibold text-accent-foreground" : "text-foreground hover:bg-muted",
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden />
      <span className="flex-1 leading-tight">{t(item.label)}</span>
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-neutral-foreground tabular-nums">
          {format.number(count, "integer")}
        </span>
      )}
    </Link>
  );
}

export function Sidebar() {
  const t = useTranslations();
  const counts = useNavCounts();

  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-card md:flex print:hidden">
      <Link href="/" className="flex items-center gap-3 px-5 pt-6 pb-6">
        <LogoMark />
        <span className="text-xl font-bold">{t("app.name")}</span>
      </Link>
      <nav aria-label={t("nav.mainMenu")} className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
        {primaryNav.map((item) => (
          <NavLink key={item.label} item={item} count={item.count ? counts[item.count] : undefined} />
        ))}
        <div className="my-3 h-px bg-border" role="separator" />
        {secondaryNav.map((item) => (
          <NavLink key={item.label} item={item} count={item.count ? counts[item.count] : undefined} />
        ))}
      </nav>
      <div className="flex flex-col gap-2 border-t border-border px-3 py-4">
        <NavLink item={settingsNav} />
        <form action={signOutAction}>
          <button
            type="submit"
            className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-[15px] font-medium text-muted-foreground hover:bg-muted"
          >
            <LogOut className="size-[18px]" aria-hidden />
            {t("nav.signOut")}
          </button>
        </form>
      </div>
    </aside>
  );
}

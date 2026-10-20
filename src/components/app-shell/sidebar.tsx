"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";
import { cn } from "@/lib/utils";
import { LogoMark } from "./logo";
import { isActive, primaryNav, secondaryNav, settingsNav, type NavItem } from "./nav-config";
import { useNavCounts } from "./use-nav-counts";

const COLLAPSED_KEY = "stowly.sidebar.collapsed";

// The signed-in app renders after hydration (ClientGate), so reading storage in the initializer is safe.
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function NavLink({ item, count, collapsed }: { item: NavItem; count?: number; collapsed: boolean }) {
  const t = useTranslations("nav");
  const format = useFormatter();
  const pathname = usePathname();
  const search = useSearchParams();
  const active = isActive(item, pathname, search);
  const Icon = item.icon;
  const hasCount = count !== undefined && count > 0;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      title={collapsed ? t(item.label) : undefined}
      className={cn(
        "relative flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-[15px] font-medium transition-colors",
        collapsed && "justify-center px-0",
        active ? "bg-accent font-semibold text-accent-foreground" : "text-foreground hover:bg-muted",
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden />
      {collapsed ? (
        <>
          <span className="sr-only">{t(item.label)}</span>
          {hasCount && <span className="absolute top-1.5 right-2 size-2 rounded-full bg-primary" aria-hidden />}
        </>
      ) : (
        <>
          <span className="flex-1 leading-tight">{t(item.label)}</span>
          {hasCount && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-neutral-foreground tabular-nums">
              {format.number(count, "integer")}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

export function Sidebar() {
  const t = useTranslations();
  const counts = useNavCounts();
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // Not remembered when storage is unavailable.
    }
  };

  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const toggleLabel = collapsed ? t("nav.expandSidebar") : t("nav.collapseSidebar");

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-card transition-[width] duration-150 md:flex print:hidden",
        collapsed ? "w-[4.5rem]" : "w-60",
      )}
    >
      <div className={cn("flex items-center pt-6 pb-6", collapsed ? "flex-col gap-3 px-2" : "justify-between gap-2 px-5")}>
        <Link href="/" className="flex min-w-0 items-center gap-3" aria-label={collapsed ? t("app.name") : undefined}>
          <LogoMark />
          {!collapsed && <span className="truncate text-xl font-bold">{t("app.name")}</span>}
        </Link>
        <button
          type="button"
          onClick={toggle}
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          title={toggleLabel}
          className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ToggleIcon className="size-5" aria-hidden />
        </button>
      </div>
      <nav aria-label={t("nav.mainMenu")} className="flex flex-1 flex-col gap-1 overflow-y-auto px-3">
        {primaryNav.map((item) => (
          <NavLink key={item.label} item={item} collapsed={collapsed} count={item.count ? counts[item.count] : undefined} />
        ))}
        <div className="my-3 h-px bg-border" role="separator" />
        {secondaryNav.map((item) => (
          <NavLink key={item.label} item={item} collapsed={collapsed} count={item.count ? counts[item.count] : undefined} />
        ))}
      </nav>
      <div className="flex flex-col gap-2 border-t border-border px-3 py-4">
        <NavLink item={settingsNav} collapsed={collapsed} />
        <form action={signOutAction}>
          <button
            type="submit"
            title={collapsed ? t("nav.signOut") : undefined}
            className={cn(
              "flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-[15px] font-medium text-muted-foreground hover:bg-muted",
              collapsed && "justify-center px-0",
            )}
          >
            <LogOut className="size-[18px]" aria-hidden />
            {collapsed ? <span className="sr-only">{t("nav.signOut")}</span> : t("nav.signOut")}
          </button>
        </form>
      </div>
    </aside>
  );
}

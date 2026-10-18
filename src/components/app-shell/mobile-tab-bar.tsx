"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Bell, LayoutGrid, MapPin, Package, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavCounts } from "./use-nav-counts";

const tabs = [
  { href: "/", label: "overview", icon: LayoutGrid, exact: true },
  { href: "/items", label: "itemsShort", icon: Package },
  { href: "/locations", label: "locations", icon: MapPin },
  { href: "/alerts", label: "alerts", icon: Bell },
] as const;

export function MobileTabBar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const counts = useNavCounts();

  const renderTab = (tab: (typeof tabs)[number]) => {
    const active = "exact" in tab ? pathname === tab.href : pathname.startsWith(tab.href) && pathname !== "/items/new";
    const Icon = tab.icon;
    const badge = tab.href === "/alerts" ? counts.attention : undefined;
    return (
      <Link
        key={tab.href}
        href={tab.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium",
          active ? "font-semibold text-primary" : "text-muted-foreground",
        )}
      >
        <Icon className="size-[22px]" aria-hidden />
        <span>{t(tab.label)}</span>
        {badge ? (
          <span className="absolute top-1.5 left-1/2 ml-1.5 min-w-5 rounded-full bg-danger-solid px-1 text-center text-[11px] leading-5 font-semibold text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <nav
      aria-label={t("mainMenu")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-safe md:hidden"
    >
      <div className="mx-auto flex max-w-lg items-stretch">
        {renderTab(tabs[0])}
        {renderTab(tabs[1])}
        <div className="flex flex-1 items-start justify-center">
          <Link
            href="/items/new"
            aria-label={t("addItem")}
            className="-mt-5 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background"
          >
            <Plus className="size-7" aria-hidden />
          </Link>
        </div>
        {renderTab(tabs[2])}
        {renderTab(tabs[3])}
      </div>
    </nav>
  );
}

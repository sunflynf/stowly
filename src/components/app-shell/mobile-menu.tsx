"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Boxes, ChartColumn, Clock, Sparkles, Layers, LogOut, Menu, Settings, ShoppingCart, Tag } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { signOutAction } from "@/lib/actions/auth";
import { LanguageSwitcher } from "./language-switcher";
import { EXPIRING_HREF, STOCK_HREF } from "./nav-config";

const links = [
  { href: "/shopping", label: "shopping", icon: ShoppingCart },
  { href: EXPIRING_HREF, label: "expiring", icon: Clock },
  { href: STOCK_HREF, label: "stock", icon: Layers },
  { href: "/groups", label: "groups", icon: Boxes },
  { href: "/stats", label: "stats", icon: ChartColumn },
  { href: "/suggestions", label: "suggestions", icon: Sparkles },
  { href: "/categories", label: "categories", icon: Tag },
  { href: "/settings", label: "settings", icon: Settings },
] as const;

/** Secondary navigation on phones (the bottom bar only fits five targets). */
export function MobileMenu() {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={t("mainMenu")}
          className="flex size-11 items-center justify-center rounded-[var(--radius)] border border-border bg-card md:hidden"
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </DialogTrigger>
      <DialogContent side="bottom">
        <DialogTitle className="mb-3">{t("mainMenu")}</DialogTitle>
        <nav className="flex flex-col gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="flex min-h-12 items-center gap-3 rounded-[var(--radius)] px-3 text-base font-medium hover:bg-muted"
            >
              <Icon className="size-5 text-muted-foreground" aria-hidden />
              {t(label)}
            </Link>
          ))}
        </nav>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
          <LanguageSwitcher />
          <form action={signOutAction}>
            <button type="submit" className="flex min-h-11 items-center gap-2 rounded-[var(--radius)] px-3 font-medium text-muted-foreground hover:bg-muted">
              <LogOut className="size-5" aria-hidden />
              {t("signOut")}
            </button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import {
  Bell,
  Boxes,
  ChartColumn,
  Sparkles,
  Clock,
  LayoutGrid,
  Layers,
  MapPin,
  Package,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tag,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Messages } from "@/lib/messages-type";

export type NavKey = keyof Messages["nav"];
export type NavCount = "items" | "expiring" | "lowStock" | "attention";

export interface NavItem {
  href: string;
  label: NavKey;
  icon: LucideIcon;
  count?: NavCount;
  /** Path prefix that marks the item active (defaults to href). */
  match?: (pathname: string, search: URLSearchParams) => boolean;
}

export const EXPIRING_HREF = "/items?states=expired,expiring_soon&sort=expiry";
export const STOCK_HREF = "/items?states=out_of_stock,low_stock&sort=low_stock";

export const primaryNav: NavItem[] = [
  { href: "/", label: "overview", icon: LayoutGrid, match: (p) => p === "/" },
  {
    href: "/items",
    label: "items",
    icon: Package,
    count: "items",
    match: (p, s) => p.startsWith("/items") && !s.get("states"),
  },
  { href: "/locations", label: "locations", icon: MapPin },
  {
    href: EXPIRING_HREF,
    label: "expiring",
    icon: Clock,
    count: "expiring",
    match: (p, s) => p === "/items" && (s.get("states") ?? "").includes("expir"),
  },
  {
    href: STOCK_HREF,
    label: "stock",
    icon: Layers,
    count: "lowStock",
    match: (p, s) => p === "/items" && (s.get("states") ?? "").includes("stock"),
  },
  { href: "/categories", label: "categories", icon: Tag },
];

export const secondaryNav: NavItem[] = [
  { href: "/alerts", label: "alerts", icon: Bell, count: "attention" },
  { href: "/maintenance", label: "maintenance", icon: Wrench },
  { href: "/groups", label: "groups", icon: Boxes },
  { href: "/shopping", label: "shopping", icon: ShoppingCart },
  { href: "/stats", label: "stats", icon: ChartColumn },
  { href: "/reports/insurance", label: "insurance", icon: ShieldCheck },
  { href: "/suggestions", label: "suggestions", icon: Sparkles },
  { href: "/settings", label: "settings", icon: Settings },
];

export function isActive(item: NavItem, pathname: string, search: URLSearchParams) {
  if (item.match) return item.match(pathname, search);
  return pathname === item.href || pathname.startsWith(item.href + "/");
}

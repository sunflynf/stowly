import {
  Apple,
  Baby,
  BedDouble,
  BookOpen,
  Car,
  Dumbbell,
  Gift,
  House,
  Laptop,
  Package,
  Pencil,
  Pill,
  Plug,
  Shirt,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICONS = {
  package: Package,
  shirt: Shirt,
  "bed-double": BedDouble,
  laptop: Laptop,
  pencil: Pencil,
  "book-open": BookOpen,
  apple: Apple,
  house: House,
  wrench: Wrench,
  baby: Baby,
  dumbbell: Dumbbell,
  pill: Pill,
  sparkles: Sparkles,
  gift: Gift,
  car: Car,
  plug: Plug,
} satisfies Record<string, LucideIcon>;

export type CategoryIconName = keyof typeof CATEGORY_ICONS;
export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICONS) as [CategoryIconName, ...CategoryIconName[]];

export function categoryIcon(name: string | null | undefined): LucideIcon {
  return (name && CATEGORY_ICONS[name as CategoryIconName]) || Package;
}

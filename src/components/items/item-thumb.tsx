"use client";

import { cn } from "@/lib/utils";

/** Photo thumbnail, or the item's first letter on a neutral tile. */
export function ItemThumb({
  name,
  url,
  size = "md",
  className,
}: {
  name: string;
  url?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = size === "sm" ? "size-10 text-sm" : size === "lg" ? "size-16 text-xl" : "size-12 text-base";
  const letter = name.trim().charAt(0).toLocaleUpperCase() || "?";
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-muted font-semibold text-neutral-foreground",
        dims,
        className,
      )}
      aria-hidden
    >
      {url ? (
        // Signed Supabase URLs: plain <img> avoids the image optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" loading="lazy" decoding="async" />
      ) : (
        letter
      )}
    </span>
  );
}

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

// Status badges always carry text; color only reinforces it.
const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[13px] font-semibold",
  {
    variants: {
      tone: {
        danger: "bg-danger text-danger-foreground",
        warning: "bg-warning text-warning-foreground",
        neutral: "bg-neutral text-neutral-foreground",
        success: "bg-success text-success-foreground",
        outline: "border border-border bg-card text-muted-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

function Badge({ className, tone, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export { Badge, badgeVariants };

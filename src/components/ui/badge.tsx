import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary-muted text-primary-muted-foreground",
        secondary: "bg-secondary text-secondary-foreground border border-border",
        warning:
          "bg-warning-muted text-warning-muted-foreground border border-amber-300",
        destructive:
          "bg-destructive-muted text-destructive-muted-foreground border border-red-300",
        info: "bg-info-muted text-info-muted-foreground border border-blue-300",
        outline: "border border-border text-foreground bg-card",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}


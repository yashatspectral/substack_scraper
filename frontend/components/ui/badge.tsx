import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { clsx } from "clsx";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border border-transparent px-4 py-1 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-slate-300 focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "bg-white text-slate-900 border-slate-200 shadow-sm",
        glow:
          "bg-gradient-to-r from-indigo-500/10 via-sky-500/10 to-purple-500/10 text-slate-700 border-transparent"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={clsx(badgeVariants({ variant }), className)} {...props} />
  );
}

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide uppercase",
  {
    variants: {
      variant: {
        default: "border-line bg-bg-elevated text-ink-dim",
        leaf:    "border-leaf/30 bg-leaf-soft/40 text-leaf",
        amber:   "border-amber/30 bg-amber-soft/40 text-amber",
        plum:    "border-plum/30 bg-plum-soft/40 text-plum",
        sky:     "border-sky/30 bg-sky-soft/40 text-sky",
        rust:    "border-rust/30 bg-rust-soft/40 text-rust",
        outline: "border-line bg-transparent text-ink-dim",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = ({ className, variant, ...p }: BadgeProps) => (
  <span className={cn(badgeVariants({ variant, className }))} {...p} />
);

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, hint, action, className }: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "glass relative flex flex-col items-center justify-center gap-3 rounded-2xl px-8 py-14 text-center",
        className,
      )}
    >
      <div className="grid h-12 w-12 place-items-center rounded-full border border-line bg-bg-elevated text-leaf">
        {icon ?? <span className="text-xl">∅</span>}
      </div>
      <div className="text-base font-medium tracking-tight">{title}</div>
      {hint && <p className="max-w-sm text-sm text-ink-dim">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}

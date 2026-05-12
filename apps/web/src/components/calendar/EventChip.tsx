import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { eventTypeMeta } from "@/lib/events";
import type { CalendarEvent } from "@/lib/types";

interface EventChipProps {
  ev: CalendarEvent;
  compact?: boolean;
  onClick?: () => void;
  highlighted?: boolean;
}

export function EventChip({ ev, compact, onClick, highlighted }: EventChipProps) {
  const meta = eventTypeMeta[ev.type];
  return (
    <motion.button
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      style={{ ["--c" as any]: ev.color || `hsl(var(--${meta.color}))` }}
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-full border border-line/80 bg-bg-elevated/60 px-2 py-0.5 text-[11px] font-medium text-ink transition",
        "hover:border-[color:var(--c)] hover:bg-[color:var(--c)]/10",
        highlighted && "border-[color:var(--c)] bg-[color:var(--c)]/15 text-ink",
        compact && "text-[10px] px-1.5 py-[1px]",
      )}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: "var(--c)" }}
      />
      <span className="truncate max-w-[10rem]">{ev.title}</span>
    </motion.button>
  );
}

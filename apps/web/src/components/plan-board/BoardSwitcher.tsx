import { motion } from "framer-motion";
import {
  Megaphone, Leaf, Share2, Rocket, CalendarHeart, ChefHat,
  BookOpen, BellRing, Users, Layers,
} from "lucide-react";
import type { BoardSummary, BoardType } from "@/lib/types";
import { BOARDS } from "@/lib/plan";

// =====================================================================
//  BoardSwitcher — left-rail selector for the nine operational pipelines.
//
//  Editorial intent: this is the "table of contents" for the farmer's
//  work. Each board gets a distinct lucide icon, a count, and a quiet
//  red dot when something on that board is overdue. The current board
//  is marked with a left-edge leaf accent and a subtle glass elevation.
//  A "Все доски" entry at the top is the unfiltered view.
// =====================================================================

interface Props {
  active: BoardType | null; // null = "all boards"
  summaries: BoardSummary[];
  onChange: (board: BoardType | null) => void;
}

// Icon map kept here so the lib layer stays free of lucide imports.
const ICONS: Record<BoardType, React.ComponentType<{ className?: string }>> = {
  campaign:     Megaphone,
  seasonal:     Leaf,
  social:       Share2,
  launch:       Rocket,
  event:        CalendarHeart,
  recipe:       ChefHat,
  storytelling: BookOpen,
  push:         BellRing,
  community:    Users,
};

export function BoardSwitcher({ active, summaries, onChange }: Props) {
  // Build a quick lookup so we don't iterate 9× per board entry.
  const summaryByType = new Map(summaries.map((s) => [s.board_type, s]));
  const totalActive = summaries.reduce((n, s) => n + s.active, 0);
  const totalOverdue = summaries.reduce((n, s) => n + s.overdue, 0);

  return (
    <aside className="sticky top-4 flex w-full flex-col gap-1 self-start lg:w-60">
      <div className="mb-2 px-3">
        <div className="smallcaps text-[10px] text-ink-mute">операционная панель</div>
        <h2 className="mt-1 font-display text-base font-semibold">Доски</h2>
      </div>

      <BoardEntry
        Icon={Layers}
        label="Все доски"
        active={active === null}
        total={totalActive}
        overdue={totalOverdue}
        onClick={() => onChange(null)}
      />

      <div className="mx-3 my-1 h-px bg-line/60" />

      {BOARDS.map((b) => {
        const Icon = ICONS[b.type];
        const sum = summaryByType.get(b.type);
        return (
          <BoardEntry
            key={b.type}
            Icon={Icon}
            label={b.label}
            active={active === b.type}
            total={sum?.active ?? 0}
            overdue={sum?.overdue ?? 0}
            onClick={() => onChange(b.type)}
          />
        );
      })}
    </aside>
  );
}

function BoardEntry({
  Icon, label, active, total, overdue, onClick,
}: {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  total: number;
  overdue: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
        active
          ? "bg-bg-elevated text-ink"
          : "text-ink-dim hover:bg-bg-subtle/60 hover:text-ink"
      }`}
    >
      {active && (
        <motion.span
          layoutId="board-active-rail"
          className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-leaf shadow-glow"
          transition={{ type: "spring", stiffness: 380, damping: 30 }}
        />
      )}
      <span
        className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors ${
          active ? "bg-leaf/15 text-leaf" : "bg-bg-subtle text-ink-mute group-hover:text-ink-dim"
        }`}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="flex-1 truncate">{label}</span>
      <span className="flex items-center gap-1.5">
        {overdue > 0 && (
          <span
            className="grid h-4 min-w-[16px] place-items-center rounded-full bg-rust/20 px-1 text-[9px] font-mono text-rust"
            title={`${overdue} просрочено`}
          >
            {overdue}
          </span>
        )}
        <span
          className={`grid h-4 min-w-[16px] place-items-center rounded-full px-1 text-[10px] font-mono tnum ${
            active ? "bg-leaf/15 text-leaf" : "bg-bg-subtle text-ink-mute"
          }`}
        >
          {total}
        </span>
      </span>
    </button>
  );
}

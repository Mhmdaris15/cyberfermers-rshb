import { motion } from "framer-motion";
import { Archive, BellRing, CalendarClock, Check, Clock, Flame, Pencil, Sparkles, XCircle } from "lucide-react";

import type { GeneratedContent } from "@/lib/types";
import {
  DISPATCH_META, pushBodyText, pushDispatchSentAt, pushDispatchStatus,
  pushHeadline, pushIconEmoji, pushScheduledFor, pushSegments,
  pushUrgency, URGENCY_META,
} from "@/lib/push";

// =====================================================================
//  PushCard — "device-y" card. The headline + body render in the same
//  short shape they'll appear on a real lock screen, with the urgency
//  surface (left border accent) doing the visual work of saying "this
//  matters". Dispatch status is the lead pill — it tells the operator
//  what state the push is in right now.
// =====================================================================

export function PushCard({ push, onOpen }: { push: GeneratedContent; onOpen: () => void }) {
  const headline    = pushHeadline(push);
  const body        = pushBodyText(push);
  const icon        = pushIconEmoji(push);
  const urgency     = pushUrgency(push);
  const segments    = pushSegments(push);
  const scheduled   = pushScheduledFor(push);
  const dispatch    = pushDispatchStatus(push);
  const sentAt      = pushDispatchSentAt(push);
  const ai          = !push.is_user_edited;
  const urgMeta     = URGENCY_META[urgency];
  const dispMeta    = DISPATCH_META[dispatch];

  // Left-edge urgency accent — the visual hook for "this matters NOW"
  // for critical pushes, calmer tone for normal ones.
  const accent =
    urgency === "critical" ? "bg-rust"
    : urgency === "high"   ? "bg-amber"
    : "bg-ink-mute/40";

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 320, damping: 26 }}
      className="group relative flex w-full overflow-hidden rounded-2xl border border-line bg-bg-elevated/50 text-left transition-shadow hover:shadow-glass focus-ring"
    >
      {/* urgency accent rail */}
      <div className={`w-1 ${accent}`} aria-hidden />

      <div className="flex flex-1 flex-col gap-2 px-4 py-3.5">
        {/* top row — emoji + headline + status */}
        <div className="flex items-start gap-2">
          {icon && (
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-bg-subtle text-base">
              {icon}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-1 text-sm font-semibold text-ink">
              {headline}
            </h3>
            {body && (
              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-ink-dim">
                {body}
              </p>
            )}
          </div>
          <span className="shrink-0">
            <DispatchPill dispatch={dispatch} />
          </span>
        </div>

        {/* meta row — urgency, schedule, segments */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {urgency !== "normal" && (
            <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] ${urgMeta.tone}`}>
              {urgency === "critical" ? <Flame className="h-2.5 w-2.5" /> : <BellRing className="h-2.5 w-2.5" />}
              {urgMeta.label}
            </span>
          )}
          {scheduled && (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky/30 bg-sky/10 px-1.5 py-0.5 text-[10px] text-sky">
              <CalendarClock className="h-2.5 w-2.5" />
              {scheduled.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {sentAt && dispatch === "sent" && (
            <span className="inline-flex items-center gap-1 rounded-full border border-leaf/30 bg-leaf/10 px-1.5 py-0.5 text-[10px] text-leaf">
              <Check className="h-2.5 w-2.5" />
              {sentAt.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {segments.slice(0, 2).map((s) => (
            <span key={s} className="inline-flex items-center rounded-full border border-plum/30 bg-plum/10 px-1.5 py-0.5 text-[10px] text-plum">
              {s}
            </span>
          ))}
          {segments.length > 2 && (
            <span className="text-[10px] text-ink-mute">+{segments.length - 2}</span>
          )}
        </div>

        {/* bottom strip — status pill, author marker, version */}
        <div className="mt-auto flex items-center justify-between border-t border-line/40 pt-2 text-[11px] text-ink-mute">
          <div className="flex items-center gap-1.5">
            <StatusPill status={push.status ?? "draft"} />
            <span className="inline-flex items-center gap-1 text-[10px]">
              {ai ? <Sparkles className="h-2.5 w-2.5 text-amber" /> : <Pencil className="h-2.5 w-2.5 text-leaf" />}
              {ai ? "AI" : "автор"}
            </span>
          </div>
          {(push.current_revision ?? 1) > 1 && (
            <span className="font-mono">v{push.current_revision}</span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// ─── pieces ───────────────────────────────────────────────────────────────

function DispatchPill({ dispatch }: { dispatch: keyof typeof DISPATCH_META }) {
  const meta = DISPATCH_META[dispatch];
  const Icon = dispatch === "sent" ? Check
    : dispatch === "failed" ? XCircle
    : dispatch === "sending" ? Clock
    : Clock;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] ${meta.tone}`}>
      <Icon className="h-2.5 w-2.5" />
      {meta.label}
    </span>
  );
}

function StatusPill({ status }: { status: NonNullable<GeneratedContent["status"]> }) {
  if (status === "published") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-leaf/40 bg-leaf/10 px-1.5 py-0.5 text-[10px] text-leaf">
        <span className="h-1 w-1 rounded-full bg-leaf" />
        опубл.
      </span>
    );
  }
  if (status === "archived") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-line bg-bg-subtle px-1.5 py-0.5 text-[10px] text-ink-mute">
        <Archive className="h-2.5 w-2.5" />
        архив
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber/40 bg-amber/10 px-1.5 py-0.5 text-[10px] text-amber">
      <span className="h-1 w-1 rounded-full bg-amber" />
      черновик
    </span>
  );
}

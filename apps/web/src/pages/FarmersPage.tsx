import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowUpRight, Brain, Calendar, MapPin, Search, Sprout, Store } from "lucide-react";

import { listFarmers } from "@/lib/api";
import type { Farmer } from "@/lib/types";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";
import { Button } from "@/components/ui/button";
import { formatInt } from "@/lib/utils";

// =================================================================
//  Farmers picker — editorial directory of every farmer in the
//  marketplace. Acts as a switch-board for the demo: pick a farmer,
//  the rest of the app re-keys to that org_id.
// =================================================================
export function FarmersPage() {
  const farmers = useQuery({
    queryKey: ["farmers", "with_counts"],
    queryFn: () => listFarmers({ withCounts: true }),
    staleTime: 60_000,
  });

  const [q, setQ] = useState("");
  const [region, setRegion] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);

  const allRegions = useMemo(() => {
    const s = new Set<string>();
    (farmers.data ?? []).forEach((f) => f.region && s.add(f.region));
    return Array.from(s).sort();
  }, [farmers.data]);

  const allCategories = useMemo(() => {
    const s = new Set<string>();
    (farmers.data ?? []).forEach((f) => (f.categories ?? []).forEach((c) => s.add(c)));
    return Array.from(s).sort();
  }, [farmers.data]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (farmers.data ?? []).filter((f) => {
      if (region && f.region !== region) return false;
      if (category && !(f.categories ?? []).includes(category)) return false;
      if (!needle) return true;
      const hay = `${f.shop_name} ${f.description ?? ""} ${f.region}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [farmers.data, q, region, category]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14">
      <header className="mb-8 flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <Link to="/" className="smallcaps text-[11px] text-ink-mute hover:text-ink">
            ← На главную
          </Link>
        </div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="smallcaps text-[11px] text-ink-mute">Directory</span>
            <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight md:text-5xl">
              Каталог фермеров
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-ink-dim">
              Выберите ферму для перехода в её AI-кабинет. Каждый фермер видит свой собственный
              календарь событий, подбор SKU и план кампаний.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="leaf" className="tnum">
              {filtered.length} / {farmers.data?.length ?? "—"}
            </Badge>
          </div>
        </div>
      </header>

      {/* ── controls ────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по имени, региону, описанию…"
            className="h-11 w-full rounded-lg border border-line bg-bg-elevated/70 pl-9 pr-3 text-sm placeholder:text-ink-mute focus-ring"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Pill active={region === null} onClick={() => setRegion(null)}>
            Все регионы
          </Pill>
          {allRegions.map((r) => (
            <Pill key={r} active={region === r} onClick={() => setRegion(r === region ? null : r)}>
              <MapPin className="h-3 w-3" />
              {r}
            </Pill>
          ))}
        </div>
      </div>

      {allCategories.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <span className="smallcaps text-[10px] text-ink-mute">Категории</span>
          <Pill active={category === null} onClick={() => setCategory(null)}>
            все
          </Pill>
          {allCategories.map((c) => (
            <Pill key={c} active={category === c} onClick={() => setCategory(c === category ? null : c)}>
              {c}
            </Pill>
          ))}
        </div>
      )}

      {/* ── grid ────────────────────────────────────────────── */}
      {farmers.isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Sprout className="h-5 w-5" />}
          title="Никого не найдено"
          hint="Сбросьте фильтры или измените запрос."
          action={
            <Button
              variant="ghost"
              onClick={() => {
                setQ("");
                setRegion(null);
                setCategory(null);
              }}
            >
              Сбросить
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((f, i) => (
            <FarmerCard key={f.id} f={f} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function FarmerCard({ f, index }: { f: Farmer; index: number }) {
  const desc = (f.description ?? "").trim().slice(0, 180);
  const showDots = (f.description ?? "").length > 180;
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.35 }}
      className="card-hover"
    >
      <Link to={`/farmer/${f.organization_id}/dashboard`} className="block focus-ring rounded-2xl">
        <Card className="group relative h-full overflow-hidden">
          {/* atmospheric blob seeded by organization_id so it stays stable */}
          <div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-25 blur-3xl"
            style={{ background: blobColor(f.organization_id) }}
          />
          <CardContent className="flex h-full flex-col gap-3 pt-5">
            <header className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-bg-elevated text-leaf">
                  <Store className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-display text-lg font-semibold leading-tight">
                    {f.shop_name}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-ink-mute">
                    <MapPin className="h-3 w-3" /> {f.region}
                    <span className="opacity-50">·</span>
                    <span className="font-mono">#{f.organization_id}</span>
                  </div>
                </div>
              </div>
              <ArrowUpRight className="h-4 w-4 text-ink-mute transition group-hover:text-leaf" />
            </header>

            <p className="line-clamp-2 min-h-[2.4rem] text-sm leading-relaxed text-ink-dim">
              {desc}
              {showDots && "…"}
            </p>

            <ScoreRow
              ai={f.ai_readiness_score ?? 0}
              opp={f.seasonal_opportunity_score ?? 0}
            />

            <div className="mt-auto flex items-end justify-between gap-3 pt-2">
              <div className="flex flex-wrap gap-1">
                {(f.categories ?? []).slice(0, 3).map((c) => (
                  <span
                    key={c}
                    className="rounded-md border border-line bg-bg-elevated/60 px-1.5 py-0.5 text-[10px] text-ink-mute"
                  >
                    {c}
                  </span>
                ))}
                {(f.categories?.length ?? 0) > 3 && (
                  <span className="text-[10px] text-ink-mute">+{(f.categories?.length ?? 0) - 3}</span>
                )}
              </div>
              <div className="flex flex-col items-end">
                <span className="font-display tnum text-2xl font-semibold leading-none text-ink">
                  {formatInt(f.product_count ?? 0)}
                </span>
                <span className="smallcaps text-[9px] text-ink-mute">SKU</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  );
}

// Two compact gauges shown on each farmer card.
function ScoreRow({ ai, opp }: { ai: number; opp: number }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-line/70 bg-bg-subtle/40 px-3 py-2">
      <Gauge
        label="AI готовность"
        value={ai}
        tone="leaf"
        icon={<Brain className="h-3 w-3" />}
        hint="% SKU с тегами"
      />
      <div className="h-6 w-px bg-line/70" aria-hidden />
      <Gauge
        label="Сезонный потенциал"
        value={opp}
        tone="amber"
        icon={<Calendar className="h-3 w-3" />}
        hint="событий в 60 дней"
      />
    </div>
  );
}

function Gauge({
  label,
  value,
  tone,
  icon,
  hint,
}: {
  label: string;
  value: number;
  tone: "leaf" | "amber";
  icon: React.ReactNode;
  hint: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const cls = tone === "leaf" ? "text-leaf" : "text-amber";
  const bar = tone === "leaf" ? "bg-leaf" : "bg-amber";
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex items-center gap-1 smallcaps text-[9px] text-ink-mute">
        <span className={cls}>{icon}</span>
        <span className="truncate" title={hint}>{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`font-mono tnum text-sm font-medium leading-none ${cls}`}>{pct}</span>
        <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-bg-elevated">
          <div className={`absolute inset-y-0 left-0 rounded-full ${bar}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition ${
        active
          ? "border-leaf/60 bg-leaf/15 text-leaf"
          : "border-line bg-bg-elevated/60 text-ink-dim hover:border-ink-mute/40 hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

// Stable pseudo-random tint per organization_id; keeps every card visually
// distinguishable without manually assigning colours.
function blobColor(seed: number): string {
  const palette = ["--leaf", "--amber", "--plum", "--sky", "--rust"];
  return `hsl(var(${palette[seed % palette.length]}))`;
}

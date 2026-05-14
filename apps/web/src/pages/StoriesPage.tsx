import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Plus } from "lucide-react";

import { listFarmerStories } from "@/lib/stories";
import { StoryCard } from "@/components/stories/StoryCard";
import { StoryEditorDrawer } from "@/components/stories/StoryEditorDrawer";
import type { ContentStatus, GeneratedContent } from "@/lib/types";

// =====================================================================
//  StoriesPage — magazine-style grid of farmer stories with status
//  filter chips and a "новая история" CTA. Selecting a card opens the
//  editor drawer (read + edit + lifecycle); the CTA opens it in
//  create mode (storyID === "new").
// =====================================================================

const FILTERS: { id: ContentStatus | "all"; label: string }[] = [
  { id: "all",       label: "Все" },
  { id: "draft",     label: "Черновики" },
  { id: "published", label: "Опубликованы" },
  { id: "archived",  label: "Архив" },
];

export function StoriesPage() {
  const { farmerId = "10060" } = useParams();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [drawer, setDrawer] = useState<string | "new" | null>(null);

  const q = useQuery({
    queryKey: ["stories", farmerId, filter],
    queryFn: () => listFarmerStories(farmerId, filter === "all" ? undefined : filter),
  });

  const counts = useMemo(() => countByStatus(q.data ?? []), [q.data]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="smallcaps text-[10px] text-plum">storytelling</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Истории фермы
          </h1>
          <p className="max-w-xl text-sm text-ink-dim">
            Эмоциональные тексты от лица фермера. ИИ предлагает черновики
            к&nbsp;событиям, а&nbsp;вы дорабатываете и&nbsp;публикуете.
          </p>
        </div>
        <button
          onClick={() => setDrawer("new")}
          className="flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Новая история
        </button>
      </header>

      {/* status filter chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => {
          const count = f.id === "all"
            ? counts.all
            : counts[f.id];
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors ${
                active
                  ? "border-leaf/60 bg-leaf/10 text-leaf"
                  : "border-line bg-bg-elevated text-ink-dim hover:bg-bg-subtle"
              }`}
            >
              <span>{f.label}</span>
              <span className={`rounded-full px-1.5 text-[10px] font-mono ${active ? "bg-leaf/15" : "bg-bg-subtle"}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* grid */}
      {q.isLoading ? (
        <Grid>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-72 animate-pulse rounded-2xl bg-bg-elevated/50" />
          ))}
        </Grid>
      ) : (q.data?.length ?? 0) === 0 ? (
        <Empty onCreate={() => setDrawer("new")} />
      ) : (
        <Grid>
          {q.data!.map((s) => (
            <StoryCard
              key={s.id}
              story={s}
              onOpen={() => s.id && setDrawer(s.id)}
            />
          ))}
        </Grid>
      )}

      <StoryEditorDrawer
        storyID={drawer}
        farmerID={farmerId}
        onClose={() => setDrawer(null)}
      />
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {children}
    </div>
  );
}

function Empty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line bg-bg-elevated/30 px-6 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-plum/15 text-plum">
        <BookOpen className="h-5 w-5" />
      </div>
      <div>
        <h2 className="font-display text-lg">Пока ни одной истории</h2>
        <p className="mt-1 max-w-sm text-sm text-ink-dim">
          Создайте первую — расскажите о&nbsp;ферме, о&nbsp;продукте,
          о&nbsp;человеке за прилавком. Истории — самый сильный канал
          доверия.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110"
      >
        <Plus className="h-4 w-4" />
        Написать первую историю
      </button>
    </div>
  );
}

function countByStatus(list: GeneratedContent[]) {
  const out = { all: list.length, draft: 0, published: 0, archived: 0 };
  for (const s of list) {
    const k = (s.status ?? "draft") as keyof typeof out;
    if (k in out) (out as Record<string, number>)[k]++;
  }
  return out;
}

import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Share2 } from "lucide-react";

import { listFarmerSocialPosts } from "@/lib/social";
import { SocialCard } from "@/components/social/SocialCard";
import { SocialPostEditorDrawer } from "@/components/social/SocialPostEditorDrawer";
import type { ContentStatus, GeneratedContent } from "@/lib/types";

// =====================================================================
//  SocialPage — Instagram-tile grid. Same filter pattern as the prose
//  modules; cards are square-cover and surface platform icons + slide
//  count + scheduled date.
// =====================================================================

const FILTERS: { id: ContentStatus | "all"; label: string }[] = [
  { id: "all",       label: "Все" },
  { id: "draft",     label: "Черновики" },
  { id: "published", label: "Опубликованы" },
  { id: "archived",  label: "Архив" },
];

export function SocialPage() {
  const { farmerId = "10060" } = useParams();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [drawer, setDrawer] = useState<string | "new" | null>(null);

  const q = useQuery({
    queryKey: ["social", farmerId, filter],
    queryFn: () => listFarmerSocialPosts(farmerId, filter === "all" ? undefined : filter),
  });

  const counts = useMemo(() => countByStatus(q.data ?? []), [q.data]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="smallcaps text-[10px] text-sky">social</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Соцсети
          </h1>
          <p className="max-w-xl text-sm text-ink-dim">
            Карусели и&nbsp;тексты для Instagram, Telegram и&nbsp;VK с
            предпросмотром в&nbsp;Instagram-стиле, лимитами символов
            по&nbsp;каждой платформе и&nbsp;расписанием.
          </p>
        </div>
        <button
          onClick={() => setDrawer("new")}
          className="flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Новый пост
        </button>
      </header>

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => {
          const count = f.id === "all" ? counts.all : counts[f.id];
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

      {q.isLoading ? (
        <Grid>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-bg-elevated/50" />
          ))}
        </Grid>
      ) : (q.data?.length ?? 0) === 0 ? (
        <Empty onCreate={() => setDrawer("new")} />
      ) : (
        <Grid>
          {q.data!.map((p) => (
            <SocialCard
              key={p.id}
              post={p}
              onOpen={() => p.id && setDrawer(p.id)}
            />
          ))}
        </Grid>
      )}

      <SocialPostEditorDrawer
        postID={drawer}
        farmerID={farmerId}
        onClose={() => setDrawer(null)}
      />
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  // Tighter grid (4 cols at xl) because square covers tile well.
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {children}
    </div>
  );
}

function Empty({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line bg-bg-elevated/30 px-6 py-16 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-sky/15 text-sky">
        <Share2 className="h-5 w-5" />
      </div>
      <div>
        <h2 className="font-display text-lg">Пока без постов</h2>
        <p className="mt-1 max-w-sm text-sm text-ink-dim">
          Создайте первый — карусель из&nbsp;3-5 слайдов с&nbsp;историей
          одного продукта работает лучше всего. Платформы можно
          выбирать по&nbsp;ситуации.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110"
      >
        <Plus className="h-4 w-4" />
        Создать первый пост
      </button>
    </div>
  );
}

function countByStatus(list: GeneratedContent[]) {
  const out = { all: list.length, draft: 0, published: 0, archived: 0 };
  for (const p of list) {
    const k = (p.status ?? "draft") as keyof typeof out;
    if (k in out) (out as Record<string, number>)[k]++;
  }
  return out;
}

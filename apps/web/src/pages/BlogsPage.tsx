import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { BookText, Plus } from "lucide-react";

import { listFarmerBlogs } from "@/lib/blogs";
import { BlogCard } from "@/components/blogs/BlogCard";
import { BlogEditorDrawer } from "@/components/blogs/BlogEditorDrawer";
import type { ContentStatus, GeneratedContent } from "@/lib/types";

// =====================================================================
//  BlogsPage — long-form archive. Same filter+grid shape as Stories,
//  but cards lead with reading time and lede, not hero image.
// =====================================================================

const FILTERS: { id: ContentStatus | "all"; label: string }[] = [
  { id: "all",       label: "Все" },
  { id: "draft",     label: "Черновики" },
  { id: "published", label: "Опубликованы" },
  { id: "archived",  label: "Архив" },
];

export function BlogsPage() {
  const { farmerId = "10060" } = useParams();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [drawer, setDrawer] = useState<string | "new" | null>(null);

  const q = useQuery({
    queryKey: ["blogs", farmerId, filter],
    queryFn: () => listFarmerBlogs(farmerId, filter === "all" ? undefined : filter),
  });

  const counts = useMemo(() => countByStatus(q.data ?? []), [q.data]);

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
        <div>
          <div className="smallcaps text-[10px] text-sky">blog</div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Журнал фермы
          </h1>
          <p className="max-w-xl text-sm text-ink-dim">
            Длинные статьи и&nbsp;экспертные материалы. Они закрепляют
            авторитет в&nbsp;категории и&nbsp;собирают органический трафик
            из&nbsp;поиска.
          </p>
        </div>
        <button
          onClick={() => setDrawer("new")}
          className="flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110"
        >
          <Plus className="h-4 w-4" />
          Новая статья
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
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-80 animate-pulse rounded-2xl bg-bg-elevated/50" />
          ))}
        </Grid>
      ) : (q.data?.length ?? 0) === 0 ? (
        <Empty onCreate={() => setDrawer("new")} />
      ) : (
        <Grid>
          {q.data!.map((b) => (
            <BlogCard
              key={b.id}
              blog={b}
              onOpen={() => b.id && setDrawer(b.id)}
            />
          ))}
        </Grid>
      )}

      <BlogEditorDrawer
        blogID={drawer}
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
      <div className="grid h-12 w-12 place-items-center rounded-full bg-sky/15 text-sky">
        <BookText className="h-5 w-5" />
      </div>
      <div>
        <h2 className="font-display text-lg">Журнал пустой</h2>
        <p className="mt-1 max-w-sm text-sm text-ink-dim">
          Напишите первую статью — экспертный материал, который ферма может
          опубликовать на&nbsp;сайте и&nbsp;в&nbsp;соцсетях. Хорошие тексты
          живут годами.
        </p>
      </div>
      <button
        onClick={onCreate}
        className="flex items-center gap-2 rounded-md bg-leaf px-3.5 py-2 text-sm font-medium text-bg shadow-glow transition-all hover:brightness-110"
      >
        <Plus className="h-4 w-4" />
        Написать первую статью
      </button>
    </div>
  );
}

function countByStatus(list: GeneratedContent[]) {
  const out = { all: list.length, draft: 0, published: 0, archived: 0 };
  for (const b of list) {
    const k = (b.status ?? "draft") as keyof typeof out;
    if (k in out) (out as Record<string, number>)[k]++;
  }
  return out;
}

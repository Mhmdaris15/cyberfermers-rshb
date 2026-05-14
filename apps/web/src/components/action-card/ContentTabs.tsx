import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import type { Channel, GeneratedContent } from "@/lib/types";
import { Sparkles } from "lucide-react";
import { ContentLifecycleBar } from "./ContentLifecycleBar";

const channels: { id: Channel; label: string }[] = [
  { id: "push",   label: "Пуш" },
  { id: "story",  label: "Сторис" },
  { id: "blog",   label: "Блог" },
  { id: "recipe", label: "Рецепт" },
  { id: "chat",   label: "Чат" },
  { id: "social", label: "Соцсети" },
];

interface ContentTabsProps {
  content: GeneratedContent[];
  loading?: boolean;
}

// =================================================================
//  ContentTabs — tabs for each channel × variant. The data flattens
//  by `(channel, variant)`, so we first bucket per channel, then let
//  the user flip between A/B/C variants if multiple exist.
// =================================================================
export function ContentTabs({ content, loading }: ContentTabsProps) {
  const byChannel = useMemo(() => {
    const m: Record<string, GeneratedContent[]> = {};
    for (const c of content) {
      if (!m[c.channel]) m[c.channel] = [];
      m[c.channel].push(c);
    }
    for (const k of Object.keys(m)) m[k].sort((a, b) => a.variant - b.variant);
    return m;
  }, [content]);

  return (
    <Tabs defaultValue="push" className="w-full">
      <TabsList className="overflow-x-auto">
        {channels.map((c) => {
          const variants = byChannel[c.id] ?? [];
          return (
            <TabsTrigger key={c.id} value={c.id} className="flex-shrink-0">
              {c.label}
              {variants.length > 0 && (
                <span className="ml-1 rounded-full bg-leaf/20 px-1.5 text-[10px] font-medium tnum text-leaf">
                  {variants.length}
                </span>
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
      {channels.map((c) => (
        <TabsContent key={c.id} value={c.id}>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (byChannel[c.id]?.length ?? 0) === 0 ? (
            <EmptyState
              icon={<Sparkles className="h-5 w-5" />}
              title="Контент ещё не сгенерирован"
              hint="Нажмите «Сгенерировать кампанию» — Gemini создаст драфт для всех каналов одновременно."
            />
          ) : (
            <VariantStack channel={c.id} items={byChannel[c.id]!} />
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

// VariantStack — header chips to flip variants, body renders selected one.
function VariantStack({ channel, items }: { channel: Channel; items: GeneratedContent[] }) {
  const [idx, setIdx] = useState(0);
  const safeIdx = Math.min(idx, items.length - 1);
  const variantLabel = (n: number) => String.fromCharCode(65 + n); // 0→A, 1→B, …
  return (
    <div className="space-y-3">
      {items.length > 1 && (
        <div className="flex items-center gap-2">
          <span className="smallcaps text-[10px] text-ink-mute">Вариант</span>
          <div className="flex gap-1">
            {items.map((it, i) => (
              <button
                key={it.variant}
                onClick={() => setIdx(i)}
                className={cn(
                  "h-7 w-7 rounded-md border text-[11px] font-mono transition",
                  i === safeIdx
                    ? "border-leaf bg-leaf-soft/40 text-leaf"
                    : "border-line bg-bg-elevated text-ink-dim hover:text-ink",
                )}
                aria-label={`Вариант ${variantLabel(it.variant)}`}
              >
                {variantLabel(it.variant)}
              </button>
            ))}
          </div>
        </div>
      )}
      <RenderChannel channel={channel} body={items[safeIdx].body} />
      <ContentLifecycleBar content={items[safeIdx]} />
    </div>
  );
}

function RenderChannel({ channel, body }: { channel: Channel; body: Record<string, any> }) {
  switch (channel) {
    case "push":
      return (
        <Card>
          <CardContent className="space-y-2 pt-5">
            <div className="smallcaps text-[10px] text-ink-mute">Push</div>
            <div className="font-display text-lg font-semibold">{body.title}</div>
            <p className="text-sm text-ink-dim">{body.body}</p>
          </CardContent>
        </Card>
      );
    case "story":
      return (
        <Card>
          <CardContent className="space-y-2 pt-5">
            <div className="smallcaps text-[10px] text-ink-mute">Story</div>
            <p className="text-sm text-ink">{body.caption}</p>
            <div className="rounded-md border border-line bg-bg-subtle p-3 text-[11px] font-mono text-ink-dim">
              image_prompt → {body.image_prompt}
            </div>
          </CardContent>
        </Card>
      );
    case "blog":
      return (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="smallcaps text-[10px] text-ink-mute">Blog</div>
            <h3 className="font-display text-xl font-semibold">{body.title}</h3>
            <p className="text-sm italic text-ink-dim">{body.lede}</p>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{body.body}</p>
            {Array.isArray(body.hashtags) && body.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {body.hashtags.map((h: string) => (
                  <Badge key={h} variant="leaf">#{h.replace(/^#/, "")}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      );
    case "recipe":
      return (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="smallcaps text-[10px] text-ink-mute">Recipe</div>
            <h3 className="font-display text-lg font-semibold">{body.name}</h3>
            <div className="flex gap-3 text-xs text-ink-dim">
              <span>выход: {body.yield}</span>
              <span>· время: {body.time}</span>
            </div>
            <div>
              <div className="mb-1 smallcaps text-[10px] text-ink-mute">Ингредиенты</div>
              <ul className="space-y-1 text-sm text-ink">
                {(body.ingredients ?? []).map((i: string, idx: number) => (
                  <li key={idx} className="before:mr-2 before:text-leaf before:content-['•']">{i}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-1 smallcaps text-[10px] text-ink-mute">Шаги</div>
              <ol className="space-y-2 text-sm text-ink">
                {(body.steps ?? []).map((s: string, idx: number) => (
                  <li key={idx} className="flex gap-2">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-leaf-soft text-[11px] font-medium text-leaf">{idx + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          </CardContent>
        </Card>
      );
    case "chat":
      return (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="flex items-center justify-between">
              <div className="smallcaps text-[10px] text-ink-mute">Chat</div>
              <Badge variant="plum">{body.segment}</Badge>
            </div>
            <div className="rounded-2xl rounded-tl-sm border border-line bg-bg-elevated p-4 text-sm">{body.message}</div>
          </CardContent>
        </Card>
      );
    case "social":
      return (
        <Card>
          <CardContent className="space-y-3 pt-5">
            <div className="smallcaps text-[10px] text-ink-mute">Social · Telegram</div>
            <div className="font-display text-lg font-semibold">{body.title}</div>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{body.text}</p>
            {Array.isArray(body.hashtags) && body.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {body.hashtags.map((h: string) => (
                  <Badge key={h} variant="amber">#{h.replace(/^#/, "")}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      );
  }
  return null;
}

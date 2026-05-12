import { useMemo } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty";
import type { Channel, GeneratedContent } from "@/lib/types";
import { Sparkles } from "lucide-react";

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
  onGenerate?: () => void;
}

export function ContentTabs({ content, loading, onGenerate }: ContentTabsProps) {
  const map = useMemo(() => {
    const m: Record<string, GeneratedContent | undefined> = {};
    for (const c of content) m[c.channel] = c;
    return m;
  }, [content]);

  return (
    <Tabs defaultValue="push" className="w-full">
      <TabsList className="overflow-x-auto">
        {channels.map((c) => (
          <TabsTrigger key={c.id} value={c.id} className="flex-shrink-0">
            {c.label}
            {map[c.id] && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-leaf" />}
          </TabsTrigger>
        ))}
      </TabsList>
      {channels.map((c) => (
        <TabsContent key={c.id} value={c.id}>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : map[c.id] ? (
            <RenderChannel channel={c.id} body={map[c.id]!.body} />
          ) : (
            <EmptyState
              icon={<Sparkles className="h-5 w-5" />}
              title="Контент ещё не сгенерирован"
              hint="Нажмите «Сгенерировать кампанию» — Gemini создаст драфт для всех каналов одновременно."
            />
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function RenderChannel({ channel, body }: { channel: Channel; body: Record<string, any> }) {
  switch (channel) {
    case "push":
      return (
        <Card>
          <CardContent className="space-y-2 pt-5">
            <div className="text-xs uppercase tracking-widest text-ink-mute">Push</div>
            <div className="font-display text-lg font-semibold">{body.title}</div>
            <p className="text-sm text-ink-dim">{body.body}</p>
          </CardContent>
        </Card>
      );
    case "story":
      return (
        <Card>
          <CardContent className="space-y-2 pt-5">
            <div className="text-xs uppercase tracking-widest text-ink-mute">Story</div>
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
            <div className="text-xs uppercase tracking-widest text-ink-mute">Blog</div>
            <h3 className="font-display text-xl font-semibold">{body.title}</h3>
            <p className="text-sm text-ink-dim italic">{body.lede}</p>
            <p className="text-sm text-ink leading-relaxed whitespace-pre-line">{body.body}</p>
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
            <div className="text-xs uppercase tracking-widest text-ink-mute">Recipe</div>
            <h3 className="font-display text-lg font-semibold">{body.name}</h3>
            <div className="flex gap-3 text-xs text-ink-dim">
              <span>выход: {body.yield}</span>
              <span>· время: {body.time}</span>
            </div>
            <div>
              <div className="mb-1 text-xs uppercase tracking-widest text-ink-mute">Ингредиенты</div>
              <ul className="space-y-1 text-sm text-ink">
                {(body.ingredients ?? []).map((i: string, idx: number) => (
                  <li key={idx} className="before:mr-2 before:text-leaf before:content-['•']">{i}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="mb-1 text-xs uppercase tracking-widest text-ink-mute">Шаги</div>
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
              <div className="text-xs uppercase tracking-widest text-ink-mute">Chat</div>
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
            <div className="text-xs uppercase tracking-widest text-ink-mute">Social · Telegram</div>
            <div className="font-display text-lg font-semibold">{body.title}</div>
            <p className="text-sm text-ink leading-relaxed whitespace-pre-line">{body.text}</p>
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

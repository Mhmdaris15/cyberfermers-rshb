import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getFarmer } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const allChannels = [
  { id: "storefront", label: "Витрина" },
  { id: "push", label: "Пуш" },
  { id: "story", label: "Сторис" },
  { id: "blog", label: "Блог" },
  { id: "recipe", label: "Рецепты" },
  { id: "chat", label: "Чат с покупателем" },
  { id: "social", label: "Соцсети" },
  { id: "email", label: "E-mail" },
];

const audiences = [
  { id: "healthy", label: "ЗОЖ" },
  { id: "parents", label: "Осознанные родители" },
  { id: "gourmets", label: "Гурманы" },
  { id: "gift_buyers", label: "Покупатели подарков" },
  { id: "students", label: "Студенты" },
];

export function SettingsPage() {
  const { farmerId = "10060" } = useParams();
  const farmer = useQuery({ queryKey: ["farmer", farmerId], queryFn: () => getFarmer(farmerId) });
  const has = (set: string[] | undefined, id: string) => (set ?? []).includes(id);

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardContent className="space-y-3 pt-5">
          <h2 className="font-display text-lg font-semibold">Каналы коммуникации</h2>
          <p className="text-xs text-ink-dim">
            Выберите каналы, к которым у вас есть доступ. Рекомендатель учтёт их при подборе кампаний.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            {allChannels.map((c) => (
              <Badge key={c.id} variant={has(farmer.data?.channels, c.id) ? "leaf" : "outline"}>{c.label}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 pt-5">
          <h2 className="font-display text-lg font-semibold">Фокус аудитории</h2>
          <p className="text-xs text-ink-dim">Под кого вы продаёте чаще всего. Используем для скоринга событий.</p>
          <div className="flex flex-wrap gap-2 pt-2">
            {audiences.map((a) => (
              <Badge key={a.id} variant={has(farmer.data?.audience_focus, a.id) ? "plum" : "outline"}>{a.label}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardContent className="space-y-2 pt-5">
          <h2 className="font-display text-lg font-semibold">О ферме</h2>
          <p className="text-sm text-ink-dim leading-relaxed whitespace-pre-line">
            {farmer.data?.description ?? "Описание не задано."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

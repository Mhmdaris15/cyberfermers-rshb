import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { getFarmerProducts } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search } from "lucide-react";

export function ProductsPage() {
  const { farmerId = "10060" } = useParams();
  const [q, setQ] = useState("");
  const products = useQuery({ queryKey: ["products", farmerId], queryFn: () => getFarmerProducts(farmerId) });

  const list = useMemo(() => {
    const all = products.data?.products ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((p) => p.name.toLowerCase().includes(needle) || p.category.toLowerCase().includes(needle));
  }, [products.data, q]);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Каталог</h1>
          <p className="text-sm text-ink-dim">{products.data?.count ?? 0} товаров фермера</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск по названию или категории…"
            className="h-10 w-80 rounded-lg border border-line bg-bg-elevated/70 pl-9 pr-3 text-sm placeholder:text-ink-mute focus-ring"
          />
        </div>
      </div>

      {products.isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.slice(0, 90).map((p) => (
            <Card key={p.id} className="card-hover">
              <CardContent className="space-y-2 pt-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{p.category}</Badge>
                  <span className="text-[11px] font-mono text-ink-mute">#{p.product_id}</span>
                </div>
                <div className="font-display text-sm font-semibold">{p.name}</div>
                {p.description && (
                  <p className="line-clamp-2 text-xs text-ink-dim">{p.description}</p>
                )}
                {!!p.tags?.length && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {p.tags.slice(0, 6).map((t) => (
                      <Badge key={t} variant="leaf" className="text-[10px]">{t}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

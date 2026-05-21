import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Plus, Search, Sparkles, Wand2, X } from "lucide-react";
import { useTranslate } from "@tolgee/react";

import {
  addProductTag,
  addProductTagsBatch,
  autoTagMissing,
  getFarmerProducts,
  getTagVocabulary,
  removeProductTag,
  suggestProductTags,
  type TagSuggestion,
} from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { Product } from "@/lib/types";

// =====================================================================
//  ProductsPage — catalog browser with chip-editor tag UX.
//
//  - Toggle filter: "all" / "untagged" (count badge).
//  - Bulk action: auto-tag all products with <3 tags.
//  - Per-card: editable chip row (× to remove, type+Enter to add).
//  - Per-card "Suggest" button: opens suggest-then-approve popover.
//  - Autocomplete uses the corpus vocabulary endpoint.
// =====================================================================

const MIN_TAGGED = 3;

export function ProductsPage() {
  const { farmerId = "10060" } = useParams();
  const { t } = useTranslate();
  const toast = useToast();
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "untagged">("all");

  const products = useQuery({
    queryKey: ["products", farmerId],
    queryFn: () => getFarmerProducts(farmerId),
  });

  const vocab = useQuery({
    queryKey: ["tag-vocab", farmerId],
    queryFn: () => getTagVocabulary(farmerId),
    staleTime: 60_000,
  });

  const all = products.data?.products ?? [];
  const untaggedCount = useMemo(
    () => all.filter((p) => (p.tags ?? []).length < MIN_TAGGED).length,
    [all],
  );

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((p) => {
      if (filter === "untagged" && (p.tags ?? []).length >= MIN_TAGGED) return false;
      if (!needle) return true;
      return (
        p.name.toLowerCase().includes(needle) ||
        p.category.toLowerCase().includes(needle) ||
        (p.tags ?? []).some((t) => t.toLowerCase().includes(needle))
      );
    });
  }, [all, q, filter]);

  const bulkMut = useMutation({
    mutationFn: () => autoTagMissing(farmerId),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["products", farmerId] });
      qc.invalidateQueries({ queryKey: ["tag-vocab", farmerId] });
      toast.success(
        t("products.tags.bulk.done"),
        `${res.products_touched} ${t("products.tags.bulk.products")} · ${res.tags_added} ${t("products.tags.bulk.tags")}`,
      );
    },
    onError: (e: any) =>
      toast.error(t("products.tags.bulk.failed"), e?.response?.data?.error ?? e?.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            {t("nav.products")}
          </h1>
          <p className="text-sm text-ink-dim">
            {products.data?.count ?? 0} {t("products.totalLabel")}
            {untaggedCount > 0 && (
              <>
                {" · "}
                <span className="text-amber">
                  {untaggedCount} {t("products.untagged.suffix")}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <FilterPill
            active={filter === "all"}
            onClick={() => setFilter("all")}
            label={t("products.filter.all")}
          />
          <FilterPill
            active={filter === "untagged"}
            onClick={() => setFilter("untagged")}
            label={`${t("products.filter.untagged")} (${untaggedCount})`}
            tone="amber"
          />
          <button
            type="button"
            disabled={bulkMut.isPending || untaggedCount === 0}
            onClick={() => {
              if (
                window.confirm(
                  t("products.tags.bulk.confirm").replace("{n}", String(untaggedCount)),
                )
              ) {
                bulkMut.mutate();
              }
            }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-amber/40 bg-amber/10 px-3 py-1.5 text-xs font-medium text-amber transition-colors",
              "hover:bg-amber/15 disabled:opacity-40 disabled:cursor-not-allowed focus-ring",
            )}
          >
            {bulkMut.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            <span>
              {t("products.tags.bulk.cta")} ({untaggedCount})
            </span>
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-mute" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("products.search.placeholder")}
              className="h-10 w-72 rounded-lg border border-line bg-bg-elevated/70 pl-9 pr-3 text-sm placeholder:text-ink-mute focus-ring"
            />
          </div>
        </div>
      </div>

      {products.isLoading ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.slice(0, 120).map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              farmerId={farmerId}
              vocab={vocab.data ?? []}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------

function FilterPill({
  active,
  onClick,
  label,
  tone = "leaf",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  tone?: "leaf" | "amber";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-md border px-3 text-xs font-medium transition-colors focus-ring",
        active
          ? tone === "amber"
            ? "border-amber/40 bg-amber/15 text-amber"
            : "border-leaf/40 bg-leaf/15 text-leaf"
          : "border-line bg-bg-elevated/60 text-ink-dim hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

// ---------------------------------------------------------------------

function ProductCard({
  p,
  farmerId,
  vocab,
}: {
  p: Product;
  farmerId: string;
  vocab: string[];
}) {
  const { t } = useTranslate();
  const toast = useToast();
  const qc = useQueryClient();
  const tags = p.tags ?? [];
  const untagged = tags.length < MIN_TAGGED;
  const [suggestOpen, setSuggestOpen] = useState(false);

  const removeMut = useMutation({
    mutationFn: (tag: string) => removeProductTag(farmerId, p.id, tag),
    onSuccess: (updated) => {
      patchProductTags(qc, farmerId, p.id, updated);
    },
    onError: (e: any) =>
      toast.error(t("products.tags.removeFailed"), e?.response?.data?.error ?? e?.message),
  });

  const addMut = useMutation({
    mutationFn: (tag: string) => addProductTag(farmerId, p.id, tag),
    onSuccess: (updated) => {
      patchProductTags(qc, farmerId, p.id, updated);
      qc.invalidateQueries({ queryKey: ["tag-vocab", farmerId] });
    },
    onError: (e: any) =>
      toast.error(t("products.tags.addFailed"), e?.response?.data?.error ?? e?.message),
  });

  return (
    <Card className={cn("card-hover", untagged && "ring-1 ring-amber/30")}>
      <CardContent className="space-y-2.5 pt-4">
        <div className="flex items-center justify-between">
          <Badge variant="outline">{p.category}</Badge>
          <span className="text-[11px] font-mono text-ink-mute">#{p.product_id}</span>
        </div>
        <div className="font-display text-sm font-semibold">{p.name}</div>
        {p.description && (
          <p className="line-clamp-2 text-xs text-ink-dim">{p.description}</p>
        )}

        <TagChipEditor
          tags={tags}
          vocab={vocab}
          onAdd={(tag) => addMut.mutate(tag)}
          onRemove={(tag) => removeMut.mutate(tag)}
          adding={addMut.isPending}
        />

        <div className="flex items-center justify-between pt-1">
          <button
            type="button"
            onClick={() => setSuggestOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-line bg-bg-elevated/60 px-2 py-1 text-[11px] text-ink-dim transition-colors hover:border-amber/40 hover:text-amber focus-ring"
          >
            <Sparkles className="h-3 w-3 text-amber" />
            <span>{t("products.tags.suggest.cta")}</span>
          </button>
          {untagged && (
            <span className="smallcaps text-[9px] text-amber">
              {t("products.untagged.badge")}
            </span>
          )}
        </div>
      </CardContent>

      <AnimatePresence>
        {suggestOpen && (
          <SuggestModal
            farmerId={farmerId}
            product={p}
            onClose={() => setSuggestOpen(false)}
          />
        )}
      </AnimatePresence>
    </Card>
  );
}

// ---------------------------------------------------------------------

function TagChipEditor({
  tags,
  vocab,
  onAdd,
  onRemove,
  adding,
}: {
  tags: string[];
  vocab: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  adding: boolean;
}) {
  const { t } = useTranslate();
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);

  const existing = new Set(tags.map((x) => x.toLowerCase()));
  const matches = useMemo(() => {
    const needle = draft.trim().toLowerCase();
    if (!needle) return [];
    return vocab
      .filter((v) => v.includes(needle) && !existing.has(v))
      .slice(0, 6);
  }, [draft, vocab, existing]);

  function commit(tag: string) {
    const norm = tag.trim().toLowerCase();
    if (!norm || existing.has(norm)) {
      setDraft("");
      return;
    }
    onAdd(norm);
    setDraft("");
  }

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="group inline-flex items-center gap-1 rounded-md border border-line bg-bg-elevated/60 pl-1.5 pr-0.5 py-0.5 text-[10px] text-ink"
          >
            <span>{tag}</span>
            <button
              type="button"
              onClick={() => onRemove(tag)}
              className="grid h-3.5 w-3.5 place-items-center rounded text-ink-mute opacity-60 transition-colors hover:bg-rust/15 hover:text-rust group-hover:opacity-100 focus-ring"
              aria-label={`remove ${tag}`}
            >
              <X className="h-2.5 w-2.5" />
            </button>
          </span>
        ))}
        <div className="relative inline-flex items-center">
          <Plus className="absolute left-1.5 h-3 w-3 text-ink-mute" />
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 120)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit(draft);
              } else if (e.key === "Escape") {
                setDraft("");
                (e.target as HTMLInputElement).blur();
              }
            }}
            disabled={adding}
            placeholder={t("products.tags.add.placeholder")}
            className="h-6 w-32 rounded-md border border-dashed border-line bg-transparent pl-6 pr-2 text-[10px] placeholder:text-ink-mute focus:border-leaf/40 focus:bg-bg-elevated/60 focus-ring"
          />
        </div>
      </div>

      {focused && matches.length > 0 && (
        <div className="glass-strong absolute left-0 top-full z-20 mt-1 min-w-[180px] overflow-hidden rounded-md border border-line shadow-glass">
          {matches.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => commit(m)}
              className="block w-full px-2.5 py-1.5 text-left text-xs text-ink-dim hover:bg-bg-subtle hover:text-ink"
            >
              {m}
            </button>
          ))}
          {draft.trim() && !vocab.includes(draft.trim().toLowerCase()) && (
            <button
              type="button"
              onClick={() => commit(draft)}
              className="block w-full border-t border-line/40 px-2.5 py-1.5 text-left text-xs text-leaf hover:bg-leaf/10"
            >
              + {t("products.tags.add.new")} «{draft.trim()}»
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------

function SuggestModal({
  farmerId,
  product,
  onClose,
}: {
  farmerId: string;
  product: Product;
  onClose: () => void;
}) {
  const { t } = useTranslate();
  const toast = useToast();
  const qc = useQueryClient();
  const dialogRef = useRef<HTMLDivElement>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());

  const sug = useQuery({
    queryKey: ["suggest", farmerId, product.id],
    queryFn: () => suggestProductTags(farmerId, product.id),
    staleTime: 0,
  });

  const applyMut = useMutation({
    mutationFn: (tags: string[]) => addProductTagsBatch(farmerId, product.id, tags),
    onSuccess: (res) => {
      patchProductTags(qc, farmerId, product.id, res.tags);
      qc.invalidateQueries({ queryKey: ["tag-vocab", farmerId] });
      toast.success(
        t("products.tags.suggest.applied"),
        `+${res.added} ${t("products.tags.bulk.tags")}`,
      );
      onClose();
    },
    onError: (e: any) =>
      toast.error(t("products.tags.suggest.failed"), e?.response?.data?.error ?? e?.message),
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle(tag: string) {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }

  const candidates = (sug.data ?? []).filter((s) => !s.existing);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <motion.div
        ref={dialogRef}
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 6 }}
        transition={{ duration: 0.18, ease: [0.2, 0.65, 0.2, 1] }}
        className="glass-strong w-full max-w-md overflow-hidden rounded-xl border border-line shadow-glass"
      >
        <header className="flex items-start justify-between gap-3 border-b border-line/40 px-5 py-4">
          <div>
            <div className="smallcaps text-[10px] text-amber">
              {t("products.tags.suggest.eyebrow")}
            </div>
            <h3 className="font-display text-base font-semibold leading-tight">
              {product.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-ink-mute hover:text-ink"
            aria-label={t("common.cta.close")}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-5 py-4">
          {sug.isLoading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-dim">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t("products.tags.suggest.loading")}</span>
            </div>
          )}
          {sug.isError && (
            <p className="py-4 text-sm text-rust">{t("products.tags.suggest.failed")}</p>
          )}
          {sug.data && (
            <>
              {candidates.length === 0 ? (
                <p className="py-4 text-sm text-ink-dim">
                  {t("products.tags.suggest.empty")}
                </p>
              ) : (
                <>
                  <p className="mb-3 text-xs text-ink-dim">
                    {t("products.tags.suggest.helper")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {candidates.map((s) => {
                      const isAccepted = accepted.has(s.tag);
                      return (
                        <button
                          key={s.tag}
                          type="button"
                          onClick={() => toggle(s.tag)}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors focus-ring",
                            isAccepted
                              ? "border-leaf/50 bg-leaf/15 text-leaf"
                              : s.source === "llm"
                                ? "border-amber/30 bg-amber/5 text-ink-dim hover:border-amber/50 hover:text-amber"
                                : "border-sky/30 bg-sky/5 text-ink-dim hover:border-sky/50 hover:text-sky",
                          )}
                          title={`${s.source} · confidence ${Math.round(s.confidence * 100)}%`}
                        >
                          <span>{s.tag}</span>
                          <span className="smallcaps text-[8px] opacity-60">
                            {s.source}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-line/40 bg-bg-subtle/30 px-5 py-3">
          <span className="text-[11px] text-ink-mute">
            {accepted.size} {t("products.tags.suggest.selectedSuffix")}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-md border border-line bg-bg-elevated/60 px-3 py-1.5 text-xs text-ink-dim hover:text-ink focus-ring"
            >
              {t("common.cta.cancel")}
            </button>
            <button
              disabled={accepted.size === 0 || applyMut.isPending}
              onClick={() => applyMut.mutate(Array.from(accepted))}
              className="inline-flex items-center gap-1.5 rounded-md bg-leaf px-3 py-1.5 text-xs font-medium text-bg shadow-glow disabled:opacity-40 focus-ring"
            >
              {applyMut.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              <span>
                {t("products.tags.suggest.applyCta")}
                {accepted.size > 0 && ` (${accepted.size})`}
              </span>
            </button>
          </div>
        </footer>
      </motion.div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------

// Patch the React Query cache for a single product so the FE updates
// instantly after add/remove, without refetching the whole catalog.
function patchProductTags(
  qc: ReturnType<typeof useQueryClient>,
  farmerId: string,
  productId: string,
  tags: string[],
) {
  qc.setQueryData<{ products: Product[]; count: number }>(
    ["products", farmerId],
    (cur) => {
      if (!cur) return cur;
      return {
        ...cur,
        products: cur.products.map((p) =>
          p.id === productId ? { ...p, tags } : p,
        ),
      };
    },
  );
}

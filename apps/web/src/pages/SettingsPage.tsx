import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ExternalLink,
  KeyRound,
  Loader2,
  LogOut,
  Save,
  ShieldAlert,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useTranslate } from "@tolgee/react";

import {
  changePassword,
  getFarmer,
  revokeOtherSessions,
  updateFarmer,
  type FarmerPatch,
} from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import type { Farmer } from "@/lib/types";

// =====================================================================
//  SettingsPage — 4-section editable profile + AI brand voice + account.
//
//  Each section has its OWN save button. No global save / cancel — feels
//  faster and removes confusion about which fields are pending.
// =====================================================================

const CHANNELS = [
  { id: "storefront", labelKey: "settings.channels.storefront" },
  { id: "push", labelKey: "settings.channels.push" },
  { id: "story", labelKey: "settings.channels.story" },
  { id: "blog", labelKey: "settings.channels.blog" },
  { id: "recipe", labelKey: "settings.channels.recipe" },
  { id: "chat", labelKey: "settings.channels.chat" },
  { id: "social", labelKey: "settings.channels.social" },
  { id: "email", labelKey: "settings.channels.email" },
];

const AUDIENCES = [
  { id: "healthy", labelKey: "settings.audience.healthy" },
  { id: "parents", labelKey: "settings.audience.parents" },
  { id: "gourmets", labelKey: "settings.audience.gourmets" },
  { id: "gift_buyers", labelKey: "settings.audience.giftBuyers" },
  { id: "students", labelKey: "settings.audience.students" },
];

const RISK_APPETITES = [
  { id: "conservative", labelKey: "settings.risk.conservative", tone: "sky" as const },
  { id: "balanced", labelKey: "settings.risk.balanced", tone: "leaf" as const },
  { id: "aggressive", labelKey: "settings.risk.aggressive", tone: "rust" as const },
];

const BRAND_VOICES = [
  { id: "warm", labelKey: "settings.voice.warm.label", descKey: "settings.voice.warm.desc" },
  { id: "business", labelKey: "settings.voice.business.label", descKey: "settings.voice.business.desc" },
  { id: "folksy", labelKey: "settings.voice.folksy.label", descKey: "settings.voice.folksy.desc" },
  { id: "sharp", labelKey: "settings.voice.sharp.label", descKey: "settings.voice.sharp.desc" },
  { id: "expert", labelKey: "settings.voice.expert.label", descKey: "settings.voice.expert.desc" },
];

// ---------------------------------------------------------------------

export function SettingsPage() {
  const { farmerId = "10060" } = useParams();
  const farmer = useQuery({
    queryKey: ["farmer", farmerId],
    queryFn: () => getFarmer(farmerId),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          {useTranslate().t("settings.title")}
        </h1>
        <p className="text-sm text-ink-dim">{useTranslate().t("settings.subtitle")}</p>
      </header>

      {farmer.isLoading || !farmer.data ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          <ProfileSection farmerId={farmerId} farmer={farmer.data} />
          <ChannelsSection farmerId={farmerId} farmer={farmer.data} />
          <BrandVoiceSection farmerId={farmerId} farmer={farmer.data} />
          <AccountSection />
        </div>
      )}
    </div>
  );
}

// ===================================================================== Section helpers

function useFarmerPatchMutation(farmerId: string, onDone?: () => void) {
  const { t } = useTranslate();
  const toast = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: FarmerPatch) => updateFarmer(farmerId, patch),
    onSuccess: (updated) => {
      qc.setQueryData(["farmer", farmerId], updated);
      toast.success(t("settings.saved"));
      onDone?.();
    },
    onError: (e: any) =>
      toast.error(t("settings.saveFailed"), e?.response?.data?.error ?? e?.message),
  });
}

function SectionShell({
  title,
  eyebrow,
  description,
  children,
  saveButton,
  className,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  children: React.ReactNode;
  saveButton?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent className="flex h-full flex-col space-y-4 pt-5">
        <div>
          {eyebrow && (
            <div className="smallcaps text-[10px] text-ink-mute">{eyebrow}</div>
          )}
          <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-1 text-xs text-ink-dim">{description}</p>}
        </div>
        <div className="flex-1 space-y-3">{children}</div>
        {saveButton && <div className="flex justify-end pt-2">{saveButton}</div>}
      </CardContent>
    </Card>
  );
}

function SaveBtn({
  busy,
  disabled,
  onClick,
  label,
}: {
  busy: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={busy || disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md bg-leaf px-3 py-1.5 text-xs font-medium text-bg shadow-glow transition-opacity focus-ring",
        "disabled:opacity-40 disabled:cursor-not-allowed",
      )}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
      <span>{label}</span>
    </button>
  );
}

// ===================================================================== 1. Profile

function ProfileSection({ farmerId, farmer }: { farmerId: string; farmer: Farmer }) {
  const { t } = useTranslate();
  const [shopName, setShopName] = useState(farmer.shop_name);
  const [description, setDescription] = useState(farmer.description ?? "");
  const [region, setRegion] = useState(farmer.region);
  const [url, setUrl] = useState(farmer.url ?? "");

  useEffect(() => {
    setShopName(farmer.shop_name);
    setDescription(farmer.description ?? "");
    setRegion(farmer.region);
    setUrl(farmer.url ?? "");
  }, [farmer]);

  const mut = useFarmerPatchMutation(farmerId);
  const dirty =
    shopName !== farmer.shop_name ||
    description !== (farmer.description ?? "") ||
    region !== farmer.region ||
    url !== (farmer.url ?? "");

  return (
    <SectionShell
      eyebrow={t("settings.profile.eyebrow")}
      title={t("settings.profile.title")}
      description={t("settings.profile.description")}
      saveButton={
        <SaveBtn
          busy={mut.isPending}
          disabled={!dirty}
          onClick={() =>
            mut.mutate({
              shop_name: shopName,
              description,
              region,
              url,
            })
          }
          label={t("common.cta.save")}
        />
      }
    >
      <LabeledInput label={t("settings.profile.shopName")} value={shopName} onChange={setShopName} />
      <LabeledInput label={t("settings.profile.region")} value={region} onChange={setRegion} />
      <div>
        <div className="flex items-center justify-between">
          <span className="smallcaps text-[10px] text-ink-mute">
            {t("settings.profile.url")}
          </span>
          {farmer.url && (
            <a
              href={farmer.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-leaf hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              <span>{t("settings.profile.urlOpen")}</span>
            </a>
          )}
        </div>
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://svoe-rodnoe.ru/farmers/…"
          className="mt-1 h-9 w-full rounded-md border border-line bg-bg-elevated/60 px-2.5 text-sm placeholder:text-ink-mute focus-ring"
        />
      </div>
      <LabeledTextarea
        label={t("settings.profile.aboutLabel")}
        value={description}
        onChange={setDescription}
        rows={4}
      />
    </SectionShell>
  );
}

// ===================================================================== 2. Channels + audience

function ChannelsSection({ farmerId, farmer }: { farmerId: string; farmer: Farmer }) {
  const { t } = useTranslate();
  const [channels, setChannels] = useState<string[]>(farmer.channels ?? []);
  const [audience, setAudience] = useState<string[]>(farmer.audience_focus ?? []);

  useEffect(() => {
    setChannels(farmer.channels ?? []);
    setAudience(farmer.audience_focus ?? []);
  }, [farmer]);

  const mut = useFarmerPatchMutation(farmerId);
  const dirty =
    !sameSet(channels, farmer.channels ?? []) ||
    !sameSet(audience, farmer.audience_focus ?? []);

  return (
    <SectionShell
      eyebrow={t("settings.channels.eyebrow")}
      title={t("settings.channels.title")}
      description={t("settings.channels.description")}
      saveButton={
        <SaveBtn
          busy={mut.isPending}
          disabled={!dirty}
          onClick={() => mut.mutate({ channels, audience_focus: audience })}
          label={t("common.cta.save")}
        />
      }
    >
      <div>
        <div className="smallcaps mb-2 text-[10px] text-ink-mute">
          {t("settings.channels.channelsLabel")}
        </div>
        <ChipToggleGrid
          items={CHANNELS}
          selected={channels}
          onToggle={(id) => setChannels((cur) => toggle(cur, id))}
          tone="leaf"
        />
      </div>
      <div>
        <div className="smallcaps mb-2 text-[10px] text-ink-mute">
          {t("settings.channels.audienceLabel")}
        </div>
        <ChipToggleGrid
          items={AUDIENCES}
          selected={audience}
          onToggle={(id) => setAudience((cur) => toggle(cur, id))}
          tone="plum"
        />
      </div>
    </SectionShell>
  );
}

// ===================================================================== 3. Brand voice (AI)

function BrandVoiceSection({ farmerId, farmer }: { farmerId: string; farmer: Farmer }) {
  const { t } = useTranslate();
  const [voice, setVoice] = useState<string>(farmer.brand_voice ?? "");
  const [signature, setSignature] = useState(farmer.signature_phrase ?? "");
  const [cta, setCta] = useState(farmer.default_cta ?? "");
  const [forbidden, setForbidden] = useState<string[]>(farmer.forbidden_words ?? []);
  const [forbiddenDraft, setForbiddenDraft] = useState("");
  const [risk, setRisk] = useState(farmer.risk_appetite ?? "balanced");

  useEffect(() => {
    setVoice(farmer.brand_voice ?? "");
    setSignature(farmer.signature_phrase ?? "");
    setCta(farmer.default_cta ?? "");
    setForbidden(farmer.forbidden_words ?? []);
    setRisk(farmer.risk_appetite ?? "balanced");
  }, [farmer]);

  const mut = useFarmerPatchMutation(farmerId);
  const dirty =
    voice !== (farmer.brand_voice ?? "") ||
    signature !== (farmer.signature_phrase ?? "") ||
    cta !== (farmer.default_cta ?? "") ||
    risk !== (farmer.risk_appetite ?? "balanced") ||
    !sameSet(forbidden, farmer.forbidden_words ?? []);

  function commitForbidden(raw: string) {
    const v = raw.trim().toLowerCase();
    if (!v || forbidden.includes(v)) {
      setForbiddenDraft("");
      return;
    }
    setForbidden((cur) => [...cur, v]);
    setForbiddenDraft("");
  }

  return (
    <SectionShell
      className="md:col-span-2"
      eyebrow={t("settings.voice.eyebrow")}
      title={t("settings.voice.title")}
      description={t("settings.voice.description")}
      saveButton={
        <SaveBtn
          busy={mut.isPending}
          disabled={!dirty}
          onClick={() =>
            mut.mutate({
              brand_voice: voice,
              signature_phrase: signature,
              default_cta: cta,
              forbidden_words: forbidden,
              risk_appetite: risk,
            })
          }
          label={t("common.cta.save")}
        />
      }
    >
      <div>
        <div className="smallcaps mb-2 text-[10px] text-ink-mute">
          {t("settings.voice.pickerLabel")}
        </div>
        <div className="grid gap-2 md:grid-cols-5">
          {BRAND_VOICES.map((v) => {
            const active = voice === v.id;
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setVoice(active ? "" : v.id)}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-colors focus-ring",
                  active
                    ? "border-amber/50 bg-amber/10"
                    : "border-line bg-bg-elevated/60 hover:border-amber/30",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span
                    className={cn(
                      "font-display text-sm font-semibold",
                      active ? "text-amber" : "text-ink",
                    )}
                  >
                    {t(v.labelKey)}
                  </span>
                  {active && <Check className="h-3 w-3 text-amber" />}
                </div>
                <span className="text-[10px] leading-snug text-ink-dim">
                  {t(v.descKey)}
                </span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-ink-mute">
          <Sparkles className="mr-1 inline h-3 w-3 text-amber" />
          {t("settings.voice.appliesNote")}
        </p>
      </div>

      <LabeledInput
        label={t("settings.voice.signatureLabel")}
        value={signature}
        onChange={setSignature}
        maxLength={200}
        placeholder={t("settings.voice.signaturePlaceholder")}
      />
      <LabeledInput
        label={t("settings.voice.ctaLabel")}
        value={cta}
        onChange={setCta}
        maxLength={120}
        placeholder={t("settings.voice.ctaPlaceholder")}
      />

      <div>
        <div className="smallcaps mb-2 text-[10px] text-ink-mute">
          {t("settings.voice.forbiddenLabel")}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {forbidden.map((w) => (
            <span
              key={w}
              className="group inline-flex items-center gap-1 rounded-md border border-rust/30 bg-rust/10 pl-2 pr-0.5 py-0.5 text-[11px] text-rust"
            >
              <span>{w}</span>
              <button
                type="button"
                onClick={() => setForbidden((cur) => cur.filter((x) => x !== w))}
                className="grid h-4 w-4 place-items-center rounded text-rust/70 hover:bg-rust/20 hover:text-rust focus-ring"
                aria-label={`remove ${w}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          <input
            value={forbiddenDraft}
            onChange={(e) => setForbiddenDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitForbidden(forbiddenDraft);
              }
            }}
            placeholder={t("settings.voice.forbiddenPlaceholder")}
            className="h-7 w-36 rounded-md border border-dashed border-line bg-transparent px-2 text-[11px] placeholder:text-ink-mute focus:border-rust/40 focus:bg-bg-elevated/60 focus-ring"
          />
        </div>
        <p className="mt-1.5 text-[10px] text-ink-mute">{t("settings.voice.forbiddenHelp")}</p>
      </div>

      <div>
        <div className="smallcaps mb-2 text-[10px] text-ink-mute">
          {t("settings.risk.label")}
        </div>
        <div className="flex flex-wrap gap-2">
          {RISK_APPETITES.map((r) => {
            const active = risk === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setRisk(r.id)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-ring",
                  active && r.tone === "leaf" && "border-leaf/50 bg-leaf/15 text-leaf",
                  active && r.tone === "rust" && "border-rust/50 bg-rust/15 text-rust",
                  active && r.tone === "sky" && "border-sky/50 bg-sky/15 text-sky",
                  !active && "border-line bg-bg-elevated/60 text-ink-dim hover:text-ink",
                )}
              >
                {t(r.labelKey)}
              </button>
            );
          })}
        </div>
      </div>
    </SectionShell>
  );
}

// ===================================================================== 4. Account

function AccountSection() {
  const { t } = useTranslate();
  const toast = useToast();
  const { logout } = useAuth();
  const [pwOpen, setPwOpen] = useState(false);

  const revokeMut = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: () => toast.success(t("settings.account.revokedOk")),
    onError: (e: any) =>
      toast.error(t("settings.account.revokedFailed"), e?.response?.data?.error ?? e?.message),
  });

  async function fullLogout() {
    if (!window.confirm(t("settings.account.fullLogoutConfirm"))) return;
    await logout();
    window.location.assign("/login");
  }

  return (
    <SectionShell
      className="md:col-span-2"
      eyebrow={t("settings.account.eyebrow")}
      title={t("settings.account.title")}
      description={t("settings.account.description")}
    >
      <div className="grid gap-3 md:grid-cols-3">
        <ActionTile
          icon={<KeyRound className="h-4 w-4 text-leaf" />}
          title={t("settings.account.changePassword")}
          description={t("settings.account.changePasswordDesc")}
          cta={t("settings.account.changePasswordCta")}
          onClick={() => setPwOpen(true)}
        />
        <ActionTile
          icon={<ShieldAlert className="h-4 w-4 text-amber" />}
          title={t("settings.account.revokeOthers")}
          description={t("settings.account.revokeOthersDesc")}
          cta={t("settings.account.revokeOthersCta")}
          onClick={() => revokeMut.mutate()}
          busy={revokeMut.isPending}
          tone="amber"
        />
        <ActionTile
          icon={<LogOut className="h-4 w-4 text-rust" />}
          title={t("settings.account.fullLogout")}
          description={t("settings.account.fullLogoutDesc")}
          cta={t("settings.account.fullLogoutCta")}
          onClick={fullLogout}
          tone="rust"
        />
      </div>

      <AnimatePresence>
        {pwOpen && <PasswordModal onClose={() => setPwOpen(false)} />}
      </AnimatePresence>
    </SectionShell>
  );
}

function ActionTile({
  icon,
  title,
  description,
  cta,
  onClick,
  busy,
  tone = "leaf",
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  onClick: () => void;
  busy?: boolean;
  tone?: "leaf" | "amber" | "rust";
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-bg-elevated/40 p-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="font-display text-sm font-semibold">{title}</span>
      </div>
      <p className="flex-1 text-[11px] leading-relaxed text-ink-dim">{description}</p>
      <button
        type="button"
        disabled={busy}
        onClick={onClick}
        className={cn(
          "self-start rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors focus-ring",
          tone === "leaf" && "border-leaf/40 bg-leaf/10 text-leaf hover:bg-leaf/15",
          tone === "amber" && "border-amber/40 bg-amber/10 text-amber hover:bg-amber/15",
          tone === "rust" && "border-rust/40 bg-rust/10 text-rust hover:bg-rust/15",
          "disabled:opacity-40 disabled:cursor-not-allowed",
        )}
      >
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : cta}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------

function PasswordModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslate();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next1, setNext1] = useState("");
  const [next2, setNext2] = useState("");

  const mut = useMutation({
    mutationFn: () => changePassword(current, next1),
    onSuccess: () => {
      toast.success(t("settings.account.passwordChangedOk"));
      onClose();
    },
    onError: (e: any) =>
      toast.error(
        t("settings.account.passwordChangedFailed"),
        e?.response?.data?.error ?? e?.message,
      ),
  });

  const canSubmit =
    current.length > 0 && next1.length >= 8 && next1 === next2 && next1 !== current;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, scale: 0.96, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 6 }}
        className="glass-strong w-full max-w-sm overflow-hidden rounded-xl border border-line shadow-glass"
      >
        <header className="flex items-center justify-between border-b border-line/40 px-5 py-3">
          <h3 className="font-display text-base font-semibold">
            {t("settings.account.changePassword")}
          </h3>
          <button onClick={onClose} className="text-ink-mute hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-3 px-5 py-4">
          <LabeledInput
            type="password"
            label={t("settings.account.currentPassword")}
            value={current}
            onChange={setCurrent}
          />
          <LabeledInput
            type="password"
            label={t("settings.account.newPassword")}
            value={next1}
            onChange={setNext1}
          />
          <LabeledInput
            type="password"
            label={t("settings.account.confirmPassword")}
            value={next2}
            onChange={setNext2}
          />
          {next1.length > 0 && next1.length < 8 && (
            <p className="text-[10px] text-rust">{t("settings.account.passwordMinLen")}</p>
          )}
          {next1.length > 0 && next2.length > 0 && next1 !== next2 && (
            <p className="text-[10px] text-rust">{t("settings.account.passwordMismatch")}</p>
          )}
        </div>
        <footer className="flex justify-end gap-2 border-t border-line/40 bg-bg-subtle/30 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-md border border-line bg-bg-elevated/60 px-3 py-1.5 text-xs text-ink-dim hover:text-ink focus-ring"
          >
            {t("common.cta.cancel")}
          </button>
          <button
            disabled={!canSubmit || mut.isPending}
            onClick={() => mut.mutate()}
            className="inline-flex items-center gap-1.5 rounded-md bg-leaf px-3 py-1.5 text-xs font-medium text-bg shadow-glow disabled:opacity-40 focus-ring"
          >
            {mut.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            <span>{t("common.cta.save")}</span>
          </button>
        </footer>
      </motion.div>
    </motion.div>
  );
}

// ===================================================================== Building blocks

function LabeledInput({
  label,
  value,
  onChange,
  maxLength,
  placeholder,
  type,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  maxLength?: number;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="smallcaps text-[10px] text-ink-mute">{label}</span>
        {maxLength && (
          <span className="font-mono text-[9px] text-ink-mute">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      <input
        type={type ?? "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
        className="mt-1 h-9 w-full rounded-md border border-line bg-bg-elevated/60 px-2.5 text-sm placeholder:text-ink-mute focus-ring"
      />
    </div>
  );
}

function LabeledTextarea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <span className="smallcaps text-[10px] text-ink-mute">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="mt-1 w-full resize-y rounded-md border border-line bg-bg-elevated/60 px-2.5 py-1.5 text-sm placeholder:text-ink-mute focus-ring"
      />
    </div>
  );
}

function ChipToggleGrid({
  items,
  selected,
  onToggle,
  tone,
}: {
  items: { id: string; labelKey: string }[];
  selected: string[];
  onToggle: (id: string) => void;
  tone: "leaf" | "plum";
}) {
  const { t } = useTranslate();
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((it) => {
        const active = selected.includes(it.id);
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onToggle(it.id)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors focus-ring",
              active && tone === "leaf" && "border-leaf/50 bg-leaf/15 text-leaf",
              active && tone === "plum" && "border-plum/50 bg-plum/15 text-plum",
              !active && "border-line bg-bg-elevated/60 text-ink-dim hover:text-ink",
            )}
          >
            {t(it.labelKey)}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------

function toggle(arr: string[], id: string): string[] {
  return arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
}

function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  return b.every((x) => s.has(x));
}

// Used to silence the unused-import warning during partial wiring.
const _trash = Trash2;
void _trash;

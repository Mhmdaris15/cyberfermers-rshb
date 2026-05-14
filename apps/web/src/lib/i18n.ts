// =====================================================================
//  i18n.ts — Tolgee setup for the web app.
//
//  Two modes, picked automatically by environment:
//
//    1. STATIC (default, prod, no env keys):
//       Locales bundled at build time from src/locales/{lang}.json.
//       Zero network, zero flash, zero cost. Used in production.
//
//    2. CONNECTED (dev, when VITE_TOLGEE_API_URL + API_KEY are present):
//       Tolgee in-context editing tools light up. Alt-click any string
//       opens the live editor; saves go to the Tolgee project. Static
//       JSON is still used as the offline fallback so dev never blocks
//       on network.
//
//  Switching to Tolgee Cloud later requires NOTHING in the code — just
//  drop the two env vars into the build, ship the same bundle.
//
//  Language priority on first paint, in order:
//    1. localStorage value (`svoe.lang`) — explicit user choice
//    2. navigator.language prefix match
//    3. fallback "ru"
// =====================================================================

import { DevTools, FormatSimple, Tolgee } from "@tolgee/react";

import en from "@/locales/en.json";
import ru from "@/locales/ru.json";

export const SUPPORTED_LANGS = ["ru", "en"] as const;
export type Lang = (typeof SUPPORTED_LANGS)[number];

export const LANG_STORAGE_KEY = "svoe.lang";

const FALLBACK: Lang = "ru";

// ── language detection ───────────────────────────────────────────────

function isLang(v: unknown): v is Lang {
  return typeof v === "string" && (SUPPORTED_LANGS as readonly string[]).includes(v);
}

export function detectInitialLanguage(): Lang {
  if (typeof window === "undefined") return FALLBACK;
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  if (isLang(stored)) return stored;
  const nav = window.navigator.language?.slice(0, 2).toLowerCase();
  if (isLang(nav)) return nav;
  return FALLBACK;
}

export function persistLanguage(lang: Lang) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  // Mirror to a cookie so SSR/edge proxies can read it too. Cheap, optional.
  document.cookie = `${LANG_STORAGE_KEY}=${lang}; path=/; max-age=31536000; SameSite=Lax`;
  // Drive the <html lang> attribute for assistive tech + CSS :lang() selectors.
  document.documentElement.setAttribute("lang", lang);
}

// ── Tolgee instance ──────────────────────────────────────────────────

const isDev = import.meta.env.DEV;
const apiUrl = import.meta.env.VITE_TOLGEE_API_URL as string | undefined;
const apiKey = import.meta.env.VITE_TOLGEE_API_KEY as string | undefined;

let instance = Tolgee()
  .use(FormatSimple());

if (isDev) {
  instance = instance.use(DevTools());
}

export const tolgee = instance.init({
  language: detectInitialLanguage(),
  fallbackLanguage: FALLBACK,
  availableLanguages: [...SUPPORTED_LANGS],
  // No explicit namespace: all keys live in Tolgee's empty/default
  // namespace, which matches how `staticData: { ru, en }` is registered.
  // (Earlier we set defaultNs: "common" — that caused every t() lookup
  // to miss because staticData wasn't keyed by `"<lang>:common"`. The
  // dot-prefixed keys like `landing.hero.title.line1` are flat strings,
  // not namespace separators — FormatSimple treats dots as literal.)
  // Static bundles always present — guarantees no flash of untranslated content.
  staticData: { ru, en },
  // Cloud connection lights up dev tools when keys are set. Prod ignores both
  // and falls back to staticData. This is the recommended Tolgee shape.
  apiUrl,
  apiKey,
});

import { BookOpen, BookText, ChefHat, Share2, BellRing, type LucideIcon } from "lucide-react";

import { createFarmerStory } from "@/lib/stories";
import { createFarmerBlog } from "@/lib/blogs";
import { createFarmerRecipe } from "@/lib/recipes";
import { createFarmerSocialPost } from "@/lib/social";
import { createFarmerPush } from "@/lib/push";

// =====================================================================
//  AI Workspace lib (phase 9).
//
//  Pure FE — no new HTTP endpoints. The two interesting things this
//  file owns:
//
//    1. Starter packs — categorised seed prompts surfaced in the
//       StarterRail. Each prompt is a one-tap launch for the session.
//    2. Save-as router — converts an arbitrary AI response string into
//       a draft on any content module (Stories/Blogs/Recipes/Social/
//       Push) by routing to that module's existing freeform-create
//       endpoint. This is the move that ties the workspace into the
//       rest of the platform-OS.
// =====================================================================

// ─── starter packs ─────────────────────────────────────────────────────

export interface StarterPack {
  title: string;
  icon: LucideIcon;
  tone: string; // tailwind text/border colour class root, e.g. "leaf" → uses --leaf
  prompts: string[];
}

export const STARTER_PACKS: StarterPack[] = [
  {
    title: "Кампании",
    icon: BellRing,
    tone: "leaf",
    prompts: [
      "Что важного на ближайшие 14 дней?",
      "Какие события через месяц можно отыграть?",
      "Покажи прошлые успешные кампании для подобной ситуации",
      "Какой канал даст лучший ROI на эту неделю?",
    ],
  },
  {
    title: "Контент",
    icon: BookOpen,
    tone: "plum",
    prompts: [
      "Напиши историю о пасеке для постоянных покупателей",
      "Сделай 3 идеи для поста в соцсети про Медовый Спас",
      "Придумай 5 заголовков для блога про сезонную ягоду",
      "Сгенерируй пуш на акцию выходного дня",
    ],
  },
  {
    title: "Тренды",
    icon: Share2,
    tone: "sky",
    prompts: [
      "Какие тренды сейчас драйвят продажи?",
      "Что покупают конкуренты в моей категории?",
      "Объясни, почему растёт интерес к рецептам с ферментацией",
      "Какие хэштеги работают в моей нише?",
    ],
  },
  {
    title: "Продукты",
    icon: ChefHat,
    tone: "amber",
    prompts: [
      "Какие мои товары без тегов — слепое пятно",
      "Подбери продукты под аудиторию ЗОЖ",
      "Какие SKU забыты в плане больше 30 дней?",
      "Найди продукты для рецепта сырников",
    ],
  },
];

// ─── slash commands ────────────────────────────────────────────────────

export type SlashKind =
  | "explain"
  | "regen"
  | "clear"
  | "save-story"
  | "save-blog"
  | "save-recipe"
  | "save-social"
  | "save-push";

export interface SlashCommand {
  trigger: string;     // what the user types: `/explain` etc.
  kind: SlashKind;
  label: string;       // shown in palette
  hint: string;        // shown as helper text
  Icon: LucideIcon;
  takesArg: boolean;   // does it expect free-text after the command?
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { trigger: "/explain",     kind: "explain",     label: "Объяснить",                 hint: "Развернуть тему", Icon: BookText, takesArg: true },
  { trigger: "/regen",       kind: "regen",       label: "Повторить",                 hint: "Сгенерировать снова",            Icon: BookText, takesArg: false },
  { trigger: "/save-story",  kind: "save-story",  label: "Сохранить как историю",     hint: "Создать draft Stories",         Icon: BookOpen, takesArg: false },
  { trigger: "/save-blog",   kind: "save-blog",   label: "Сохранить как блог",        hint: "Создать draft Blogs",           Icon: BookText, takesArg: false },
  { trigger: "/save-recipe", kind: "save-recipe", label: "Сохранить как рецепт",      hint: "Создать draft Recipes",         Icon: ChefHat,  takesArg: false },
  { trigger: "/save-social", kind: "save-social", label: "Сохранить как соцпост",     hint: "Создать draft Social",          Icon: Share2,   takesArg: false },
  { trigger: "/save-push",   kind: "save-push",   label: "Сохранить как push",        hint: "Создать draft Push",            Icon: BellRing, takesArg: false },
  { trigger: "/clear",       kind: "clear",       label: "Очистить диалог",           hint: "Стереть текущую сессию",        Icon: BookText, takesArg: false },
];

/** Match the user's draft against the slash palette. Returns the
 *  candidate set the composer should render. Empty if the draft
 *  doesn't start with `/`. */
export function matchSlash(draft: string): SlashCommand[] {
  if (!draft.startsWith("/")) return [];
  const head = draft.split(/\s/)[0].toLowerCase();
  if (head === "/") return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter((c) => c.trigger.startsWith(head));
}

// ─── save-as router ────────────────────────────────────────────────────

export type SaveKind = "story" | "blog" | "recipe" | "social" | "push";

export const SAVE_TARGETS: { kind: SaveKind; label: string; Icon: LucideIcon; tone: string }[] = [
  { kind: "story",  label: "Историю", Icon: BookOpen, tone: "plum" },
  { kind: "blog",   label: "Блог",    Icon: BookText, tone: "sky" },
  { kind: "recipe", label: "Рецепт",  Icon: ChefHat,  tone: "amber" },
  { kind: "social", label: "Соцпост", Icon: Share2,   tone: "sky" },
  { kind: "push",   label: "Push",    Icon: BellRing, tone: "rust" },
];

export interface SaveResult {
  kind: SaveKind;
  id: string;             // bare generated_content id
  plan_card_id?: string;  // bare plan_card id if one was created
  route: string;          // FE route to the created draft's module page
}

/** saveAs takes an arbitrary AI response (the assistant's text) and a
 *  target kind, derives a sensible title/body shape for that module,
 *  and POSTs to the module's freeform-create endpoint. Returns the
 *  created row id + the FE route to land on. */
export async function saveAs(
  farmerID: string,
  kind: SaveKind,
  text: string,
): Promise<SaveResult> {
  // Derive a title from the first non-empty line; everything else is body.
  const lines = text.trim().split("\n");
  const firstLine = lines.find((l) => l.trim()) ?? "Без названия";
  const title = firstLine.replace(/^#+\s*/, "").trim().slice(0, 200);
  const restBody = lines.slice(lines.indexOf(firstLine) + 1).join("\n").trim();

  switch (kind) {
    case "story": {
      const r = await createFarmerStory(farmerID, {
        title,
        body: restBody || text.trim(),
        create_plan_card: true,
      });
      return {
        kind,
        id: r.story.id ?? "",
        plan_card_id: r.plan_card_id,
        route: `/farmer/${farmerID}/stories`,
      };
    }
    case "blog": {
      // Use the first paragraph (after title) as the lede if present.
      const paras = restBody.split(/\n{2,}/);
      const lede = paras[0]?.trim() ?? "";
      const body = paras.slice(1).join("\n\n").trim() || restBody;
      const r = await createFarmerBlog(farmerID, {
        title,
        lede: lede || undefined,
        body: body || text.trim(),
        create_plan_card: true,
      });
      return {
        kind,
        id: r.blog.id ?? "",
        plan_card_id: r.plan_card_id,
        route: `/farmer/${farmerID}/blogs`,
      };
    }
    case "recipe": {
      // We can't reliably extract structured ingredients/steps from a
      // free-form AI response. Save the response as the recipe's notes
      // so the operator can rewrite into the structured form afterward.
      const r = await createFarmerRecipe(farmerID, {
        title,
        lede: undefined,
        notes: restBody || text.trim(),
        create_plan_card: true,
      });
      return {
        kind,
        id: r.recipe.id ?? "",
        plan_card_id: r.plan_card_id,
        route: `/farmer/${farmerID}/recipes`,
      };
    }
    case "social": {
      const r = await createFarmerSocialPost(farmerID, {
        title,
        caption: restBody || text.trim(),
        platforms: ["instagram", "telegram"],
        create_plan_card: true,
      });
      return {
        kind,
        id: r.post.id ?? "",
        plan_card_id: r.plan_card_id,
        route: `/farmer/${farmerID}/social`,
      };
    }
    case "push": {
      // Headline = title trimmed harder; body = next line (or full text
      // if there's no separator). Operator can refine in the push editor.
      const headline = title.slice(0, 60);
      const body = (restBody || text.trim()).slice(0, 178);
      const r = await createFarmerPush(farmerID, {
        title,
        headline,
        body,
        urgency: "normal",
        create_plan_card: true,
      });
      return {
        kind,
        id: r.push.id ?? "",
        plan_card_id: r.plan_card_id,
        route: `/farmer/${farmerID}/push`,
      };
    }
  }
}

// ─── tiny session persistence (localStorage) ──────────────────────────

const STORAGE_KEY = "ai-workspace.session.v1";

export interface WorkspaceMessage {
  role: "user" | "assistant";
  text: string;
  ts: number;
  actions?: { label: string; href: string }[];
  used?: string[];                  // tool names the BE invoked
}

export function loadSession(farmerID: string): WorkspaceMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY + ":" + farmerID);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkspaceMessage[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSession(farmerID: string, msgs: WorkspaceMessage[]): void {
  try {
    // Cap session to last 100 messages to avoid runaway storage growth.
    const trimmed = msgs.slice(-100);
    localStorage.setItem(STORAGE_KEY + ":" + farmerID, JSON.stringify(trimmed));
  } catch {
    // localStorage disabled or quota exceeded — session is lost on
    // refresh. The conversation still works in-memory.
  }
}

export function clearSession(farmerID: string): void {
  try {
    localStorage.removeItem(STORAGE_KEY + ":" + farmerID);
  } catch {
    /* noop */
  }
}

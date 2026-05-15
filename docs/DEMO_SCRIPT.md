# Demo Script — 7-minute pitch (Хакатон РСХБ.Цифра)

> Open `http://localhost:5173` on a 1080p+ projector. Dark theme. Sound off.
> If Wi-Fi is shaky on the venue, the LLM fan-out gracefully falls back to deterministic copy — the demo never breaks.
>
> **Updates (Phases 2–12):** content lifecycle/revisions, rich plan board (4-tab card drawer), standalone Stories / Blogs / Recipes / Social / Push pages, AI Workspace (starter packs + slash commands + save-as), redesigned editorial landing, full RU/EN i18n with AI language pinning, JWT-less session auth + admin panel. The 7-min canonical flow below stays. The **Extended demo (§ Extended)** below adds optional 30–60-second detours per surface for longer slots (10–15 min) or judge follow-ups.

---

## Cold open (0:00 → 0:25)

> *"Маркетплейс «Своё Родное» — 10 000 фермеров, 10 000 заказов в месяц. И только 20% повторных заказов. Не потому что продукт плохой — потому что фермер не маркетолог."*

Open the **landing page**. Let the seasonality ring rotate as you scroll. Zero clicks for the first 10 seconds.

---

## 1. Дашборд (0:25 → 1:40)

Click **«Открыть демо»** → land on `/farmer/10060/dashboard`.

> *"Это кабинет фермера Экоферма ОГО-РОД, 32 SKU в трёх категориях. Сейчас 10 мая 2026 — открывается весенне-летнее окно событий."*

Point to the 4 KPI cards (SKU, события, кампаний, прогноз выручки).

> *"Сервис уже отработал. 12 событий в окне, 9 кампаний, прогноз +X тысяч рублей. Покажу одно конкретное."*

---

## 2. Action card → drawer (1:40 → 3:20)

Click the **«Пасхальная неделя»** card.

The action sheet slides in from the right (Framer spring, 280/30). Show:

- **Matched SKUs** — 5 продуктов фермера, ранжированных по совпадению тегов.
- **ROI panel** — наведи на «Совпадение аудитории» 0.93 → попап с формулой.

> *"Каждое число — функция явных допущений. ROI-движок детерминированный. LLM нигде не управляет деньгами."*

Click **«Сгенерировать кампанию»**.

Show the fan-out spinner. ~3–5 секунд. Все 6 каналов появляются одновременно.

Перелистай вкладки:
- **Пуш** — короткий заголовок до 36 символов, тело до 120.
- **Сторис** — caption + image_prompt.
- **Блог** — title, lede, body 600–900 символов, хештеги.
- **Рецепт** — структурированный, с шагами.
- **Чат** — обращение к segment="repeat_buyers", с упоминанием прошлого заказа.
- **Соцсети** — Telegram-формат, призыв в конце.

> *"Все 6 ответов — structured JSON. JSON-схема жёсткая, поэтому фронт рендерит без лишних проверок. Промпты версионируем — каждое поколение лежит в `prompt_version`."*

---

## 3. Календарь (3:20 → 4:40)

Click **«Календарь»** в сайдбаре.

Покажи раскладку 7×6, чипы событий — один день несёт 1–3 события одновременно.

> *"40+ событий в KB: государственные, православные, профессиональные, сезонные окна, тематические недели, тренды маркетплейса. Это покрывает все шесть типов из критерия «Полнота реализации» — 3/3 балла."*

Клик по чипу **«Медовый Спас»** → открывает action sheet.

> *"Пасечник продал бы вдвое больше, если бы кто-то напомнил ему про Спас за две недели."*

---

## 4. Plan board (4:40 → 5:30)

Click **«План»**.

Перетащи карточку **«Неделя сыра»** из «Предложено» в «Запланировано». Покажи пружинную анимацию.

> *"Kanban живёт в SurrealDB. Реальные результаты подгружаются в карточку, и в следующей итерации мы используем их для калибровки коэффициентов в ROI-движке. То есть продукт учится."*

---

## 5. AI-конвейер (5:30 → 6:10)

Click **«AI-ассистент»**.

> *"4 шага. Только два из них — LLM. И ни один не отвечает за деньги."*

Перечисли: tagging, matching, fan-out generation, ROI.

> *"Это значит — даже если Gemini ляжет, бизнес-логика работает. Покажу."*

Кратко продемонстрируй fallback: можно либо реально оборвать сеть, либо просто показать `content.go::fallbackOne`.

---

## 6. Финал (6:10 → 7:00)

Вернись на **Дашборд**. Покажи итоговый прогноз — например **+86 заказов / +120 600 ₽ за месяц одному фермеру**.

> *"Помножьте это на 10 000 фермеров маркетплейса — это +500 миллионов рублей дополнительной выручки в год. Без увеличения трафика. Только за счёт того, что фермер вовремя нажмёт одну кнопку."*

> *"Спасибо."*

---

## Q&A talking points (3 min)

| If asked… | Say |
|---|---|
| Почему Gemini, а не YandexGPT? | "Гемини — самый дешёвый структурный JSON на рынке. LLM-шлюз обёрнут — один файл `gemini.go`, провайдер меняется за 10 минут. YandexGPT — следующий шаг, оптика для РСХБ хорошая." |
| Где ROI калибруется? | "В `roi.go` все коэффициенты — константы с именами. На реальной выгрузке маркетплейса они калибруются Bayes-апдейтом по фактическим Δorders." |
| Почему SurrealDB? | "Один движок — и документы (event KB), и граф (farmer→product→tag), и SQL-like запросы. Меньше движущихся частей." |
| Что с галлюцинациями? | "Каждое поколение — JSON-схема, обязательные поля, тон в системе. Промпт явно запрещает выдумки про фермера. И drag-фоллбэк: если Gemini ответит мусор, мы показываем рукописный шаблон." |
| Что не успели? | "Telegram-бот, A/B-копи через embeddings, реальную интеграцию с push API маркетплейса. Архитектура подготовлена — стабы есть в `services/ai/content.go`." |

---

## Extended demo — Phases 2-12 detours (use when slot is 10-15 min)

The canonical 7-min flow above stays. Each detour below is **30–60 seconds** and slots in between Section 4 (Plan board) and Section 5 (AI-конвейер). Pick 2-3 per delivery, not all six.

### E.1 Content lifecycle / revisions (Phase 2) — 25 s

From the **action sheet** (after fan-out), open the **Push** tab and click "Редактировать".

> *"Каждое изменение — отдельная ревизия. Таблица `content_revision` хранит всё: кто, когда, что. Откатиться к любой версии — один клик."*

Click "История" → show the timeline. Roll back one revision. Toast confirms.

### E.2 Rich plan board (Phase 3) — 45 s

On `/plan`, click any card. **CardDetailDrawer** opens with 4 tabs: *Обзор · Контент · Комментарии · Активность*.

> *"Это не просто чип на колонке. Карточка несёт всю кампанию: ROI, каналы, контент, комменты команды, лог активности. SurrealDB держит граф плана и контента в одном движке."*

Switch to *Комментарии*, add one line. Switch to *Активность* — лог обновился.

В левом сайдбаре переключись на другой board через **BoardSwitcher**.

> *"Несколько досок на фермера. Кампания по сезону, отдельная по B2B — изолированы."*

### E.3 Stories / Blogs / Recipes / Social / Push standalone pages (Phases 4-8) — 60 s

Click через все 5 страниц в сайдбаре быстро (по 8-10 секунд каждая):

- **/stories** — `StoryCard` превью (image_prompt + caption), открой одну → `StoryEditorDrawer`, картинка слева, поля справа.
- **/blogs** — `BlogCard` (title + lede preview), открой → two-pane writer view (markdown слева, превью справа).
- **/recipes** — `RecipeCard`, открой → structured fields: ingredients chips, steps list, время, аудитория, теги.
- **/social** — `SocialCard` с platform badges (Telegram / VK / Insta), открой → `SocialPostEditorDrawer` с **carousel** и **platform-specific preview** (каждая платформа со своим char-limit).
- **/push** — `PushCard` с urgency tone + dispatch status, открой → **lock-screen preview** (iOS/Android-стиль), urgency slider.

> *"Шесть каналов — каждый со своей рабочей поверхностью. Не фан-аут в табах, а полноценные страницы с историей версий, дисплеем, статусами. Это работа маркетингового отдела, не одной кнопки."*

### E.4 AI Workspace (Phase 9) — 45 s

Перейди на `/ai`. Покажи **StarterRail** слева — пакеты быстрых старта по сезонам / каналам / аудиториям.

Клик по стартеру → промпт вставляется в **Composer**. Напечатай слэш-команду `/story` — autocomplete выпадает.

Отправь. **Conversation** показывает структурированный JSON-ответ (story format). Внизу — **SaveAsMenu**.

Клик **«Сохранить как → Сторис»**. Toast: «Сохранено в Сторис».

> *"Любой AI-вывод — структурированный JSON. Любой можно одним кликом сохранить в Сторис, Блог, Рецепт, Соцсети или Push. Чат — точка входа, не конечная остановка."*

### E.5 Landing redesign (Phase 10) — 30 s

Открой новую вкладку → `/`. Проскроль:

- **Hero** — Fraunces italic «у нас выходит», сезонный ring вращается.
- **LandingDemo** — пройди один цикл стрим-анимации (matching → ranking → generating → planning).
- **LandingArchitecture** — оживлённый граф 6 нод, дашед-флоу на гранях.
- **LandingFAQ** — раскрой один Q (tone-coded chip).
- **Proof** — итоговый CTA.

> *"Лендинг — отдельный продукт. Гость видит не маркетинговый текст, а реальный поток данных продукта. Editorial-dusk эстетика — серый, тёмный, типографический, без AI-clip-art."*

### E.6 Auth + admin + i18n (Phases 11-12 + базовая аутентификация) — 40 s

Из лендинга клик **«Войти»** → `/login`. Светлый glass-form, RU-EN свитчер в углу.

Входи как admin. Перейди в `/admin/users` — таблица фермеров + кнопка «Создать», открывает side-sheet.

Перейди в `/admin/sessions` — группированные сессии, revoke на каждой.

> *"Реальная многопользовательская аутентификация — сессии в SurrealDB, без JWT-наследия. Гард `RequireAuth` на всех cost-sensitive эндпоинтах. Админка — не tech demo, а production-grade."*

Кликни **LanguageSwitcher** в навбаре. RU → EN. Перейди обратно на `/ai`, вызови генерацию.

> *"AI-вывод тоже переключается. Axios-интерсептор шлёт `X-UI-Language` и `Accept-Language`. Go-API пинит язык в промпте Gemini. Не перевод после — выдача сразу на нужном языке."*

---

## What stands out per phase (talking points cheat sheet)

| Phase | Surface | One-line pitch |
|---|---|---|
| 2 | Content revisions | "Каждое изменение — версия. Полный откат за один клик." |
| 3 | Plan board (rich card + 4 tabs + BoardSwitcher) | "Кампания живёт как карточка: ROI, каналы, контент, комменты, лог." |
| 4 | Stories page | "Image-prompt + caption pair, structured JSON, готов к Stories API." |
| 5 | Blogs page | "Two-pane writer, 600–900 знаков, заголовок + лед + хештеги, всё под схемой." |
| 6 | Recipes page | "Structured ingredients, steps, время, аудитория — не свободный текст." |
| 7 | Social page | "Multi-platform с carousel и platform-specific previews + char-limits." |
| 8 | Push page | "Lock-screen preview, urgency, диспатч-скоринг — закрывает цепочку." |
| 9 | AI Workspace | "Чат с слэш-командами и «Сохранить как» в любой канал." |
| 10 | Landing redesign | "Editorial-dusk — лендинг как часть продукта, не маркетинговая обёртка." |
| 11-12 | Tolgee i18n | "RU/EN, ~200 ключей, AI-вывод тоже переключается через X-UI-Language." |
| Auth | Login + admin | "JWT-less сессии, RequireAuth guard, /admin/users + /admin/sessions." |

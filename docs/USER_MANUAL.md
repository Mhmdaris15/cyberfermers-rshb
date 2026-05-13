# User Manual — Свое Родное · Farmer Marketing Calendar

> **Кто это для:** фермер, продающий через `svoe-rodnoe.ru`, или менеджер
> категории, которому надо за 30 секунд понять, что продвигать на следующей
> неделе и какой канал использовать.
>
> **Что делает:** разбирает каталог фермера, сопоставляет его SKU с
> курируемой базой событий (праздники, православный календарь, тематические
> недели, сезонность), и через Gemini генерирует готовые к запуску
> маркетинговые материалы для 6 каналов — с детерминированным ROI-движком
> поверх всего.
>
> **Демо-фермер:** Экоферма ОГО-РОД (`org_id=10060`) →
> `http://localhost:5173/farmer/10060/dashboard`

---

## 1 · Карта приложения

```
                                ┌──────────────────────┐
   /                            │   Landing            │
                                │   (маркетинг / вход) │
                                └──────────┬───────────┘
                                           │
                                ┌──────────▼───────────┐
   /farmers                     │  Farmers Picker      │
                                │  выбор фермы         │
                                └──────────┬───────────┘
                                           │
                          ┌────────────────┴────────────────┐
                          │   AppShell  (sidebar nav)       │
                          │   /farmer/:farmerId/...         │
                          └──┬──────┬──────┬──────┬──────┬──┘
                             │      │      │      │      │
              dashboard ─────┘      │      │      │      └───── settings
                                    │      │      │
                            calendar       plan   ai      products
```

Все пути, кроме `/` и `/farmers`, нуждаются в `farmerId` (это `org_id`
из исходного xlsx). На каждой странице справа снизу плавает кнопка
**AI Чат** — она доступна откуда угодно внутри `AppShell`.

---

## 2 · Полный пользовательский поток

### 2.1 · Шаг 1 — Лендинг (`/`)

- Тёмный «agri-tech» эстетик, анимированное SVG-колесо календаря,
  glass-карточки.
- Одна CTA-кнопка → `/farmers`.
- Можно использовать как презентационный экран на хакатоне; иначе
  пропустить.

### 2.2 · Шаг 2 — Выбор фермера (`/farmers`)

- Список всех фермеров, импортированных из `data/raw/farmers_sku.xlsx`.
- Поиск по имени, количеству SKU, регионам.
- Клик по карточке → `/farmer/<org_id>/dashboard`.
- На хакатоне всегда видно «Экоферма ОГО-РОД» (демо).

### 2.3 · Шаг 3 — Дашборд (`/farmer/:farmerId/dashboard`)

Главный экран фермера. Состоит из 5 секций сверху вниз:

| Секция | Что делает |
|---|---|
| **AI Boot Sequence** | Анимация загрузки: рекомендатель проходит по 4 слоям (tag overlap → category → embedding → boost), показывает что считает прямо сейчас. Только при первом заходе. |
| **Executive Summary** | 3 KPI-карты — прогноз выручки на 30 дней, активных кампаний в плане, top-канал по вкладу. Числа «живут» (анимация цифр), при изменении плана пересчитываются через SSE. |
| **Forecast Curve** | Кумулятивная кривая ROI на 30 дней вперёд, нарисованная самописным SVG. Точки — события, цвета — статус карточки в плане. |
| **Action Cards** | До 6 ближайших рекомендаций. Каждая карточка содержит: <ul><li>**Событие** + дата + тип (праздник / православный / сезонный …)</li><li>**Confidence Badge** — насколько модель уверена в матче</li><li>**Urgency Badge** — `🔥 сегодня`, `⏳ скоро`, обычный</li><li>**Match reasons** — чипы вида `tag:easter`, `cat:dairy`, `trend:+12%`, `mem:0.8`</li><li>**Live glow** — пульс по краю карточки если кампания уже `live`</li></ul>Клик → открывает Action Sheet (см. 2.4). |
| **Category Heatmap** | Карта `категория × месяц`, ячейка — рекомендованная активность. Помогает увидеть «дыры» в годовом плане. |

### 2.4 · Шаг 4 — Action Sheet (drawer)

Открывается поверх любой страницы при клике на карточку. Имеет 4 таба:

| Таб | Что внутри |
|---|---|
| **Объяснение** | Почему модель предложила это событие именно для этого фермера. Чипы (`tag:vegan + cat:vegetables + trend:+8%`), плюс одна фраза от Gemini. |
| **Контент** | 6 каналов (push / story / blog / recipe / chat / social) с A/B-вариантами для каждого. <br>• Кнопка `Сгенерировать` запускает Gemini только для тех каналов, которых ещё нет в кэше (см. 4.2).<br>• Для каждой пары `канал × вариант` показывается версия промпта — можно сравнить, что поменялось.<br>• «Скопировать» / «Запланировать» рядом с каждым черновиком. |
| **ROI / каналы** | Детерминированный движок: ввод (скидка %, охват, конверсии) → выход (выручка, валовая прибыль, ROI %). Бар-чарт «Channel Mix» показывает вклад каждого канала. Все коэффициенты прозрачные — см. `internal/services/recommendation/roi.go`. |
| **Добавить в план** | Один клик → создаёт карточку со статусом `proposed`. После этого она появляется в Plan Board (2.6) и в Executive Summary. |

### 2.5 · Шаг 5 — Календарь (`/farmer/:farmerId/calendar`)

- **Seasonality Ring** — круговая годовая диаграмма; видно, в какие
  месяцы у фермера «горячо» по сезонности.
- **Month Switcher** — стрелки или клик по месяцу из кольца.
- **Month Grid** — 30/31 ячейка, в каждой — события с цветовой
  кодировкой типа. Hover → tooltip с описанием события и
  количеством релевантных SKU.
- **Mini Strip** — горизонтальная полоса 14 дней «снизу», для быстрой
  навигации.
- Клик по любому событию → Action Sheet (2.4).

### 2.6 · Шаг 6 — Plan Board (`/farmer/:farmerId/plan`)

Канбан с 4 колонками:

```
  proposed ──► planned ──► live ──► completed
```

- Drag-and-drop карточек между колонками (Framer Motion Reorder).
- При каждом переходе пишется запись в `ai_memory` с весом сигнала:
  `proposed=0.05`, `planned=0.40`, `live=0.80`, `completed=1.00`.
  Эта память влияет на ранжирование будущих рекомендаций — то, что
  довели до `completed`, повышает похожие события в следующих
  предложениях.
- Optimistic UI с rollback: если бэк отвалился, карточка вернётся
  обратно с тостом-ошибкой.
- SSE-стрим обновляет доску в реальном времени (если кто-то другой
  двигает карточки в той же ферме).

### 2.7 · Шаг 7 — AI Insights (`/farmer/:farmerId/ai`)

Проактивные инсайты от движка `insights/engine.go`:

- «У вас 47 SKU без тегов — это слепое пятно для рекомендатора»
- «Категория `мёд` не появлялась в плане 3 месяца — Медовый Спас через 12 дней»
- «Топ-канал по ROI за прошлые 30 дней — recipe, но в плане его 0»
- … 4–8 таких карточек, отсортированных по `impact_score`.

Каждый инсайт имеет одну CTA — «Создать карточку с приоритетом 1» или
«Открыть подходящий SKU».

### 2.8 · Шаг 8 — Каталог продуктов (`/farmer/:farmerId/products`)

- Таблица всех SKU фермера.
- Колонки: название, категория, цена, теги, последнее обновление.
- Фильтр по категории, поиск по названию.
- Клик по строке → дрожер с подробностями SKU, его эмбеддингом
  (compact), и списком событий, к которым он подходит (через
  `fits` edges из графа).

### 2.9 · Шаг 9 — Настройки (`/farmer/:farmerId/settings`)

- Переключение тёмной / светлой темы (по умолчанию тёмная).
- Регенерация тегов для всего каталога (вызывает `tag-products`).
- Сброс `ai_memory` для этой фермы.
- Информация об использовании Gemini API за период.

### 2.10 · Глобально — AI Чат (плавающая кнопка)

Видно на каждой странице внутри `AppShell`. Открывает drawer с
5 стартовыми чипами и свободным текстовым полем:

| Стартовый чип | Что делает (под капотом) |
|---|---|
| «Что важного на ближайшие 14 дней?» | `get_upcoming_events(days=14)` |
| «Какие товары подойдут на Пасху?» | `get_skus_matching(event="easter")` |
| «Покажи мои слабые места» | `get_insights()` |
| «Что сейчас в плане?» | `get_plan_status()` |
| «Что будет, если запустить 20% скидку?» | `simulate_promo(discount=0.20, channels=[…])` |

Чат — это **grounded** интерфейс к Gemini: модель не «фантазирует»,
а пользуется только данными из этих 5 инструментов плюс
knowledge graph SurrealDB. Каждый ответ содержит цитаты на конкретные
SKU / события.

---

## 3 · Реализованные функции

### 3.1 · Backend

| Слой | Что есть |
|---|---|
| **Catalog ETL** | `cmd/import` — читает `farmers_sku.xlsx`, нормализует 3 491 SKU в SurrealDB |
| **Event KB** | `data/seed/events.yml` — 40+ событий, 6 категорий |
| **Audiences** | `data/seed/audiences.yml` — 6 buyer-персон (ЗОЖ, родители, гурманы, gift-buyers, fitness, students) с `prefers` edges |
| **Trends** | `data/seed/trends.yml` — 5 маркетплейс-трендов с `influences` edges на события |
| **Seasonal windows** | `data/seed/seasonal_windows.yml` — 12 окон с `covers` edges |
| **Tagger** | `services/tagging` — детерминированные правила + Gemini fallback, выдаёт fine-grained теги (easter, vegan, premium, gift, gourmet, honey, seasonal, …) |
| **Recommender** | `services/recommendation` — 4 слоя: tag overlap → category → lexical → boost (trend × memory × vector cosine) |
| **ROI engine** | `services/recommendation/roi.go` — детерминированный, прозрачный, все коэффициенты в коде |
| **Content generator** | `services/ai/gemini.go` + `prompts.go` — 6 каналов, A/B варианты, versioned promtps |
| **Plan service** | `services/plan` — Kanban CRUD + запись в `ai_memory` на каждый переход |
| **Insights engine** | `services/insights` — 4–8 проактивных инсайтов на правилах |
| **Chat service** | `services/chat` — 5 grounded tools + multi-turn loop |
| **SSE stream** | `handlers/stream.go` — 1.5 сек poll + diff detection, `event: plan` / `event: suggestions` |

### 3.2 · SurrealDB-native knowledge graph

- **11 типов рёбер:** `owns`, `fits`, `targets`, `prefers`, `influences`,
  `triggers`, `generated`, `launched`, `derived_from`, `references`, `covers`
- **HNSW vector indexes** (DIMENSION 768, COSINE) на `events`, `products`,
  `audiences`, `trends` — суб-миллисекундный KNN через `<|k,COSINE|>`
- **AI memory layer** (`ai_memory` table + `references` edge) — каждое
  движение карточки оставляет след; влияет на ранжирование будущих
  рекомендаций

### 3.3 · Frontend

- Дизайн-система Fraunces (serif) + IBM Plex Sans, dark agri-tech палитра,
  grain overlay, glass utilities, `tnum` tabular figures
- Кастомные SVG-чарты (без Recharts/Chart.js):
  - `ForecastCurve` — кумулятивная кривая
  - `CategoryHeatmap` — категория × месяц
  - `ChannelMixBar` — вклад каналов в ROI
- Framer Motion для всех переходов
- React Query с `staleTime` + optimistic updates с rollback
- SSE подключение через `EventSource` с diff-детекцией

### 3.4 · Оптимизация затрат Gemini

- `batchEmbedContents` — 100 текстов за вызов (≈ −99% к API-вызовам vs one-by-one)
- SHA-256 content-hash кэш в `embedding_cache` — повторный прогон на
  стабильном каталоге = 0 API-вызовов
- `/generate` пропускает каналы, у которых уже есть строка с тем же
  `variant` + `prompt_version` — повторное открытие Action Sheet = 0 вызовов
- Rate-limit knobs: `EMBED_RATE_LIMIT_PER_MIN`, `TAGGING_RATE_LIMIT_PER_MIN`

### 3.5 · Production-ready DevOps

- Разделённые окружения: `docker-compose.yml` (dev — только БД) vs
  `docker-compose.prod.yml` (всё в контейнерах)
- Multi-stage Dockerfiles, non-root runtime, healthchecks, JSON
  logging с rotation
- Cloudify-ready compose (см. [`DEPLOYMENT.md`](DEPLOYMENT.md))
- Coolify-совместимая упаковка: monorepo build context, фиксированный
  порт API в `environment:` (`API_PORT=8080`)

---

## 4 · Функции в разработке

### 4.1 · DevOps Operator (только что добавлен)

> Расположение: [`apps/devops/`](../apps/devops/) ·
> [README](../apps/devops/README.md)

Внутренний HTTP-сервис, оборачивающий **строго ограниченный** набор
операций Coolify API:

| Метод | Эндпоинт | Назначение |
|---|---|---|
| POST | `/deploy` | Триггер деплоя приложения (по UUID из allowlist) |
| GET | `/status` | Статус последнего или конкретного деплоя |
| GET | `/logs` | Логи контейнера приложения |
| POST | `/restart` | Перезапуск приложения |
| GET | `/health` | Liveness (без auth, без БД) |

Все эндпоинты, кроме `/health`, требуют `Authorization: Bearer
<DEVOPS_INTERNAL_TOKEN>` и проверяют, что `application_uuid` стоит в
`DEVOPS_ALLOWED_APPS` (пустой allowlist = всё запрещено).

**Зачем он:** дать AI-агентам (Claude Code, MCP-серверы, кастомные
крон-джобы) возможность запускать деплои **без** прав на Docker /
shell / kubectl. Слой policy + allowlist + structured logging +
constant-time auth.

**Что в планах:** MCP-интерпретатор для Claude Code — `apps/devops/cmd/mcp/`
с теми же 4 инструментами, transport JSON-RPC over stdio. Текущий
HTTP-сервис останется как «нижний слой»; MCP-сервер будет ещё одним
клиентом его API.

### 4.2 · Telegram-бот

Заглушка существует в коде, но не задеплоена. План:
- Уведомления о смене статуса карточки.
- Команда `/today` → 3 топ-рекомендации на сегодня.
- Команда `/draft <event>` → черновик контента в чат.

### 4.3 · Subscription nudge / bundle generator

В roadmap, упомянуты в README как «additional functionality». Идеи:
- **Subscription nudge:** «Этот покупатель уже взял мёд 3 раза — предложите подписку на 6 банок со скидкой».
- **Bundle generator:** комбинирует SKU по совпадающим аудиториям
  («ЗОЖ-набор», «Подарочная корзина к 8 марта»).

### 4.4 · Расширение event KB

Сейчас 40+ событий — достаточно для демо. План:
- Добавить событийный календарь по регионам РФ (Татарстан, Кавказ,
  Дальний Восток имеют локальные праздники).
- Подкачка из открытых источников (ICS-фиды).
- Auto-tagging новых событий через Gemini structured output.

### 4.5 · Multi-tenant production

Сейчас демо рассчитано на одну ферму на компанию. Для production-роли:
- Полноценная авторизация (сейчас её нет на фронте — все клики
  идут к farmer по `org_id` напрямую).
- RBAC: менеджер категории видит N ферм, фермер — одну свою.
- Rate-limiting на уровне tenant.

---

## 5 · Быстрый старт

### 5.1 · Локально (гибридный режим: БД в Docker, остальное нативно)

```powershell
# 0. предусловия: Docker Desktop, Go 1.22+, Node 20+

# 1. конфиг
Copy-Item .env.example .env
# вставить GEMINI_API_KEY

# 2. БД
.\dev.ps1 db           # docker compose up -d surrealdb

# 3. данные (один раз)
.\dev.ps1 import       # 3 491 SKU из xlsx
.\dev.ps1 seed         # события + аудитории + тренды + окна
.\dev.ps1 tag          # теги через правила + Gemini

# 4. API + Web (два окна)
.\dev.ps1 api          # :8080
.\dev.ps1 web          # :5173
```

Открыть [http://localhost:5173/farmer/10060/dashboard](http://localhost:5173/farmer/10060/dashboard).

### 5.2 · Production (всё в контейнерах)

См. [`DEPLOYMENT.md`](DEPLOYMENT.md) — там подробный runbook для
Cloudify и Coolify, TLS-проброс, secrets management и cost-protection knobs.

### 5.3 · DevOps Operator

См. [`apps/devops/README.md`](../apps/devops/README.md) — отдельный
сервис, отдельная среда (`.env.devops`).

---

## 6 · Куда смотреть дальше

| Хочу узнать про… | Файл |
|---|---|
| Архитектуру в целом | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| Почему SurrealDB | [`SURREALDB_ARCHITECTURE.md`](SURREALDB_ARCHITECTURE.md) |
| Деплой | [`DEPLOYMENT.md`](DEPLOYMENT.md) |
| Demo-скрипт на жюри | [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md) |
| Покрытие требований РСХБ | [`COVERAGE.md`](COVERAGE.md) |
| DevOps-операторе и MCP-интеграции | [`../apps/devops/README.md`](../apps/devops/README.md) |
| API эндпоинтах | `apps/api/internal/handlers/handlers.go` |
| Промптах Gemini | `apps/api/internal/services/ai/prompts.go` |
| ROI-движке | `apps/api/internal/services/recommendation/roi.go` |

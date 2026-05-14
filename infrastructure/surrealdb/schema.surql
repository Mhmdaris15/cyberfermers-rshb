-- =============================================================
--   КиберФермеры · Knowledge Graph schema
--
--   This is not a traditional relational schema. It models the
--   marketing intelligence domain as a graph of typed nodes and
--   RELATE-backed edges, with vector embeddings on every concept
--   that participates in semantic retrieval.
--
--   Layers used from SurrealDB:
--     • SCHEMAFULL for domain core (farmer, product, event, …)
--     • SCHEMALESS / FLEXIBLE for Gemini outputs and AI signals
--     • RELATE for typed relationships with metadata
--     • HNSW vector indexes for KNN semantic search
--     • Native indexes for date / status / ranking
--     • LIVE SELECT (engaged from the realtime stream layer)
--
--   The schema replaces what would otherwise require:
--     – Neo4j (graph)        → RELATE + graph traversal
--     – Pinecone (vector DB) → vector::similarity + HNSW
--     – Redis Pub/Sub        → LIVE SELECT diffs
--     – Postgres JSONB       → FLEXIBLE objects
--   …all in a single SurrealDB instance.
-- =============================================================

DEFINE NAMESPACE rshb;
USE NS rshb;
DEFINE DATABASE svoe_rodnoe;
USE DB svoe_rodnoe;

-- =============================================================
--   NODE TABLES  (SCHEMAFULL core)
-- =============================================================

-- ── farmer ──────────────────────────────────────────────────
DEFINE TABLE farmer SCHEMAFULL;
DEFINE FIELD organization_id     ON farmer TYPE int;
DEFINE FIELD shop_name           ON farmer TYPE string;
DEFINE FIELD description         ON farmer TYPE option<string>;
DEFINE FIELD region              ON farmer TYPE string;
DEFINE FIELD url                 ON farmer TYPE option<string>;
DEFINE FIELD channels            ON farmer TYPE array<string> DEFAULT [];
DEFINE FIELD audience_focus      ON farmer TYPE array<string> DEFAULT [];
DEFINE FIELD risk_appetite       ON farmer TYPE string DEFAULT "balanced";
-- Semantic profile of the farm (embedding of shop_name + description + categories).
DEFINE FIELD embedding           ON farmer TYPE option<array<float>>;
DEFINE FIELD created_at          ON farmer TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_farmer_org      ON farmer COLUMNS organization_id UNIQUE;
DEFINE INDEX idx_farmer_region   ON farmer COLUMNS region;
DEFINE INDEX idx_farmer_vec      ON farmer FIELDS embedding HNSW DIMENSION 768 DIST COSINE;

-- ── product ─────────────────────────────────────────────────
DEFINE TABLE product SCHEMAFULL;
DEFINE FIELD product_id          ON product TYPE int;
DEFINE FIELD farmer              ON product TYPE record<farmer>;
DEFINE FIELD name                ON product TYPE string;
DEFINE FIELD description         ON product TYPE option<string>;
DEFINE FIELD category            ON product TYPE string;
DEFINE FIELD url                 ON product TYPE option<string>;
DEFINE FIELD price               ON product TYPE option<float>;
-- Semantic embedding of name + description + category.
DEFINE FIELD embedding           ON product TYPE option<array<float>>;
DEFINE FIELD created_at          ON product TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_product_pid     ON product COLUMNS product_id UNIQUE;
DEFINE INDEX idx_product_farmer  ON product COLUMNS farmer;
DEFINE INDEX idx_product_category ON product COLUMNS category;
DEFINE INDEX idx_product_vec     ON product FIELDS embedding HNSW DIMENSION 768 DIST COSINE;

-- ── product_tag ─────────────────────────────────────────────
DEFINE TABLE product_tag SCHEMAFULL;
DEFINE FIELD product             ON product_tag TYPE record<product>;
DEFINE FIELD tag                 ON product_tag TYPE string;
DEFINE FIELD source              ON product_tag TYPE string DEFAULT "llm";
DEFINE FIELD confidence          ON product_tag TYPE float DEFAULT 0.7;
DEFINE FIELD created_at          ON product_tag TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_pt_unique       ON product_tag COLUMNS product, tag UNIQUE;
DEFINE INDEX idx_pt_tag          ON product_tag COLUMNS tag;

-- ── event (calendar event in the marketing KB) ──────────────
DEFINE TABLE event SCHEMAFULL;
DEFINE FIELD slug                ON event TYPE string;
DEFINE FIELD title               ON event TYPE string;
DEFINE FIELD type                ON event TYPE string;
DEFINE FIELD type_detail         ON event TYPE option<string>;
DEFINE FIELD start_date          ON event TYPE datetime;
DEFINE FIELD end_date            ON event TYPE datetime;
DEFINE FIELD recurrence          ON event TYPE string DEFAULT "annual";
DEFINE FIELD prep_window_days    ON event TYPE int DEFAULT 7;
DEFINE FIELD audience            ON event TYPE array<string> DEFAULT [];
DEFINE FIELD product_tags        ON event TYPE array<string> DEFAULT [];
DEFINE FIELD categories          ON event TYPE array<string> DEFAULT [];
DEFINE FIELD channels            ON event TYPE array<string> DEFAULT [];
DEFINE FIELD themes              ON event TYPE array<string> DEFAULT [];
DEFINE FIELD color               ON event TYPE option<string>;
DEFINE FIELD icon                ON event TYPE option<string>;
-- Embedding of title + themes + audience_labels — used for KNN.
DEFINE FIELD embedding           ON event TYPE option<array<float>>;
DEFINE INDEX idx_event_slug      ON event COLUMNS slug UNIQUE;
DEFINE INDEX idx_event_type      ON event COLUMNS type;
DEFINE INDEX idx_event_dates     ON event COLUMNS start_date, end_date;
DEFINE INDEX idx_event_vec       ON event FIELDS embedding HNSW DIMENSION 768 DIST COSINE;

-- ── audience  (NEW) ─────────────────────────────────────────
-- A buyer persona on the marketplace. Targeted by products,
-- preferred by certain events, embedded for semantic match.
DEFINE TABLE audience SCHEMAFULL;
DEFINE FIELD slug                ON audience TYPE string;
DEFINE FIELD label               ON audience TYPE string;
DEFINE FIELD description         ON audience TYPE option<string>;
DEFINE FIELD income_band         ON audience TYPE option<string>;
DEFINE FIELD interests           ON audience TYPE array<string> DEFAULT [];
DEFINE FIELD avg_basket_rub      ON audience TYPE option<float>;
DEFINE FIELD embedding           ON audience TYPE option<array<float>>;
DEFINE FIELD created_at          ON audience TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_audience_slug   ON audience COLUMNS slug UNIQUE;
DEFINE INDEX idx_audience_vec    ON audience FIELDS embedding HNSW DIMENSION 768 DIST COSINE;

-- ── trend  (NEW) ────────────────────────────────────────────
-- An information-signal currently influencing the market.
-- Editorial/social/marketplace-curated. Influences events.
DEFINE TABLE trend SCHEMAFULL;
DEFINE FIELD slug                ON trend TYPE string;
DEFINE FIELD title               ON trend TYPE string;
DEFINE FIELD description         ON trend TYPE option<string>;
DEFINE FIELD source              ON trend TYPE string DEFAULT "editorial";
DEFINE FIELD strength            ON trend TYPE float DEFAULT 0.5;        -- 0..1
DEFINE FIELD started_at          ON trend TYPE datetime;
DEFINE FIELD horizon_days        ON trend TYPE int DEFAULT 60;
DEFINE FIELD audience_tags       ON trend TYPE array<string> DEFAULT [];
DEFINE FIELD product_tags        ON trend TYPE array<string> DEFAULT [];
DEFINE FIELD embedding           ON trend TYPE option<array<float>>;
DEFINE FIELD created_at          ON trend TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_trend_slug      ON trend COLUMNS slug UNIQUE;
DEFINE INDEX idx_trend_strength  ON trend COLUMNS strength;
DEFINE INDEX idx_trend_vec       ON trend FIELDS embedding HNSW DIMENSION 768 DIST COSINE;

-- ── seasonal_window  (NEW) ──────────────────────────────────
-- Months when a product concept (sauerkraut, ramson, …) is at peak.
-- Bridged into events via the influences relationship.
DEFINE TABLE seasonal_window SCHEMAFULL;
DEFINE FIELD label               ON seasonal_window TYPE string;
DEFINE FIELD product_concept     ON seasonal_window TYPE string;
DEFINE FIELD months              ON seasonal_window TYPE array<int>;
DEFINE FIELD scope               ON seasonal_window TYPE array<string> DEFAULT [];
DEFINE FIELD status              ON seasonal_window TYPE string DEFAULT "peak";
DEFINE FIELD note                ON seasonal_window TYPE option<string>;
DEFINE INDEX idx_window_concept  ON seasonal_window COLUMNS product_concept;

-- ── suggestion (a campaign) ─────────────────────────────────
DEFINE TABLE suggestion SCHEMAFULL;
DEFINE FIELD farmer              ON suggestion TYPE record<farmer>;
DEFINE FIELD event               ON suggestion TYPE record<event>;
DEFINE FIELD products            ON suggestion TYPE array<record<product>>;
DEFINE FIELD channels            ON suggestion TYPE array<string>;
DEFINE FIELD date_window_start   ON suggestion TYPE datetime;
DEFINE FIELD date_window_end     ON suggestion TYPE datetime;
DEFINE FIELD promo               ON suggestion FLEXIBLE TYPE object;
DEFINE FIELD predicted_lift      ON suggestion FLEXIBLE TYPE object;
DEFINE FIELD product_reasons     ON suggestion FLEXIBLE TYPE option<object>;
DEFINE FIELD signals             ON suggestion FLEXIBLE TYPE option<object>;
DEFINE FIELD score               ON suggestion TYPE float DEFAULT 0.0;
DEFINE FIELD status              ON suggestion TYPE string DEFAULT "proposed";
DEFINE FIELD created_at          ON suggestion TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at          ON suggestion TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX idx_sug_farmer      ON suggestion COLUMNS farmer;
DEFINE INDEX idx_sug_status      ON suggestion COLUMNS status;
DEFINE INDEX idx_sug_window      ON suggestion COLUMNS date_window_start;
DEFINE INDEX idx_sug_rank        ON suggestion COLUMNS farmer, score;

-- ── generated_content ───────────────────────────────────────
DEFINE TABLE generated_content SCHEMAFULL;
DEFINE FIELD suggestion          ON generated_content TYPE record<suggestion>;
DEFINE FIELD channel             ON generated_content TYPE string;
DEFINE FIELD variant             ON generated_content TYPE int DEFAULT 0;
DEFINE FIELD body                ON generated_content FLEXIBLE TYPE object;
DEFINE FIELD model               ON generated_content TYPE string DEFAULT "gemini-2.5-flash";
DEFINE FIELD prompt_version      ON generated_content TYPE string DEFAULT "v1";
DEFINE FIELD created_at          ON generated_content TYPE datetime DEFAULT time::now();
-- Phase-2 additions: lifecycle + revision metadata.
-- All purely additive — existing rows get defaults on next read.
DEFINE FIELD status              ON generated_content TYPE string
                                   ASSERT $value IN ['draft','published','archived']
                                   DEFAULT 'draft';
DEFINE FIELD current_revision    ON generated_content TYPE int DEFAULT 1;
DEFINE FIELD is_user_edited      ON generated_content TYPE bool DEFAULT false;
DEFINE FIELD published_at        ON generated_content TYPE option<datetime>;
DEFINE FIELD archived_at         ON generated_content TYPE option<datetime>;
DEFINE FIELD updated_at          ON generated_content TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_gc_sug          ON generated_content COLUMNS suggestion;
DEFINE INDEX idx_gc_pair         ON generated_content COLUMNS suggestion, channel, variant UNIQUE;
DEFINE INDEX idx_gc_status       ON generated_content COLUMNS status;

-- ── content_revision (append-only history) ─────────────────
-- One row per write to generated_content (AI gen, user edit, restore).
-- `author = NONE` denotes an AI-generated revision; a user record means
-- it was a human edit. The current state always lives in generated_content;
-- this table is only consulted for "view history" / "restore" UX.
DEFINE TABLE content_revision SCHEMAFULL;
DEFINE FIELD content             ON content_revision TYPE record<generated_content>;
DEFINE FIELD revision_number     ON content_revision TYPE int ASSERT $value > 0;
DEFINE FIELD body                ON content_revision FLEXIBLE TYPE object;
DEFINE FIELD model               ON content_revision TYPE option<string>;
DEFINE FIELD prompt_version      ON content_revision TYPE option<string>;
DEFINE FIELD is_user_edited      ON content_revision TYPE bool DEFAULT false;
DEFINE FIELD author              ON content_revision TYPE option<record<app_user>>;
DEFINE FIELD note                ON content_revision TYPE option<string>;
DEFINE FIELD created_at          ON content_revision TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_revision_pair_unique ON content_revision FIELDS content, revision_number UNIQUE;
DEFINE INDEX idx_revision_content     ON content_revision FIELDS content;

-- ── plan_card (kanban node) ─────────────────────────────────
DEFINE TABLE plan_card SCHEMAFULL;
DEFINE FIELD farmer              ON plan_card TYPE record<farmer>;
DEFINE FIELD suggestion          ON plan_card TYPE record<suggestion>;
DEFINE FIELD column              ON plan_card TYPE string DEFAULT "proposed";
DEFINE FIELD position             ON plan_card TYPE int DEFAULT 0;
DEFINE FIELD note                ON plan_card TYPE option<string>;
DEFINE FIELD scheduled_for       ON plan_card TYPE option<datetime>;
DEFINE FIELD launched_at         ON plan_card TYPE option<datetime>;
DEFINE FIELD result_orders       ON plan_card TYPE option<int>;
DEFINE FIELD result_revenue      ON plan_card TYPE option<float>;
DEFINE FIELD created_at          ON plan_card TYPE datetime DEFAULT time::now();
-- Phase-3 additions: multi-board + rich card. All additive — existing
-- rows get defaults at next read. Spec: docs/superpowers/specs/2026-05-14-multi-board-kanban-design.md
DEFINE FIELD board_type          ON plan_card TYPE string
                                  ASSERT $value IN [
                                    'campaign','seasonal','social','launch','event',
                                    'recipe','storytelling','push','community'
                                  ]
                                  DEFAULT 'campaign';
DEFINE FIELD title               ON plan_card TYPE option<string>;
DEFINE FIELD description         ON plan_card TYPE option<string>;
DEFINE FIELD priority            ON plan_card TYPE string
                                  ASSERT $value IN ['low','normal','high','urgent']
                                  DEFAULT 'normal';
DEFINE FIELD due_date            ON plan_card TYPE option<datetime>;
DEFINE FIELD audience_tags       ON plan_card TYPE array<string> DEFAULT [];
DEFINE FIELD channels            ON plan_card TYPE array<string> DEFAULT [];
DEFINE FIELD hashtags            ON plan_card TYPE array<string> DEFAULT [];
DEFINE FIELD cta                 ON plan_card TYPE option<string>;
DEFINE FIELD attachments         ON plan_card FLEXIBLE TYPE array DEFAULT [];
DEFINE FIELD product_refs        ON plan_card TYPE array<record<product>> DEFAULT [];
DEFINE FIELD assignee            ON plan_card TYPE option<record<app_user>>;
DEFINE FIELD created_by          ON plan_card TYPE option<record<app_user>>;
DEFINE FIELD updated_at          ON plan_card TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_pc_farmer       ON plan_card COLUMNS farmer, column;
DEFINE INDEX idx_pc_board        ON plan_card COLUMNS farmer, board_type;
DEFINE INDEX idx_pc_due          ON plan_card COLUMNS due_date;
DEFINE INDEX idx_pc_assignee     ON plan_card COLUMNS assignee;

-- ── plan_card_comment (collaboration) ────────────────────────
-- Append-only user prose attached to a card. Display newest-first.
-- author=NONE never happens (POST requires auth) but the field is
-- nullable for the same reason as content_revision — a deleted user
-- shouldn't orphan their comments.
DEFINE TABLE plan_card_comment SCHEMAFULL;
DEFINE FIELD card        ON plan_card_comment TYPE record<plan_card>;
DEFINE FIELD author      ON plan_card_comment TYPE option<record<app_user>>;
DEFINE FIELD body        ON plan_card_comment TYPE string ASSERT string::len($value) > 0;
DEFINE FIELD created_at  ON plan_card_comment TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_comment_card ON plan_card_comment COLUMNS card, created_at;

-- ── plan_card_activity (audit timeline) ──────────────────────
-- System-emitted events: created/moved/edited/commented/archived/
-- linked_content_published. Repo methods write these atomically with
-- the action that triggered them — handlers never call AppendActivity
-- directly. payload is FLEXIBLE so each kind can carry its own shape
-- (`moved` → {from,to}, `edited` → {fields:[...]}, etc.).
DEFINE TABLE plan_card_activity SCHEMAFULL;
DEFINE FIELD card        ON plan_card_activity TYPE record<plan_card>;
DEFINE FIELD author      ON plan_card_activity TYPE option<record<app_user>>;
DEFINE FIELD kind        ON plan_card_activity TYPE string;
DEFINE FIELD payload     ON plan_card_activity FLEXIBLE TYPE option<object>;
DEFINE FIELD created_at  ON plan_card_activity TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_activity_card ON plan_card_activity COLUMNS card, created_at;

-- ── ai_memory  (NEW) ────────────────────────────────────────
-- Every farmer interaction with the recommender is stored here.
-- The recommender reads back to bias future scoring toward what
-- the farmer historically accepts / launches. This is the
-- contextual intelligence layer.
DEFINE TABLE ai_memory SCHEMAFULL;
DEFINE FIELD farmer              ON ai_memory TYPE record<farmer>;
DEFINE FIELD kind                ON ai_memory TYPE string;
  -- campaign_accepted | campaign_rejected | campaign_planned |
  -- campaign_launched | campaign_completed |
  -- content_regenerated | promo_overridden | chat_query
DEFINE FIELD subject             ON ai_memory TYPE option<record>;
DEFINE FIELD signal              ON ai_memory TYPE float DEFAULT 0.0;     -- -1..+1
DEFINE FIELD context             ON ai_memory FLEXIBLE TYPE option<object>;
DEFINE FIELD created_at          ON ai_memory TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_memory_farmer   ON ai_memory COLUMNS farmer, created_at;
DEFINE INDEX idx_memory_kind     ON ai_memory COLUMNS kind;

-- ── embedding_cache (concept → vector) ──────────────────────
-- Used by the offline embed pipeline to avoid re-embedding the
-- same canonical phrase. NOT a vector index — pure key/value.
DEFINE TABLE embedding_cache SCHEMAFULL;
DEFINE FIELD key                 ON embedding_cache TYPE string;
DEFINE FIELD vector              ON embedding_cache TYPE array<float>;
DEFINE FIELD created_at          ON embedding_cache TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_emb_key         ON embedding_cache COLUMNS key UNIQUE;

-- =============================================================
--   RELATION (edge) tables — typed graph relationships
--   Each carries metadata; can be SELECTed, scored, traversed.
-- =============================================================

-- farmer -[owns]-> product
-- Equivalent to product.farmer record link, but emitted as an
-- edge so graph traversal queries are natural:
--   SELECT ->owns->product.* FROM farmer:abc;
DEFINE TABLE owns         TYPE RELATION FROM farmer TO product SCHEMAFULL;
DEFINE FIELD since        ON owns TYPE datetime DEFAULT time::now();

-- product -[fits]-> event   (recommender output, persisted)
-- score & reasons are stored on the edge — judges can inspect
-- the literal computed scoring trail with one SQL query.
DEFINE TABLE fits         TYPE RELATION FROM product TO event SCHEMAFULL;
DEFINE FIELD score        ON fits TYPE float DEFAULT 0.0;
DEFINE FIELD reasons      ON fits TYPE array<string> DEFAULT [];
DEFINE FIELD computed_at  ON fits TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_fits_score  ON fits COLUMNS score;

-- product -[targets]-> audience
DEFINE TABLE targets      TYPE RELATION FROM product TO audience SCHEMAFULL;
DEFINE FIELD strength     ON targets TYPE float DEFAULT 0.5;
DEFINE FIELD source       ON targets TYPE string DEFAULT "tag";

-- audience -[prefers]-> product
-- Computed inversely from targets, but also can be hand-curated.
DEFINE TABLE prefers      TYPE RELATION FROM audience TO product SCHEMAFULL;
DEFINE FIELD weight       ON prefers TYPE float DEFAULT 0.5;

-- event -[triggers]-> suggestion  (campaign)
DEFINE TABLE triggers     TYPE RELATION FROM event TO suggestion SCHEMAFULL;

-- suggestion -[generated]-> generated_content
DEFINE TABLE generated    TYPE RELATION FROM suggestion TO generated_content SCHEMAFULL;
DEFINE FIELD channel      ON generated TYPE string;

-- trend -[influences]-> event
DEFINE TABLE influences   TYPE RELATION FROM trend TO event SCHEMAFULL;
DEFINE FIELD strength     ON influences TYPE float DEFAULT 0.5;

-- suggestion -[derived_from]-> trend
DEFINE TABLE derived_from TYPE RELATION FROM suggestion TO trend SCHEMAFULL;

-- farmer -[launched]-> suggestion
DEFINE TABLE launched     TYPE RELATION FROM farmer TO suggestion SCHEMAFULL;
DEFINE FIELD launched_at  ON launched TYPE datetime DEFAULT time::now();

-- ai_memory -[references]-> suggestion
-- The memory layer points back at the campaigns that produced it.
-- Used by the recommender to find "similar successful campaigns".
DEFINE TABLE references   TYPE RELATION FROM ai_memory TO suggestion SCHEMAFULL;

-- seasonal_window -[covers]-> event
-- E.g. "ramson peak" covers the "spring greens" season event.
DEFINE TABLE covers       TYPE RELATION FROM seasonal_window TO event SCHEMAFULL;

-- =============================================================
--   AUTHENTICATION — app_user + session
--   Added 2026-05-14 (spec: docs/superpowers/specs/2026-05-14-auth-system-design.md).
--   Tokens are 32 random bytes → 64-char hex, hashed with SHA-256
--   before storage. The DB only ever sees `token_hash`, never the raw
--   token; a DB dump leaks zero replayable credentials.
-- =============================================================

DEFINE TABLE app_user SCHEMAFULL;
DEFINE FIELD username      ON app_user TYPE string ASSERT $value != NONE
                                       VALUE string::lowercase(string::trim($value));
DEFINE FIELD password_hash ON app_user TYPE string ASSERT $value != NONE;
DEFINE FIELD role          ON app_user TYPE string
                                       ASSERT $value IN ['admin','user']
                                       DEFAULT 'user';
DEFINE FIELD display_name  ON app_user TYPE option<string>;
DEFINE FIELD disabled      ON app_user TYPE bool DEFAULT false;
DEFINE FIELD created_at    ON app_user TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at    ON app_user TYPE datetime DEFAULT time::now();
DEFINE FIELD created_by    ON app_user TYPE option<record<app_user>>;

DEFINE INDEX app_user_username_unique ON app_user FIELDS username UNIQUE;

DEFINE TABLE session SCHEMAFULL;
DEFINE FIELD user         ON session TYPE record<app_user> ASSERT $value != NONE;
DEFINE FIELD token_hash   ON session TYPE string ASSERT $value != NONE;
DEFINE FIELD created_at   ON session TYPE datetime DEFAULT time::now();
DEFINE FIELD expires_at   ON session TYPE datetime ASSERT $value != NONE;
DEFINE FIELD last_used_at ON session TYPE datetime DEFAULT time::now();
DEFINE FIELD ip           ON session TYPE option<string>;
DEFINE FIELD user_agent   ON session TYPE option<string>;
DEFINE FIELD revoked      ON session TYPE bool DEFAULT false;

DEFINE INDEX session_token_unique ON session FIELDS token_hash UNIQUE;
DEFINE INDEX session_user         ON session FIELDS user;
DEFINE INDEX session_expires      ON session FIELDS expires_at;

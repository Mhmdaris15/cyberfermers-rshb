-- =============================================================
--   Свое Родное · schema.surql
--   SurrealDB 2.x — strict tables, deterministic ids
-- =============================================================

DEFINE NAMESPACE rshb;
USE NS rshb;
DEFINE DATABASE svoe_rodnoe;
USE DB svoe_rodnoe;

-- ---------- FARMER ------------------------------------------------
DEFINE TABLE farmer SCHEMAFULL;
DEFINE FIELD organization_id     ON farmer TYPE int;
DEFINE FIELD shop_name           ON farmer TYPE string;
DEFINE FIELD description         ON farmer TYPE option<string>;
DEFINE FIELD region              ON farmer TYPE string;
DEFINE FIELD url                 ON farmer TYPE option<string>;
DEFINE FIELD channels            ON farmer TYPE array<string> DEFAULT [];
DEFINE FIELD audience_focus      ON farmer TYPE array<string> DEFAULT [];
DEFINE FIELD risk_appetite       ON farmer TYPE string DEFAULT "balanced";
DEFINE FIELD created_at          ON farmer TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_farmer_org      ON farmer COLUMNS organization_id UNIQUE;
DEFINE INDEX idx_farmer_region   ON farmer COLUMNS region;

-- ---------- PRODUCT -----------------------------------------------
DEFINE TABLE product SCHEMAFULL;
DEFINE FIELD product_id          ON product TYPE int;
DEFINE FIELD farmer              ON product TYPE record<farmer>;
DEFINE FIELD name                ON product TYPE string;
DEFINE FIELD description         ON product TYPE option<string>;
DEFINE FIELD category            ON product TYPE string;
DEFINE FIELD url                 ON product TYPE option<string>;
DEFINE FIELD price               ON product TYPE option<float>;
DEFINE FIELD created_at          ON product TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_product_pid     ON product COLUMNS product_id UNIQUE;
DEFINE INDEX idx_product_farmer  ON product COLUMNS farmer;
DEFINE INDEX idx_product_category ON product COLUMNS category;

-- ---------- PRODUCT TAG (graph edge product→tag) ------------------
DEFINE TABLE product_tag SCHEMAFULL;
DEFINE FIELD product             ON product_tag TYPE record<product>;
DEFINE FIELD tag                 ON product_tag TYPE string;
DEFINE FIELD source              ON product_tag TYPE string DEFAULT "llm";   -- llm | rule | manual
DEFINE FIELD confidence          ON product_tag TYPE float DEFAULT 0.7;
DEFINE FIELD created_at          ON product_tag TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_pt_unique       ON product_tag COLUMNS product, tag UNIQUE;
DEFINE INDEX idx_pt_tag          ON product_tag COLUMNS tag;

-- ---------- EVENT KB ----------------------------------------------
DEFINE TABLE event SCHEMAFULL;
DEFINE FIELD slug                ON event TYPE string;
DEFINE FIELD title               ON event TYPE string;
DEFINE FIELD type                ON event TYPE string;       -- holiday | season | themed_week | trend | professional
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
DEFINE INDEX idx_event_slug      ON event COLUMNS slug UNIQUE;
DEFINE INDEX idx_event_type      ON event COLUMNS type;
DEFINE INDEX idx_event_dates     ON event COLUMNS start_date, end_date;

-- ---------- SUGGESTION (an event×farmer match) -------------------
DEFINE TABLE suggestion SCHEMAFULL;
DEFINE FIELD farmer              ON suggestion TYPE record<farmer>;
DEFINE FIELD event               ON suggestion TYPE record<event>;
DEFINE FIELD products            ON suggestion TYPE array<record<product>>;
DEFINE FIELD channels            ON suggestion TYPE array<string>;
DEFINE FIELD date_window_start   ON suggestion TYPE datetime;
DEFINE FIELD date_window_end     ON suggestion TYPE datetime;
DEFINE FIELD promo               ON suggestion FLEXIBLE TYPE object;        -- { discount_pct, promo_code }
DEFINE FIELD predicted_lift      ON suggestion FLEXIBLE TYPE object;        -- { orders_delta, revenue_delta, assumptions[] }
DEFINE FIELD score               ON suggestion TYPE float DEFAULT 0.0;
DEFINE FIELD status              ON suggestion TYPE string DEFAULT "proposed"; -- proposed | planned | live | completed
DEFINE FIELD created_at          ON suggestion TYPE datetime DEFAULT time::now();
DEFINE FIELD updated_at          ON suggestion TYPE datetime DEFAULT time::now() VALUE time::now();
DEFINE INDEX idx_sug_farmer      ON suggestion COLUMNS farmer;
DEFINE INDEX idx_sug_status      ON suggestion COLUMNS status;
DEFINE INDEX idx_sug_window      ON suggestion COLUMNS date_window_start;

-- ---------- GENERATED CONTENT (per channel) -----------------------
DEFINE TABLE generated_content SCHEMAFULL;
DEFINE FIELD suggestion          ON generated_content TYPE record<suggestion>;
DEFINE FIELD channel             ON generated_content TYPE string;          -- push | story | blog | recipe | chat | social | email | bundle
DEFINE FIELD variant             ON generated_content TYPE int DEFAULT 0;   -- for A/B
DEFINE FIELD body                ON generated_content FLEXIBLE TYPE object;
DEFINE FIELD model               ON generated_content TYPE string DEFAULT "gemini-2.0-flash";
DEFINE FIELD prompt_version      ON generated_content TYPE string DEFAULT "v1";
DEFINE FIELD created_at          ON generated_content TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_gc_sug          ON generated_content COLUMNS suggestion;
DEFINE INDEX idx_gc_pair         ON generated_content COLUMNS suggestion, channel, variant UNIQUE;

-- ---------- PLAN BOARD (a card on the kanban) ---------------------
DEFINE TABLE plan_card SCHEMAFULL;
DEFINE FIELD farmer              ON plan_card TYPE record<farmer>;
DEFINE FIELD suggestion          ON plan_card TYPE record<suggestion>;
DEFINE FIELD column              ON plan_card TYPE string DEFAULT "proposed"; -- proposed | planned | live | completed
DEFINE FIELD position             ON plan_card TYPE int DEFAULT 0;
DEFINE FIELD note                ON plan_card TYPE option<string>;
DEFINE FIELD scheduled_for       ON plan_card TYPE option<datetime>;
DEFINE FIELD launched_at         ON plan_card TYPE option<datetime>;
DEFINE FIELD result_orders       ON plan_card TYPE option<int>;
DEFINE FIELD result_revenue      ON plan_card TYPE option<float>;
DEFINE FIELD created_at          ON plan_card TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_pc_farmer       ON plan_card COLUMNS farmer, column;

-- ---------- EMBEDDING CACHE (concept→vector) ----------------------
DEFINE TABLE embedding_cache SCHEMAFULL;
DEFINE FIELD key                 ON embedding_cache TYPE string;
DEFINE FIELD vector              ON embedding_cache TYPE array<float>;
DEFINE FIELD created_at          ON embedding_cache TYPE datetime DEFAULT time::now();
DEFINE INDEX idx_emb_key         ON embedding_cache COLUMNS key UNIQUE;

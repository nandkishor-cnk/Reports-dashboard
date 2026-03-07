-- ============================================================
-- COX & KINGS — EOS SCORECARD SYSTEM
-- Supabase Schema v1.1  |  Phase 1: Sales + Marketing
-- Updated: team-based aggregation, WON = 'First Payment Done'
-- ============================================================
-- Run this in Supabase SQL Editor in order.
-- All timestamps stored in UTC; TeleCRM source is IST (UTC+5:30).
-- ============================================================


-- ────────────────────────────────────────────────────────────
-- 0. EXTENSIONS
-- ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";      -- for scheduled jobs
CREATE EXTENSION IF NOT EXISTS "pg_net";       -- for webhook calls


-- ────────────────────────────────────────────────────────────
-- 1. QUARTERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS quarters (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO quarters (name, start_date, end_date, is_active) VALUES
  ('Q1 FY2026', '2026-01-01', '2026-03-31', true),
  ('Q2 FY2026', '2026-04-01', '2026-06-30', false),
  ('Q3 FY2026', '2026-07-01', '2026-09-30', false),
  ('Q4 FY2026', '2026-10-01', '2026-12-31', false)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION get_week_number(p_date DATE, p_quarter_id UUID)
RETURNS INT AS $$
DECLARE
  v_start DATE;
  v_week  INT;
BEGIN
  SELECT start_date INTO v_start FROM quarters WHERE id = p_quarter_id;
  IF v_start IS NULL THEN RETURN NULL; END IF;
  v_week := FLOOR((p_date - v_start) / 7) + 1;
  IF v_week < 1 OR v_week > 13 THEN RETURN NULL; END IF;
  RETURN v_week;
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION active_quarter_id() RETURNS UUID AS $$
  SELECT id FROM quarters WHERE is_active = true LIMIT 1;
$$ LANGUAGE sql STABLE;


-- ────────────────────────────────────────────────────────────
-- 2. SALES TEAMS
-- Maps each caller/agent to their manager.
-- Used in all manager-level metric views.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sales_teams (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager         TEXT NOT NULL,        -- 'edwin' | 'adarsh' | 'ashok'
  manager_email   TEXT NOT NULL,
  member_email    TEXT NOT NULL,
  member_name     TEXT,
  CONSTRAINT sales_teams_member_unique UNIQUE (member_email)
);

CREATE INDEX IF NOT EXISTS idx_sales_teams_manager ON sales_teams(manager);
CREATE INDEX IF NOT EXISTS idx_sales_teams_member  ON sales_teams(member_email);

INSERT INTO sales_teams (manager, manager_email, member_email, member_name) VALUES
  -- ── Edwin & his team ──────────────────────────────────────
  ('edwin', 'edwin.rajappan@coxandkings.com',    'edwin.rajappan@coxandkings.com',    'Edwin Ravi Rajappan'),
  ('edwin', 'edwin.rajappan@coxandkings.com',    'ashish.nigam@coxandkings.com',      'Ashish Nigam'),
  ('edwin', 'edwin.rajappan@coxandkings.com',    'astik.dubey@coxandkings.com',       'Astik Dubey'),
  ('edwin', 'edwin.rajappan@coxandkings.com',    'hemant.singh@coxandkings.com',      'Hemant Singh'),
  ('edwin', 'edwin.rajappan@coxandkings.com',    'hushendra.kajania@coxandkings.com', 'Hushendra Kajania'),
  ('edwin', 'edwin.rajappan@coxandkings.com',    'kavita.kumari@coxandkings.com',     'Kavita Kumari'),
  ('edwin', 'edwin.rajappan@coxandkings.com',    'mohd.hamza@coxandkings.com',        'Mohd Hamza'),
  ('edwin', 'edwin.rajappan@coxandkings.com',    'rahul.menaria@coxandkings.com',     'Rahul Menaria'),
  ('edwin', 'edwin.rajappan@coxandkings.com',    'rahul.rai@coxandkings.com',         'Rahul Rai'),
  ('edwin', 'edwin.rajappan@coxandkings.com',    'riya.tyagi@coxandkings.com',        'Riya Tyagi'),
  ('edwin', 'edwin.rajappan@coxandkings.com',    'sumit.kumar@coxandkings.com',       'Sumit Kumar'),
  ('edwin', 'edwin.rajappan@coxandkings.com',    'syed.shah@coxandkings.com',         'Syed Wali Ahmad Shah'),
  ('edwin', 'edwin.rajappan@coxandkings.com',    'tejal.choudhary@coxandkings.com',   'Tejal Choudhary'),
  ('edwin', 'edwin.rajappan@coxandkings.com',    'vaishali.singh@coxandkings.com',    'Vaishali Singh'),

  -- ── Adarsh & his team ─────────────────────────────────────
  ('adarsh', 'adarsh.raheja@coxandkings.com',   'adarsh.raheja@coxandkings.com',     'Adarsh Raheja'),
  ('adarsh', 'adarsh.raheja@coxandkings.com',   'amit.barik@coxandkings.com',        'Amit Barik'),
  ('adarsh', 'adarsh.raheja@coxandkings.com',   'santosh.rai@coxandkings.com',       'Santosh Kumar Rai'),
  ('adarsh', 'adarsh.raheja@coxandkings.com',   'soni.singh@coxandkings.com',        'Soni Singh'),
  ('adarsh', 'adarsh.raheja@coxandkings.com',   'pratik.gupta@coxandkings.com',      'Pratik Gupta'),
  ('adarsh', 'adarsh.raheja@coxandkings.com',   'anand.narayan@coxandkings.com',     'Anand Narayan'),
  ('adarsh', 'adarsh.raheja@coxandkings.com',   'ashamp.kumar@coxandkings.com',      'Ashamp Kumar'),
  ('adarsh', 'adarsh.raheja@coxandkings.com',   'damanpreet.kaur@coxandkings.com',   'Damanpreet Kaur'),
  ('adarsh', 'adarsh.raheja@coxandkings.com',   'dheeraj.sharma@coxandkings.com',    'Dheeraj Sharma'),
  ('adarsh', 'adarsh.raheja@coxandkings.com',   'faizan.khan@coxandkings.com',       'Faizan Khan'),
  ('adarsh', 'adarsh.raheja@coxandkings.com',   'puneet.upadhyay@coxandkings.com',   'Puneet Upadhyay'),
  ('adarsh', 'adarsh.raheja@coxandkings.com',   'zaid.jahangir@coxandkings.com',     'Zaid Bin Jahangir'),

  -- ── Ashok & his team ──────────────────────────────────────
  ('ashok', 'ashok.pednekar@coxandkings.com',   'ashok.pednekar@coxandkings.com',    'Ashok Padnekar'),
  ('ashok', 'ashok.pednekar@coxandkings.com',   'aditya.singh@coxandkings.com',      'Aditya Singh FRN'),
  ('ashok', 'ashok.pednekar@coxandkings.com',   'amruta.thakur@coxandkings.com',     'Amruta Thakur FRN'),
  ('ashok', 'ashok.pednekar@coxandkings.com',   'bharat.dubey@coxandkings.com',      'Bharat Dubey FRN'),
  ('ashok', 'ashok.pednekar@coxandkings.com',   'bharat.mali@coxandkings.com',       'Bharat Mali FRN'),
  ('ashok', 'ashok.pednekar@coxandkings.com',   'chandani.yede@coxandkings.com',     'Chandani Yede FRN'),
  ('ashok', 'ashok.pednekar@coxandkings.com',   'harshil.desai@coxandkings.com',     'Harshil Desai FRN'),
  ('ashok', 'ashok.pednekar@coxandkings.com',   'juned.khan@coxandkings.com',        'Juned Khan FRN'),
  ('ashok', 'ashok.pednekar@coxandkings.com',   'princy.kunjumon@coxandkings.com',   'Princy FRN'),
  ('ashok', 'ashok.pednekar@coxandkings.com',   'rakesh.dornala@coxandkings.com',    'Rakesh Dornala FRN'),
  ('ashok', 'ashok.pednekar@coxandkings.com',   'rohit.kumar@coxandkings.com',       'Rohit Kumar FRN'),
  ('ashok', 'ashok.pednekar@coxandkings.com',   'shakil.khan@coxandkings.com',       'Shakil Khan FRN'),
  ('ashok', 'ashok.pednekar@coxandkings.com',   'shaktisinh.jadeja@coxandkings.com', 'Shaktisinh Jadeja FRN'),
  ('ashok', 'ashok.pednekar@coxandkings.com',   'yogita.saxena@coxandkings.com',     'Yogita FRN'),
  ('ashok', 'ashok.pednekar@coxandkings.com',   'aditya.sathe@coxandkings.com',      'Aditya Sathe FRN')
ON CONFLICT (member_email) DO UPDATE
  SET manager = EXCLUDED.manager,
      manager_email = EXCLUDED.manager_email,
      member_name = EXCLUDED.member_name;


-- ────────────────────────────────────────────────────────────
-- 3. TARGETS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS targets (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quarter_id       UUID NOT NULL REFERENCES quarters(id) ON DELETE CASCADE,
  section_id       TEXT NOT NULL,   -- 'deeksha','edwin','adarsh','ashok','loyana','l1'
  metric_key       TEXT NOT NULL,
  target_value     NUMERIC,
  higher_is_better BOOLEAN,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_by       TEXT,
  CONSTRAINT targets_unique UNIQUE (quarter_id, section_id, metric_key)
);

CREATE INDEX IF NOT EXISTS idx_targets_quarter ON targets(quarter_id);
CREATE INDEX IF NOT EXISTS idx_targets_section ON targets(quarter_id, section_id);


-- ────────────────────────────────────────────────────────────
-- 4. RAW LEADS  (ETL pull from TeleCRM RDS → this table)
-- One row per lead. Upserted on each sync.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS raw_leads (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telecrm_id                      TEXT UNIQUE NOT NULL,

  -- Timestamps (stored in UTC; TeleCRM source assumed IST)
  created_on                      TIMESTAMPTZ,
  updated_on                      TIMESTAMPTZ,
  is_deleted                      BOOLEAN DEFAULT false,

  -- Assignment
  assignee                        TEXT,          -- Human name e.g. "Hemant Singh"
  assignee_email                  TEXT,          -- e.g. "hemant.singh@coxandkings.com"

  -- Lead Info
  name                            TEXT,
  phone                           TEXT,
  alternate_phone                 TEXT,
  email                           TEXT,
  lead_source                     TEXT,
  list_names                      TEXT[],

  -- Status & Stage
  status                          TEXT,
  rating                          NUMERIC,
  lost_reason                     TEXT,

  -- Travel Details
  travel_destination              TEXT,
  travel_destination_name         TEXT,
  travel_date                     TIMESTAMPTZ,
  number_of_travelers_adults      INT,
  number_of_travelers_child_beds  INT,
  number_of_travelers_child_nobed INT,
  number_of_travelers_infants     INT,
  approximate_budget              NUMERIC,
  package_name                    TEXT,
  who_travelling_with             TEXT,
  when_to_travel                  TEXT,
  when_to_book                    TEXT,
  buyer_type                      TEXT,
  flights_booked                  TEXT,
  visa_status                     TEXT,

  -- UTM / Attribution
  utm_source                      TEXT,
  utm_medium                      TEXT,
  utm_campaign                    TEXT,
  utm_term                        TEXT,
  utm_content                     TEXT,
  gclid                           TEXT,
  fbclid                          TEXT,
  facebook_ad                     TEXT,
  facebook_ad_name                TEXT,
  facebook_campaign               TEXT,
  facebook_lead_id                TEXT,
  facebook_ad_set_id              TEXT,
  facebook_ad_set_name            TEXT,

  -- Financial
  expected_margin                 NUMERIC,
  margin                          NUMERIC,
  advanced_received               NUMERIC,
  expected_closure_date           TIMESTAMPTZ,

  -- First Contact
  first_call_date                 TIMESTAMPTZ,
  first_call_duration_seconds     INT,   -- NULL means no call; -1 in source treated as NULL

  -- Follow-up
  next_follow_up_date             TIMESTAMPTZ,
  recapture_date                  TIMESTAMPTZ,
  recapture_count                 INT DEFAULT 0,

  -- Skill / Routing
  skill_map_group                 TEXT,
  lead_distribution_type          TEXT,

  -- Computed on insert (via trigger)
  week_number                     INT,
  quarter_id                      UUID REFERENCES quarters(id),

  raw_payload                     JSONB,
  ingested_at                     TIMESTAMPTZ DEFAULT NOW(),
  updated_in_db_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raw_leads_telecrm_id   ON raw_leads(telecrm_id);
CREATE INDEX IF NOT EXISTS idx_raw_leads_assignee     ON raw_leads(assignee_email, quarter_id, week_number);
CREATE INDEX IF NOT EXISTS idx_raw_leads_status       ON raw_leads(status);
CREATE INDEX IF NOT EXISTS idx_raw_leads_created      ON raw_leads(created_on);
CREATE INDEX IF NOT EXISTS idx_raw_leads_quarter_week ON raw_leads(quarter_id, week_number);

CREATE OR REPLACE FUNCTION set_lead_quarter_week() RETURNS TRIGGER AS $$
DECLARE
  v_quarter_id UUID;
  v_week       INT;
BEGIN
  SELECT id INTO v_quarter_id
  FROM quarters
  WHERE NEW.created_on::DATE BETWEEN start_date AND end_date
  LIMIT 1;

  IF v_quarter_id IS NOT NULL THEN
    v_week := get_week_number(NEW.created_on::DATE, v_quarter_id);
    NEW.quarter_id := v_quarter_id;
    NEW.week_number := v_week;
  END IF;

  NEW.updated_in_db_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lead_quarter_week ON raw_leads;
CREATE TRIGGER trg_lead_quarter_week
  BEFORE INSERT OR UPDATE ON raw_leads
  FOR EACH ROW EXECUTE FUNCTION set_lead_quarter_week();


-- ────────────────────────────────────────────────────────────
-- 5. RAW CALL LOGS  (ETL from TeleCRM action_callerdesk)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS raw_call_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telecrm_call_id       TEXT UNIQUE NOT NULL,
  lead_telecrm_id       TEXT REFERENCES raw_leads(telecrm_id) ON DELETE SET NULL,

  agent_email           TEXT,
  agent_name            TEXT,

  call_direction        TEXT,     -- 'inbound' | 'outbound'
  -- TeleCRM status 'ANSWER' → 'connected', 'CANCEL*' → 'not_connected', etc.
  call_status           TEXT,
  duration_seconds      INT DEFAULT 0,
  call_started_at       TIMESTAMPTZ,
  call_ended_at         TIMESTAMPTZ,

  -- Connected = ANSWER + duration >= 60 seconds
  is_meaningful_connect BOOLEAN GENERATED ALWAYS AS (
    call_status = 'connected' AND duration_seconds >= 60
  ) STORED,

  week_number           INT,
  quarter_id            UUID REFERENCES quarters(id),

  raw_payload           JSONB,
  ingested_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calls_lead    ON raw_call_logs(lead_telecrm_id);
CREATE INDEX IF NOT EXISTS idx_calls_agent   ON raw_call_logs(agent_email, quarter_id, week_number);
CREATE INDEX IF NOT EXISTS idx_calls_started ON raw_call_logs(call_started_at);
CREATE INDEX IF NOT EXISTS idx_calls_quarter ON raw_call_logs(quarter_id, week_number);

CREATE OR REPLACE FUNCTION set_call_quarter_week() RETURNS TRIGGER AS $$
DECLARE v_qid UUID; v_wk INT;
BEGIN
  SELECT id INTO v_qid FROM quarters
  WHERE NEW.call_started_at::DATE BETWEEN start_date AND end_date LIMIT 1;
  IF v_qid IS NOT NULL THEN
    NEW.quarter_id := v_qid;
    NEW.week_number := get_week_number(NEW.call_started_at::DATE, v_qid);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_call_quarter_week ON raw_call_logs;
CREATE TRIGGER trg_call_quarter_week
  BEFORE INSERT OR UPDATE ON raw_call_logs
  FOR EACH ROW EXECUTE FUNCTION set_call_quarter_week();


-- ────────────────────────────────────────────────────────────
-- 6. RAW TASKS  (ETL from TeleCRM call_followup)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS raw_tasks (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telecrm_task_id      TEXT UNIQUE NOT NULL,
  lead_telecrm_id      TEXT REFERENCES raw_leads(telecrm_id) ON DELETE SET NULL,

  assignee_email       TEXT,
  assignee_name        TEXT,

  task_type            TEXT,       -- 'call' (only type in TeleCRM currently)
  task_title           TEXT,
  due_at               TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  -- TeleCRM: 'Done'=completed on time, 'Late'=completed after deadline
  status               TEXT,       -- 'pending' | 'completed' | 'cancelled'

  -- Done = on time (updated_on <= deadline in TeleCRM)
  -- Late = completed but after deadline (updated_on > deadline)
  is_completed_on_time BOOLEAN GENERATED ALWAYS AS (
    completed_at IS NOT NULL AND completed_at <= due_at
  ) STORED,

  week_number          INT,
  quarter_id           UUID REFERENCES quarters(id),

  raw_payload          JSONB,
  ingested_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON raw_tasks(assignee_email, quarter_id, week_number);
CREATE INDEX IF NOT EXISTS idx_tasks_lead     ON raw_tasks(lead_telecrm_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due      ON raw_tasks(due_at);

CREATE OR REPLACE FUNCTION set_task_quarter_week() RETURNS TRIGGER AS $$
DECLARE v_qid UUID;
BEGIN
  SELECT id INTO v_qid FROM quarters
  WHERE COALESCE(NEW.due_at, NEW.ingested_at)::DATE BETWEEN start_date AND end_date LIMIT 1;
  IF v_qid IS NOT NULL THEN
    NEW.quarter_id := v_qid;
    NEW.week_number := get_week_number(COALESCE(NEW.due_at, NEW.ingested_at)::DATE, v_qid);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_quarter_week ON raw_tasks;
CREATE TRIGGER trg_task_quarter_week
  BEFORE INSERT OR UPDATE ON raw_tasks
  FOR EACH ROW EXECUTE FUNCTION set_task_quarter_week();


-- ────────────────────────────────────────────────────────────
-- 7. RAW WHATSAPP  (ETL from TeleCRM action_whatsapp_msg)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS raw_whatsapp (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telecrm_msg_id   TEXT UNIQUE NOT NULL,
  lead_telecrm_id  TEXT REFERENCES raw_leads(telecrm_id) ON DELETE SET NULL,
  agent_email      TEXT,
  -- TeleCRM type: OUTGOING_WHATSAPP_MSG → 'outbound', INCOMING_WHATSAPP_MSG → 'inbound'
  direction        TEXT,
  message_type     TEXT,      -- 'text' | 'template' | 'media'
  sent_at          TIMESTAMPTZ,
  delivered        BOOLEAN DEFAULT false,
  read_by_lead     BOOLEAN DEFAULT false,
  week_number      INT,
  quarter_id       UUID REFERENCES quarters(id),
  raw_payload      JSONB,
  ingested_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_lead  ON raw_whatsapp(lead_telecrm_id);
CREATE INDEX IF NOT EXISTS idx_wa_agent ON raw_whatsapp(agent_email, quarter_id, week_number);


-- ────────────────────────────────────────────────────────────
-- 8. AD SPEND — Supermetrics already writes to these tables:
--    public.facebook_ads  (837+ rows, 2026-01-15 onward)
--    public.google_ads    (162+ rows, 2026-01-15 onward)
--
-- Columns in both: account_name, campaign, clicks, datasource, date, source, spend
-- NOTE: 'spend' is in INR. Confirm with team whether GST is already included.
--   If NOT included: spend_with_gst = spend * 1.18
--   If ALREADY included: spend_with_gst = spend
--
-- We create a unified view over both tables for use in marketing metrics.
-- ────────────────────────────────────────────────────────────

-- Unified ad spend view (no raw_ad_spend table needed — Supermetrics owns the writes)
CREATE OR REPLACE VIEW v_ad_spend_weekly AS
WITH all_spend AS (
  SELECT date::DATE AS spend_date, spend, 'facebook' AS platform
  FROM facebook_ads
  UNION ALL
  SELECT date::DATE AS spend_date, spend, 'google' AS platform
  FROM google_ads
),
with_quarter AS (
  SELECT
    s.spend_date,
    s.platform,
    s.spend                          AS spend_inr,
    -- TODO: confirm if GST already included. If not, use: s.spend * 1.18
    s.spend * 1.18                   AS spend_with_gst,
    q.id                             AS quarter_id,
    get_week_number(s.spend_date, q.id) AS week_number
  FROM all_spend s
  JOIN quarters q ON s.spend_date BETWEEN q.start_date AND q.end_date
)
SELECT
  quarter_id,
  week_number,
  platform,
  SUM(spend_inr)     AS total_spend_inr,
  SUM(spend_with_gst) AS total_spend_with_gst
FROM with_quarter
WHERE week_number IS NOT NULL
GROUP BY quarter_id, week_number, platform;


-- ────────────────────────────────────────────────────────────
-- 9. MANUAL METRICS
-- Brand (Loyana), Finance, HR, Ops, Tech — manual entry.
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS manual_metrics (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quarter_id    UUID NOT NULL REFERENCES quarters(id) ON DELETE CASCADE,
  week_number   INT NOT NULL CHECK (week_number BETWEEN 1 AND 13),
  section_id    TEXT NOT NULL,
  metric_key    TEXT NOT NULL,
  value_num     NUMERIC,
  value_text    TEXT,
  value_bool    BOOLEAN,
  notes         TEXT,
  entered_by    TEXT,
  entered_at    TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT manual_metrics_unique UNIQUE (quarter_id, week_number, section_id, metric_key)
);

CREATE INDEX IF NOT EXISTS idx_manual_quarter_section ON manual_metrics(quarter_id, section_id, week_number);


-- ────────────────────────────────────────────────────────────
-- 10. WEBHOOK LOG
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS webhook_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source       TEXT,
  event_type   TEXT,
  payload_hash TEXT,
  status       TEXT DEFAULT 'received',
  error_msg    TEXT,
  received_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ETL sync tracking
CREATE TABLE IF NOT EXISTS etl_sync_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name   TEXT NOT NULL,
  last_sync_at TIMESTAMPTZ DEFAULT '1970-01-01T00:00:00Z',
  rows_upserted INT DEFAULT 0,
  error_msg    TEXT,
  completed_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO etl_sync_log (table_name, last_sync_at) VALUES
  ('raw_leads', '1970-01-01T00:00:00Z'),
  ('raw_call_logs', '1970-01-01T00:00:00Z'),
  ('raw_tasks', '1970-01-01T00:00:00Z'),
  ('raw_whatsapp', '1970-01-01T00:00:00Z')
ON CONFLICT DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- 11. COMPUTED FUNCTIONS
-- ────────────────────────────────────────────────────────────

-- 11a. Qualified stages (confirmed against actual TeleCRM data)
CREATE OR REPLACE FUNCTION is_qualified_stage(p_status TEXT) RETURNS BOOLEAN AS $$
BEGIN
  RETURN LOWER(TRIM(p_status)) = ANY(ARRAY[
    'changes required',
    'customer quote reviewing',
    'first payment done',
    'initial deposit',
    'negotiation',
    'negotiation stage',             -- 1 lead observed; included for safety
    'post quote | indiscussion | fu 1',
    'post quote | indiscussion | fu 2',
    'post quote | indiscussion | fu 3',
    'post quote | indiscussion | fu 4',
    'post quote | no response 1',
    'post quote | no response 2',
    'post quote | no response 3',
    'post quote | no response 4',
    'qualified',
    'qualified | fit',
    'qualified | git',
    'quote explained',
    'quote sent',
    'revised quote sent'
  ]);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 11b. SLA deadline: was lead contacted within 60 business minutes?
-- Business hours: 10:00–20:00 IST, Mon–Sat (Sun off)
CREATE OR REPLACE FUNCTION sla_contact_deadline(p_created TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_ist       TIMESTAMPTZ := p_created AT TIME ZONE 'Asia/Kolkata';
  v_hour      INT := EXTRACT(HOUR FROM v_ist);
  v_dow       INT := EXTRACT(DOW FROM v_ist);  -- 0=Sun
  v_sla_start TIMESTAMPTZ;
BEGIN
  IF v_dow = 0 THEN
    -- Sunday → next Monday 10:00 IST
    v_sla_start := DATE_TRUNC('day', v_ist) + INTERVAL '1 day 10 hours';
  ELSIF v_hour < 10 THEN
    -- Before 10:00 → same day 10:00
    v_sla_start := DATE_TRUNC('day', v_ist) + INTERVAL '10 hours';
  ELSIF v_hour >= 20 THEN
    -- After 20:00 → next day 10:00 (skip Sunday)
    IF v_dow = 6 THEN  -- Saturday → Monday
      v_sla_start := DATE_TRUNC('day', v_ist) + INTERVAL '2 days 10 hours';
    ELSE
      v_sla_start := DATE_TRUNC('day', v_ist) + INTERVAL '1 day 10 hours';
    END IF;
  ELSE
    v_sla_start := v_ist;
  END IF;

  RETURN (v_sla_start + INTERVAL '60 minutes') AT TIME ZONE 'Asia/Kolkata';
END;
$$ LANGUAGE plpgsql IMMUTABLE;


-- ────────────────────────────────────────────────────────────
-- 12. VIEWS
-- ────────────────────────────────────────────────────────────

-- 12a. Per-agent sales metrics (useful for L1 drill-down)
CREATE OR REPLACE VIEW v_sales_metrics AS
WITH lead_first_call AS (
  SELECT
    l.telecrm_id,
    l.assignee,
    l.assignee_email,
    l.created_on,
    l.status,
    l.margin,
    l.advanced_received,
    l.week_number,
    l.quarter_id,
    l.first_call_date,
    l.first_call_duration_seconds,
    is_qualified_stage(l.status)                                    AS is_qualified,
    -- CONFIRMED: 'First Payment Done' is the WON/booking status in TeleCRM
    (LOWER(TRIM(l.status)) = 'first payment done')                  AS is_won,
    CASE
      WHEN l.first_call_date IS NOT NULL
        THEN l.first_call_date <= sla_contact_deadline(l.created_on)
      ELSE false
    END                                                              AS contacted_within_sla
  FROM raw_leads l
  WHERE l.is_deleted = false
    AND l.assignee_email IS NOT NULL
),
call_connect AS (
  SELECT lead_telecrm_id,
    BOOL_OR(is_meaningful_connect) AS has_connected_call
  FROM raw_call_logs
  GROUP BY lead_telecrm_id
),
task_sla AS (
  SELECT assignee_email, quarter_id, week_number,
    COUNT(*)                                              AS total_tasks,
    SUM(CASE WHEN is_completed_on_time THEN 1 ELSE 0 END) AS completed_on_time
  FROM raw_tasks
  WHERE status != 'cancelled'
  GROUP BY assignee_email, quarter_id, week_number
)
SELECT
  lfc.assignee,
  lfc.assignee_email,
  lfc.week_number,
  lfc.quarter_id,
  COUNT(*)                                                                           AS total_leads,
  ROUND(AVG(CASE WHEN lfc.contacted_within_sla THEN 100.0 ELSE 0 END)::NUMERIC, 1) AS pct_contacted_sla,
  ROUND(COUNT(CASE WHEN cc.has_connected_call THEN 1 END) * 100.0
        / NULLIF(COUNT(*), 0), 1)                                                   AS pct_connected,
  ROUND(COUNT(CASE WHEN lfc.is_qualified THEN 1 END) * 100.0
        / NULLIF(COUNT(*), 0), 1)                                                   AS pct_quote_sent,
  ROUND(COUNT(CASE WHEN lfc.is_won THEN 1 END) * 100.0
        / NULLIF(COUNT(*), 0), 1)                                                   AS conversion_pct,
  COUNT(CASE WHEN lfc.is_won THEN 1 END)                                            AS no_of_bookings,
  ROUND(COALESCE(ts.completed_on_time, 0) * 100.0
        / NULLIF(COALESCE(ts.total_tasks, 0), 0), 1)                                AS pct_followups_sla
FROM lead_first_call lfc
LEFT JOIN call_connect cc ON cc.lead_telecrm_id = lfc.telecrm_id
LEFT JOIN task_sla ts     ON ts.assignee_email  = lfc.assignee_email
                         AND ts.quarter_id       = lfc.quarter_id
                         AND ts.week_number      = lfc.week_number
GROUP BY lfc.assignee, lfc.assignee_email, lfc.week_number, lfc.quarter_id,
         ts.completed_on_time, ts.total_tasks;


-- 12b. Manager-level metrics (aggregates entire team per manager, per week)
-- Edwin's scorecard = Edwin + all 13 of his team members
-- Adarsh's scorecard = Adarsh + all 11 team members
-- Ashok's scorecard = Ashok + all 14 team members
CREATE OR REPLACE VIEW v_manager_metrics AS
WITH lead_data AS (
  SELECT
    st.manager,
    st.manager_email,
    l.telecrm_id,
    l.created_on,
    l.status,
    l.quarter_id,
    l.week_number,
    l.first_call_date,
    is_qualified_stage(l.status)                                    AS is_qualified,
    (LOWER(TRIM(l.status)) = 'first payment done')                  AS is_won,
    CASE
      WHEN l.first_call_date IS NOT NULL
        THEN l.first_call_date <= sla_contact_deadline(l.created_on)
      ELSE false
    END                                                              AS contacted_within_sla
  FROM raw_leads l
  JOIN sales_teams st ON LOWER(st.member_email) = LOWER(l.assignee_email)
  WHERE l.is_deleted = false
),
call_connect AS (
  SELECT lead_telecrm_id,
    BOOL_OR(is_meaningful_connect) AS has_connected_call
  FROM raw_call_logs
  GROUP BY lead_telecrm_id
),
task_sla AS (
  SELECT
    st.manager,
    rt.quarter_id,
    rt.week_number,
    COUNT(*)                                              AS total_tasks,
    SUM(CASE WHEN rt.is_completed_on_time THEN 1 ELSE 0 END) AS completed_on_time
  FROM raw_tasks rt
  JOIN sales_teams st ON LOWER(st.member_email) = LOWER(rt.assignee_email)
  WHERE rt.status != 'cancelled'
  GROUP BY st.manager, rt.quarter_id, rt.week_number
)
SELECT
  ld.manager,
  ld.manager_email,
  ld.quarter_id,
  ld.week_number,
  COUNT(*)                                                                           AS total_leads,
  ROUND(AVG(CASE WHEN ld.contacted_within_sla THEN 100.0 ELSE 0 END)::NUMERIC, 1) AS pct_contacted_sla,
  ROUND(COUNT(CASE WHEN cc.has_connected_call THEN 1 END) * 100.0
        / NULLIF(COUNT(*), 0), 1)                                                   AS pct_connected,
  ROUND(COUNT(CASE WHEN ld.is_qualified THEN 1 END) * 100.0
        / NULLIF(COUNT(*), 0), 1)                                                   AS pct_quote_sent,
  ROUND(COUNT(CASE WHEN ld.is_won THEN 1 END) * 100.0
        / NULLIF(COUNT(*), 0), 1)                                                   AS conversion_pct,
  COUNT(CASE WHEN ld.is_won THEN 1 END)                                             AS no_of_bookings,
  ROUND(COALESCE(ts.completed_on_time, 0) * 100.0
        / NULLIF(COALESCE(ts.total_tasks, 0), 0), 1)                                AS pct_followups_sla
FROM lead_data ld
LEFT JOIN call_connect cc ON cc.lead_telecrm_id = ld.telecrm_id
LEFT JOIN task_sla ts     ON ts.manager         = ld.manager
                         AND ts.quarter_id       = ld.quarter_id
                         AND ts.week_number      = ld.week_number
GROUP BY ld.manager, ld.manager_email, ld.quarter_id, ld.week_number,
         ts.completed_on_time, ts.total_tasks;


-- 12c. Call stats (for L1 talktime metrics)
CREATE OR REPLACE VIEW v_call_stats AS
WITH connected_calls AS (
  SELECT cl.agent_email, cl.quarter_id, cl.week_number, cl.duration_seconds
  FROM raw_call_logs cl
  WHERE cl.is_meaningful_connect = true
)
SELECT
  agent_email,
  quarter_id,
  week_number,
  COUNT(*)                         AS total_connected_calls,
  ROUND(AVG(duration_seconds))     AS avg_talktime_seconds,
  PERCENTILE_CONT(0.5)
    WITHIN GROUP (ORDER BY duration_seconds)::INT AS median_talktime_seconds
FROM connected_calls
GROUP BY agent_email, quarter_id, week_number;


-- 12d. Marketing metrics (Deeksha)
-- Leads = all leads in TeleCRM (source: raw_leads)
-- Spend = Supermetrics facebook_ads + google_ads tables (via v_ad_spend_weekly)
CREATE OR REPLACE VIEW v_marketing_metrics AS
SELECT
  l.quarter_id,
  l.week_number,
  COUNT(*)                                                                       AS total_leads_generated,
  COUNT(CASE WHEN is_qualified_stage(l.status) THEN 1 END)                      AS total_qualified_leads,
  COALESCE(ads.total_spend_with_gst, 0)                                         AS total_spend_with_gst,
  ROUND(COALESCE(ads.total_spend_with_gst, 0)
        / NULLIF(COUNT(*), 0), 0)                                               AS cpl,
  ROUND(COALESCE(ads.total_spend_with_gst, 0)
        / NULLIF(COUNT(CASE WHEN is_qualified_stage(l.status) THEN 1 END), 0), 0) AS cpql
FROM raw_leads l
LEFT JOIN (
  SELECT quarter_id, week_number, SUM(total_spend_with_gst) AS total_spend_with_gst
  FROM v_ad_spend_weekly
  GROUP BY quarter_id, week_number
) ads ON ads.quarter_id = l.quarter_id AND ads.week_number = l.week_number
WHERE l.is_deleted = false
GROUP BY l.quarter_id, l.week_number, ads.total_spend_with_gst;


-- 12e. Total sales (Edwin + Adarsh + Ashok combined)
CREATE OR REPLACE VIEW v_total_sales AS
SELECT
  quarter_id,
  week_number,
  SUM(total_leads)                   AS total_leads,
  ROUND(AVG(pct_contacted_sla), 1)   AS pct_contacted_sla,
  ROUND(AVG(pct_connected), 1)       AS pct_connected,
  ROUND(AVG(pct_quote_sent), 1)      AS pct_quote_sent,
  ROUND(AVG(conversion_pct), 1)      AS conversion_pct,
  SUM(no_of_bookings)                AS no_of_bookings,
  ROUND(AVG(pct_followups_sla), 1)   AS pct_followups_sla
FROM v_manager_metrics
-- All 3 managers
GROUP BY quarter_id, week_number;


-- 12f. Full scorecard flat view (dashboard uses this + targets table)
CREATE OR REPLACE VIEW v_scorecard_full AS

-- SALES: per manager (Edwin, Adarsh, Ashok) — team-aggregated
SELECT mm.quarter_id, mm.week_number, mm.manager AS owner_name, mm.manager AS section_id,
  'sales' AS department, 'total_leads' AS metric_key, mm.total_leads::NUMERIC AS value
FROM v_manager_metrics mm

UNION ALL SELECT mm.quarter_id, mm.week_number, mm.manager, mm.manager, 'sales', 'pct_contacted_sla',  mm.pct_contacted_sla  FROM v_manager_metrics mm
UNION ALL SELECT mm.quarter_id, mm.week_number, mm.manager, mm.manager, 'sales', 'pct_connected',      mm.pct_connected      FROM v_manager_metrics mm
UNION ALL SELECT mm.quarter_id, mm.week_number, mm.manager, mm.manager, 'sales', 'pct_quote_sent',     mm.pct_quote_sent     FROM v_manager_metrics mm
UNION ALL SELECT mm.quarter_id, mm.week_number, mm.manager, mm.manager, 'sales', 'conversion_pct',     mm.conversion_pct     FROM v_manager_metrics mm
UNION ALL SELECT mm.quarter_id, mm.week_number, mm.manager, mm.manager, 'sales', 'no_of_bookings',     mm.no_of_bookings     FROM v_manager_metrics mm
UNION ALL SELECT mm.quarter_id, mm.week_number, mm.manager, mm.manager, 'sales', 'pct_followups_sla',  mm.pct_followups_sla  FROM v_manager_metrics mm

-- TOTAL SALES
UNION ALL SELECT ts.quarter_id, ts.week_number, 'Total', 'total_sales', 'sales', 'total_leads',        ts.total_leads        FROM v_total_sales ts
UNION ALL SELECT ts.quarter_id, ts.week_number, 'Total', 'total_sales', 'sales', 'pct_contacted_sla',  ts.pct_contacted_sla  FROM v_total_sales ts
UNION ALL SELECT ts.quarter_id, ts.week_number, 'Total', 'total_sales', 'sales', 'pct_connected',      ts.pct_connected      FROM v_total_sales ts
UNION ALL SELECT ts.quarter_id, ts.week_number, 'Total', 'total_sales', 'sales', 'pct_quote_sent',     ts.pct_quote_sent     FROM v_total_sales ts
UNION ALL SELECT ts.quarter_id, ts.week_number, 'Total', 'total_sales', 'sales', 'conversion_pct',     ts.conversion_pct     FROM v_total_sales ts
UNION ALL SELECT ts.quarter_id, ts.week_number, 'Total', 'total_sales', 'sales', 'no_of_bookings',     ts.no_of_bookings     FROM v_total_sales ts
UNION ALL SELECT ts.quarter_id, ts.week_number, 'Total', 'total_sales', 'sales', 'pct_followups_sla',  ts.pct_followups_sla  FROM v_total_sales ts

-- MARKETING: Deeksha
UNION ALL SELECT mm.quarter_id, mm.week_number, 'Deeksha', 'deeksha', 'marketing', 'total_leads',          mm.total_leads_generated FROM v_marketing_metrics mm
UNION ALL SELECT mm.quarter_id, mm.week_number, 'Deeksha', 'deeksha', 'marketing', 'total_qualified',      mm.total_qualified_leads FROM v_marketing_metrics mm
UNION ALL SELECT mm.quarter_id, mm.week_number, 'Deeksha', 'deeksha', 'marketing', 'total_spend',          mm.total_spend_with_gst  FROM v_marketing_metrics mm
UNION ALL SELECT mm.quarter_id, mm.week_number, 'Deeksha', 'deeksha', 'marketing', 'cpl',                  mm.cpl                   FROM v_marketing_metrics mm
UNION ALL SELECT mm.quarter_id, mm.week_number, 'Deeksha', 'deeksha', 'marketing', 'cpql',                 mm.cpql                  FROM v_marketing_metrics mm

-- MANUAL (Brand, HR, Finance, etc.)
UNION ALL SELECT mnl.quarter_id, mnl.week_number, mnl.section_id, mnl.section_id, 'manual', mnl.metric_key, mnl.value_num
FROM manual_metrics mnl;


-- ────────────────────────────────────────────────────────────
-- 13. ROW-LEVEL SECURITY (enable after auth setup)
-- ────────────────────────────────────────────────────────────
-- ALTER TABLE raw_leads ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE targets ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE manual_metrics ENABLE ROW LEVEL SECURITY;
--
-- CREATE POLICY "leadership_all" ON raw_leads FOR ALL
--   USING (auth.jwt() ->> 'role' = 'leadership');
--
-- CREATE POLICY "manager_team_leads" ON raw_leads FOR SELECT
--   USING (assignee_email IN (
--     SELECT member_email FROM sales_teams
--     WHERE manager_email = auth.jwt() ->> 'email'
--   ));


-- ────────────────────────────────────────────────────────────
-- 14. SAMPLE QUERIES
-- ────────────────────────────────────────────────────────────

-- Manager scorecard for active quarter:
-- SELECT * FROM v_manager_metrics WHERE quarter_id = active_quarter_id() ORDER BY manager, week_number;

-- Edwin's team week 1:
-- SELECT * FROM v_manager_metrics WHERE manager = 'edwin' AND quarter_id = active_quarter_id() AND week_number = 1;

-- Full scorecard week 1 with targets:
-- SELECT sf.*, t.target_value, t.higher_is_better
-- FROM v_scorecard_full sf
-- LEFT JOIN targets t ON t.quarter_id = sf.quarter_id
--   AND t.section_id = sf.section_id AND t.metric_key = sf.metric_key
-- WHERE sf.quarter_id = active_quarter_id() AND sf.week_number = 1;

-- Marketing metrics by week:
-- SELECT * FROM v_marketing_metrics WHERE quarter_id = active_quarter_id() ORDER BY week_number;

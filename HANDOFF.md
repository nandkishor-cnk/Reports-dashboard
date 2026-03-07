# Cox & Kings — EOS Scorecard System
## Claude Code Handoff Document
> Paste this entire file as your FIRST message when starting Claude Code

---

## PROJECT SUMMARY
Building a full-stack EOS Weekly Scorecard system for Cox & Kings. 
Phase 1: Sales (Edwin, Adarsh, Ashok) + Marketing (Deeksha).
All other departments are on HOLD — show as blank.

---

## WHAT'S ALREADY BUILT (files in this folder)

### `scorecard_dashboard.jsx`
- Full React dashboard with shadcn/ui + Tailwind
- 13-week scorecard grid, exact format from PDF
- Green/Red cell coloring vs targets
- Sidebar: filter by department/agent, collapse
- Quarter selector (Q1–Q4 FY2026)
- Manage Targets view — inline edit OR CSV upload
- Download CSV Template + Upload Targets CSV
- Export Full Scorecard CSV
- Currently uses MOCK DATA — needs wiring to Supabase

### `supabase_schema.sql`
- Full production Supabase schema
- Tables: quarters, targets, raw_leads, raw_call_logs, raw_tasks, raw_whatsapp, raw_ad_spend, manual_metrics, webhook_log
- Auto week-number triggers on all tables
- `is_qualified_stage()` — 19 TeleCRM stage names mapped
- `sla_contact_deadline()` — 10AM–8PM IST, Sun off, 60-min SLA
- Views: v_sales_metrics, v_marketing_metrics, v_total_sales, v_scorecard_full
- NOT YET RUN — needs to be executed in Supabase SQL Editor

---

## DATA SOURCES

### TeleCRM (Primary — Sales data)
- Type: PostgreSQL RDS on AWS
- Host: database-2.c4ftplvewera.ap-south-1.rds.amazonaws.com
- Port: 5432
- Database: cox_and_kings
- User: cox_and_kings
- Password: [ROTATE BEFORE USE — was shared in chat, must change]
- Data: Leads, Call Logs, Tasks, WhatsApp messages
- Integration method: Webhook push to Supabase Edge Function (preferred) OR scheduled ETL pull

### Ad Spend (Marketing — Deeksha)
- Tool: Windsor.ai (preferred) OR Supermetrics
- Data: Meta/Facebook/Instagram ad spend, impressions, leads
- Integration: Windsor.ai has native Supabase connector — no code needed
- Target table: raw_ad_spend in Supabase

### Brand Metrics (Loyana)
- Manual entry via dashboard for now
- Future: Instagram Graph API (follower growth, engagement rate, reach)
- Instagram API is possible with Meta Business account token

### All other departments
- Status: HOLD — show blank in dashboard
- Future phases: HR1 (HR), Google Analytics (Tech/Brand), Tally/manual (Finance)

---

## METRIC CALCULATIONS (exact rules)

### SLA — % Leads Contacted (Sales)
- Lead must be called within 60 BUSINESS minutes of creation
- Business hours: 10:00 AM – 8:00 PM IST, Monday–Saturday (Sunday OFF)
- If lead arrives after 8PM → SLA clock starts next day 10AM
- If lead arrives on Sunday → SLA clock starts Monday 10AM
- Formula: count(first_call_date <= sla_deadline) / total_leads * 100

### % Leads Connected
- Call log shows "connected" status AND duration >= 60 seconds
- Formula: count(meaningful_connects) / total_leads * 100

### % Quote Sent (Qualified stages)
Leads in ANY of these TeleCRM stages count as "quote sent":
- Changes Required
- Customer Quote Reviewing
- First Payment Done
- Initial Deposit
- Negotiation
- Post Quote | Indiscussion | FU 1/2/3/4
- Post Quote | No Response 1/2/3/4
- Qualified
- Qualified | FIT
- Qualified | GIT
- Quote Explained
- Quote Sent
- Revised Quote Sent

### Conversion %
- Formula: count(status = 'WON') / total_leads * 100

### No. of Bookings
- count(status = 'WON') for the week

### % Follow-ups Done as per SLA
- Tasks completed on or before due_at / total tasks * 100

### Marketing — CPL
- Formula: total_spend_with_gst / total_leads_generated

### Marketing — CPQL
- Formula: total_spend_with_gst / total_qualified_leads

### Marketing — Total Spend
- Source: Windsor.ai → raw_ad_spend table
- Spend already includes 18% GST (spend_with_gst = spend_inr * 1.18)

### GM ROAS — BLANK for now

---

## WEEK DEFINITION
- 1 quarter = 13 calendar weeks (Mon–Sun)
- Week 1 = first Monday on or after quarter start date
- Quarters: Q1=Jan-Mar, Q2=Apr-Jun, Q3=Jul-Sep, Q4=Oct-Dec (Financial Year)

---

## DASHBOARD VIEWS REQUIRED
1. **Leadership/Founder** — Full scorecard, all departments, 13-week grid (exact PDF format)
2. **Department view** — One department, week-by-week with trend charts
3. **Team view** — Edwin vs Adarsh vs Ashok side-by-side comparison
4. **Agent view** — Individual deep-dive with all their metrics

---

## OUTPUTS REQUIRED
- [x] On-screen dashboard with Green/Red cells (built)
- [ ] PDF export matching exact scorecard format from PDF
- [ ] Excel/XLSX download
- [ ] CSV export of filtered data (built)

---

## NEXT TASKS FOR CLAUDE CODE

### Task 1 — Map TeleCRM schema
Connect to TeleCRM RDS and run:
```sql
SELECT table_schema, table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog','information_schema')
ORDER BY table_schema, table_name, ordinal_position;
```
Map actual column names → supabase_schema.sql raw_leads columns

### Task 2 — Run Supabase schema
Execute supabase_schema.sql in Supabase SQL Editor
Supabase project URL: [TO BE ADDED]
Service role key: [TO BE ADDED — store in .env, never commit]

### Task 3 — Write ETL sync script
Pull from TeleCRM RDS → transform → upsert into Supabase
Schedule: every 15 minutes via Supabase Edge Function cron

### Task 4 — Write Supabase Edge Function (webhook handler)
Endpoint: /functions/v1/telecrm-webhook
Receives: lead created/updated, call log, task events
Validates HMAC signature, upserts to correct raw_* table

### Task 5 — Wire dashboard to Supabase
Replace all MOCK_DATA in scorecard_dashboard.jsx with:
- Supabase JS client queries against v_scorecard_full view
- Real-time subscription for live updates
- Supabase anon key (safe for frontend)

### Task 6 — PDF export
Generate PDF matching exact scorecard format:
- Header: COX & KINGS — EOS WEEKLY SCORECARD
- Columns: Measurable | Owner | Target | Wk1–Wk13
- Green cells = on track, Red cells = off track
- Section banners per department
- Use puppeteer or @react-pdf/renderer

### Task 7 — Set up Windsor.ai connector
Configure Windsor.ai → Supabase destination
Map Meta Ads fields → raw_ad_spend table columns
Schedule: daily sync at 6AM IST

---

## ENVIRONMENT VARIABLES NEEDED
Create `.env.local` (never commit this file):
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
SUPABASE_ANON_KEY=eyJ...
TELECRM_DB_HOST=database-2.c4ftplvewera.ap-south-1.rds.amazonaws.com
TELECRM_DB_PORT=5432
TELECRM_DB_NAME=cox_and_kings
TELECRM_DB_USER=cox_and_kings
TELECRM_DB_PASS=[rotated password here]
WINDSOR_API_KEY=wai_xxxx
TELECRM_WEBHOOK_SECRET=xxxx
```

---

## TECH STACK
- Frontend: React + shadcn/ui + Tailwind CSS
- Database: Supabase (Postgres)
- Backend: Supabase Edge Functions (Deno)
- Source DB: TeleCRM RDS (Postgres, AWS ap-south-1)
- Ad data: Windsor.ai → Supabase
- PDF: @react-pdf/renderer or puppeteer
- Hosting: Vercel (frontend) + Supabase (backend)

---

## SECURITY REMINDERS
- Rotate TeleCRM DB password immediately (AWS RDS → Modify)
- Never commit .env files
- Use Supabase Row Level Security for agent-level access
- Supabase service_role key = server only, never frontend
- TeleCRM webhook must validate HMAC signature

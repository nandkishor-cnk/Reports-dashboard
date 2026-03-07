# TeleCRM RDS → Supabase Schema Mapping
## Task 1 Output — Cox & Kings EOS Scorecard

**Connection verified:** `database-2.c4ftplvewera.ap-south-1.rds.amazonaws.com:5432/cox_and_kings`
**Data range:** 2025-12-20 → 2026-03-01 | **Total active leads:** 17,112

---

## PHASE 1 AGENT EMAILS (Critical)

| Dashboard Name | TeleCRM Email                        | Role    | Leads (direct) |
|----------------|--------------------------------------|---------|---------------|
| Edwin          | edwin.rajappan@coxandkings.com       | ADMIN   | 157           |
| Adarsh         | adarsh.raheja@coxandkings.com        | ADMIN   | 1             |
| Ashok          | ashok.pednekar@coxandkings.com       | MANAGER | 17            |
| Deeksha        | deeksha.sharma@coxandkings.com       | ADMIN   | —             |

> **IMPORTANT:** Edwin/Adarsh/Ashok are admins with very few *direct* leads.
> Most leads are assigned to CALLER-role agents. Clarify: does the scorecard
> measure their own leads OR leads they manage/oversee?

---

## CRITICAL SCHEMA DIFFERENCES vs ASSUMED

### 1. "WON" Status Does Not Exist
- TeleCRM has NO `Won` or `WON` status
- **Closest equivalent: `First Payment Done`** (56 leads, only status with advance_received set)
- Other "conversion" proxies: `Initial Deposit` (20 leads)
- **Action required:** Confirm with team — is `First Payment Done` = booking?
- `supabase_schema.sql` must change: `(LOWER(TRIM(l.status)) = 'won')` → `(LOWER(TRIM(l.status)) = 'first payment done')`

### 2. Call Status Values (action_callerdesk.status)
| TeleCRM Value          | Count  | Map to Supabase       |
|------------------------|--------|-----------------------|
| `ANSWER`               | 15,017 | `'connected'`         |
| `CANCEL BY AGENT`      | 11,267 | `'not_connected'`     |
| `CANCEL BY CUSTOMER`   | 8,771  | `'not_connected'`     |
| `CANCEL`               | 1,206  | `'not_connected'`     |
| `__empty__`            | 1,699  | `'unknown'`           |
| `NO ANSWER`            | 46     | `'no_answer'`         |
| `Agent on break...`    | 211    | `'not_connected'`     |
| `None`                 | 54     | `'unknown'`           |
| `Congestion`           | 38     | `'not_connected'`     |
| `AbandonedCall`        | 18     | `'not_connected'`     |
| `Unavailable`          | 16     | `'not_connected'`     |
- `is_meaningful_connect`: `status = 'ANSWER' AND duration >= 60`

### 3. Call Duration Unit
- `action_callerdesk.duration` = **seconds** (bigint)
- Value of **-1** = call attempted but no answer/cancel (not connected)
- Filter: `duration >= 60` for meaningful connects (on top of `status = 'ANSWER'`)

### 4. First Call Duration in leads Table
- `leads.number_first_call_duration` = **seconds** (double precision)
- Value of **-1** = missed call (no connection). Filter these out for SLA logic.
- Use `leads.date_first_call_date_and_time` for SLA deadline comparison

### 5. Task On-Time Logic is Already Encoded
- `call_followup.status`:
  - `Done` = completed **on time** (completed_at ≤ deadline) → `is_completed_on_time = true`
  - `Late` = completed **after** deadline → `is_completed_on_time = false`
  - `Cancelled` = cancelled
  - `Pending` = not yet done
- **No need to compute** `completed_at <= due_at` — use `status = 'Done'` directly
- `completed_at` = `call_followup.updated_on` (when status changed to Done/Late)

### 6. Timestamps: No Timezone Info
- All timestamps are `timestamp without time zone`
- **Assumed IST (UTC+5:30)** — Edwin's calls at 17:26–17:42 match IST business hours
- In ETL: append `AT TIME ZONE 'Asia/Kolkata'` when inserting into Supabase TIMESTAMPTZ columns
- SLA function in `supabase_schema.sql` is correct (already handles IST conversion)

### 7. Money Fields Are VARCHAR
- `leads.money_approximate_budget`, `money_expected_margin`, `money_margin`, `money_advanced_received`
- All stored as `character varying(20)`, not NUMERIC
- ETL must: `CAST(NULLIF(money_margin, '') AS NUMERIC)`

### 8. WhatsApp Direction
- `action_whatsapp_msg.type`:
  - `OUTGOING_WHATSAPP_MSG` → `'outbound'`
  - `INCOMING_WHATSAPP_MSG` → `'inbound'`

---

## TABLE MAPPING

### `leads` → `raw_leads`

| Supabase `raw_leads` column      | TeleCRM `leads` column                          | Transform needed                    |
|----------------------------------|-------------------------------------------------|-------------------------------------|
| `telecrm_id`                     | `leadid`                                        | char(24), trim whitespace           |
| `created_on`                     | `created_on`                                    | `AT TIME ZONE 'Asia/Kolkata'`       |
| `updated_on`                     | `updated_on`                                    | `AT TIME ZONE 'Asia/Kolkata'`       |
| `is_deleted`                     | `is_deleted`                                    | direct                              |
| `assignee_email`                 | `assignee`                                      | email address                       |
| `assignee`                       | JOIN `team_member` ON `email = assignee`        | get `team_member.name`              |
| `name`                           | `text_name`                                     | direct                              |
| `phone`                          | `phone_phone`                                   | direct                              |
| `alternate_phone`                | `phone_alternate_phone`                         | direct                              |
| `email`                          | `email_email`                                   | direct                              |
| `lead_source`                    | `dropdown_lead_source`                          | direct                              |
| `list_names`                     | `list_name`                                     | already ARRAY                       |
| `status`                         | `status`                                        | direct                              |
| `rating`                         | `rating`                                        | VARCHAR → NUMERIC if needed         |
| `lost_reason`                    | `lost_reason`                                   | direct                              |
| `travel_destination`             | `dropdown_travel_destination`                   | direct                              |
| `travel_destination_name`        | `text_travel_destination_name`                  | direct                              |
| `travel_date`                    | `date_travel_date`                              | `AT TIME ZONE 'Asia/Kolkata'`       |
| `number_of_travelers_adults`     | `number_number_of_travelers_adults`             | `::INT`                             |
| `number_of_travelers_child_beds` | `number_number_of_travelers_child_with_beds`    | `::INT`                             |
| `number_of_travelers_child_nobed`| `number_number_of_travelers_child_no_bed`       | `::INT`                             |
| `number_of_travelers_infants`    | `number_number_of_travelers_infants`            | `::INT`                             |
| `approximate_budget`             | `money_approximate_budget`                      | `CAST(NULLIF(...,'') AS NUMERIC)`   |
| `package_name`                   | `text_package_name`                             | direct                              |
| `who_travelling_with`            | `dropdown_who_are_you_planning_to_travel_with`  | direct                              |
| `when_to_travel`                 | `dropdown_when_would_you_like_to_travel`        | direct                              |
| `when_to_book`                   | `dropdown_when_would_you_like_to_book`          | direct                              |
| `buyer_type`                     | `dropdown_buyer_type`                           | direct                              |
| `flights_booked`                 | `dropdown_flights_booked`                       | direct                              |
| `visa_status`                    | `dropdown_visa_status`                          | direct                              |
| `utm_source`                     | `text_utm_source`                               | direct                              |
| `utm_medium`                     | `text_utm_medium`                               | direct                              |
| `utm_campaign`                   | `text_utm_campaign`                             | direct                              |
| `utm_term`                       | `text_utm_term`                                 | direct                              |
| `utm_content`                    | `text_utm_content`                              | direct                              |
| `gclid`                          | `text_gclid`                                    | direct                              |
| `fbclid`                         | `text_fbclid`                                   | direct                              |
| `facebook_ad`                    | `text_facebook_ad`                              | direct                              |
| `facebook_ad_name`               | `text_facebook_ad_name`                         | direct                              |
| `facebook_campaign`              | `text_facebook_campaign`                        | direct                              |
| `facebook_lead_id`               | `text_facebook_lead_id`                         | direct                              |
| `facebook_ad_set_id`             | `text_facebook_ad_set_id`                       | direct                              |
| `facebook_ad_set_name`           | `text_facebook_ad_set_name`                     | direct                              |
| `expected_margin`                | `money_expected_margin`                         | `CAST(NULLIF(...,'') AS NUMERIC)`   |
| `margin`                         | `money_margin`                                  | `CAST(NULLIF(...,'') AS NUMERIC)`   |
| `advanced_received`              | `money_advanced_received`                       | `CAST(NULLIF(...,'') AS NUMERIC)`   |
| `expected_closure_date`          | `date_expected_closure_date`                    | `AT TIME ZONE 'Asia/Kolkata'`       |
| `first_call_date`                | `date_first_call_date_and_time`                 | `AT TIME ZONE 'Asia/Kolkata'`       |
| `first_call_duration_seconds`    | `number_first_call_duration`                    | `::INT`, treat -1 as NULL           |
| `next_follow_up_date`            | `date_next_follow_up_date`                      | `AT TIME ZONE 'Asia/Kolkata'`       |
| `recapture_date`                 | `date_recapture_date`                           | `AT TIME ZONE 'Asia/Kolkata'`       |
| `recapture_count`                | `number_recapture_count`                        | `::INT`                             |
| `skill_map_group`                | `dropdown_skill_map_group`                      | direct                              |
| `lead_distribution_type`         | `dropdown_lead_distributiontype`                | direct                              |

**Columns in TeleCRM `leads` with NO mapping (informational only):**
- `text_test_1`, `text_other_country`, `text_other_country_1`, `text_budget`
- `checkbox_missed_call_attempted`, `checkbox_first_call`
- `dropdown_type_of_negotiation`, `dropdown_lead_remarks`
- `dropdown_travel_destination_autoassigned`, `dropdown_package_type_fit_or_git`
- `dropdown_trip_planning_stage`, `dropdown_otp_status`
- `website_page_url`, `website_referrer_url`, `text_message`
- `date_time_to_connect`, `dropdown_when_is_a_good_time_to_connect`
- `text_number_of_travellers` (redundant with number_* fields)
- `text_lost_reason_detailed_remark` (more detail than `lost_reason`)

---

### `action_callerdesk` → `raw_call_logs`

| Supabase `raw_call_logs` column  | TeleCRM `action_callerdesk` column  | Transform                           |
|----------------------------------|-------------------------------------|-------------------------------------|
| `telecrm_call_id`                | `actionid`                          | char(24), trim                      |
| `lead_telecrm_id`                | `leadid`                            | char(24), trim                      |
| `agent_email`                    | `teammember_email`                  | direct                              |
| `agent_name`                     | JOIN `team_member` ON email         | get name                            |
| `call_direction`                 | `type`                              | `CALLER_DESK_OUTGOING_CALL` → `'outbound'`; `CALLER_DESK_INCOMING_CALL` → `'inbound'` |
| `call_status`                    | `status`                            | See mapping table above             |
| `duration_seconds`               | `duration`                          | `::INT`, treat -1 as 0              |
| `call_started_at`                | `created_on`                        | `AT TIME ZONE 'Asia/Kolkata'`       |
| `call_ended_at`                  | `created_on + duration seconds`     | computed; NULL if duration=-1       |

**Status mapping for ETL:**
```python
CALL_STATUS_MAP = {
    'ANSWER': 'connected',
    'CANCEL BY AGENT': 'not_connected',
    'CANCEL BY CUSTOMER': 'not_connected',
    'CANCEL': 'not_connected',
    'NO ANSWER': 'no_answer',
    'Congestion': 'not_connected',
    'AbandonedCall': 'not_connected',
    'Unavailable': 'not_connected',
    'Agent on break. Call not allowed': 'not_connected',
    'No Callgroup is available for this Account.': 'not_connected',
    'PICKED': 'connected',
    # Default for __empty__, None, unknown
}
```

`is_meaningful_connect` (computed column in Supabase) = `call_status = 'connected' AND duration_seconds >= 60`

---

### `call_followup` → `raw_tasks`

| Supabase `raw_tasks` column      | TeleCRM `call_followup` column      | Transform                           |
|----------------------------------|-------------------------------------|-------------------------------------|
| `telecrm_task_id`                | `task_id`                           | char(24), trim                      |
| `lead_telecrm_id`                | `leadid`                            | char(24), trim                      |
| `assignee_email`                 | `assignee`                          | email address                       |
| `assignee_name`                  | JOIN `team_member` ON email         | get name                            |
| `task_type`                      | (not in source)                     | hardcode `'call'`                   |
| `task_title`                     | (not in source)                     | NULL                                |
| `due_at`                         | `deadline`                          | `AT TIME ZONE 'Asia/Kolkata'`       |
| `completed_at`                   | `updated_on` when status Done/Late  | `AT TIME ZONE 'Asia/Kolkata'`; NULL if Pending/Cancelled |
| `status`                         | `status`                            | See mapping below                   |

**Task status mapping:**
```python
TASK_STATUS_MAP = {
    'Done':      'completed',
    'Late':      'completed',   # completed but after deadline
    'Pending':   'pending',
    'Cancelled': 'cancelled',
}
```

**`is_completed_on_time` logic (override the generated column):**
- `Done` → TRUE (completed within deadline)
- `Late` → FALSE (completed after deadline)
- `Pending` / `Cancelled` → NULL

> Note: Supabase schema defines this as a GENERATED ALWAYS AS column using
> `completed_at <= due_at`. This will work correctly because:
> - Done rows: updated_on ≤ deadline
> - Late rows: updated_on > deadline
> The TeleCRM status already validates this correctly.

---

### `action_whatsapp_msg` → `raw_whatsapp`

| Supabase `raw_whatsapp` column   | TeleCRM `action_whatsapp_msg` column | Transform                          |
|----------------------------------|--------------------------------------|------------------------------------|
| `telecrm_msg_id`                 | `actionid`                           | char(24), trim                     |
| `lead_telecrm_id`                | `leadid`                             | char(24), trim                     |
| `agent_email`                    | `teammember_email`                   | direct                             |
| `direction`                      | `type`                               | `OUTGOING_WHATSAPP_MSG` → `'outbound'`; `INCOMING_WHATSAPP_MSG` → `'inbound'` |
| `message_type`                   | `msg_type`                           | `TEXT` → `'text'`; keep others as-is |
| `sent_at`                        | `sent_timestamp`                     | `AT TIME ZONE 'Asia/Kolkata'`; fallback to `created_on` |
| `delivered`                      | `delivered_timestamp IS NOT NULL`    | boolean                            |
| `read_by_lead`                   | `read_timestamp IS NOT NULL`         | boolean                            |

---

## FIXES REQUIRED IN supabase_schema.sql

### Fix 1 — WON status (v_sales_metrics, line ~497)
```sql
-- BEFORE (wrong — this status doesn't exist in TeleCRM)
(LOWER(TRIM(l.status)) = 'won') AS is_won,

-- AFTER
(LOWER(TRIM(l.status)) = 'first payment done') AS is_won,
```

### Fix 2 — is_qualified_stage function (confirm stage names match exactly)
All 19 stage names in the function were verified against actual TeleCRM data. ✅ Match confirmed.
Note: TeleCRM also has `Negotiation Stage` (1 lead) — this is NOT in the function.
Confirm if `Negotiation Stage` should be added alongside `Negotiation`.

### Fix 3 — raw_call_logs is_meaningful_connect (line ~227)
```sql
-- BEFORE (wrong field value)
call_status = 'connected' AND duration_seconds >= 60

-- AFTER (already correct in schema IF ETL maps ANSWER → connected)
-- ETL must map: TeleCRM 'ANSWER' → Supabase 'connected'
-- No change to schema needed — ETL handles the mapping
```

### Fix 4 — v_total_sales agent name filter (line ~605)
```sql
-- BEFORE (matches by assignee name — but how is name stored?)
WHERE LOWER(assignee) IN ('edwin', 'adarsh', 'ashok')

-- AFTER (filter by email instead — more reliable)
WHERE assignee_email IN (
  'edwin.rajappan@coxandkings.com',
  'adarsh.raheja@coxandkings.com',
  'ashok.pednekar@coxandkings.com'
)
```

### Fix 5 — Add `assignee_email` as the primary agent filter column
The `raw_leads.assignee_email` will contain the TeleCRM `assignee` email.
`raw_leads.assignee` will contain the human-readable name (from team_member join).
Both views must filter on `assignee_email` for reliability.

---

## ETL QUERY SKELETONS

### Pull leads from TeleCRM
```sql
SELECT
  TRIM(l.leadid)                                    AS telecrm_id,
  l.created_on AT TIME ZONE 'Asia/Kolkata'          AS created_on,
  l.updated_on AT TIME ZONE 'Asia/Kolkata'          AS updated_on,
  COALESCE(l.is_deleted, false)                     AS is_deleted,
  l.assignee                                        AS assignee_email,
  tm.name                                           AS assignee,
  l.text_name                                       AS name,
  l.phone_phone                                     AS phone,
  l.phone_alternate_phone                           AS alternate_phone,
  l.email_email                                     AS email,
  l.dropdown_lead_source                            AS lead_source,
  l.list_name                                       AS list_names,
  l.status,
  l.lost_reason,
  l.dropdown_travel_destination                     AS travel_destination,
  l.text_travel_destination_name                    AS travel_destination_name,
  l.date_travel_date AT TIME ZONE 'Asia/Kolkata'    AS travel_date,
  l.number_number_of_travelers_adults::INT          AS number_of_travelers_adults,
  l.number_number_of_travelers_child_with_beds::INT AS number_of_travelers_child_beds,
  l.number_number_of_travelers_child_no_bed::INT    AS number_of_travelers_child_nobed,
  l.number_number_of_travelers_infants::INT         AS number_of_travelers_infants,
  CAST(NULLIF(l.money_approximate_budget,'') AS NUMERIC)  AS approximate_budget,
  l.text_package_name                               AS package_name,
  l.dropdown_who_are_you_planning_to_travel_with    AS who_travelling_with,
  l.dropdown_when_would_you_like_to_travel          AS when_to_travel,
  l.dropdown_when_would_you_like_to_book            AS when_to_book,
  l.dropdown_buyer_type                             AS buyer_type,
  l.dropdown_flights_booked                         AS flights_booked,
  l.dropdown_visa_status                            AS visa_status,
  l.text_utm_source                                 AS utm_source,
  l.text_utm_medium                                 AS utm_medium,
  l.text_utm_campaign                               AS utm_campaign,
  l.text_utm_term                                   AS utm_term,
  l.text_utm_content                                AS utm_content,
  l.text_gclid                                      AS gclid,
  l.text_fbclid                                     AS fbclid,
  l.text_facebook_ad                                AS facebook_ad,
  l.text_facebook_ad_name                           AS facebook_ad_name,
  l.text_facebook_campaign                          AS facebook_campaign,
  l.text_facebook_lead_id                           AS facebook_lead_id,
  l.text_facebook_ad_set_id                         AS facebook_ad_set_id,
  l.text_facebook_ad_set_name                       AS facebook_ad_set_name,
  CAST(NULLIF(l.money_expected_margin,'') AS NUMERIC) AS expected_margin,
  CAST(NULLIF(l.money_margin,'') AS NUMERIC)          AS margin,
  CAST(NULLIF(l.money_advanced_received,'') AS NUMERIC) AS advanced_received,
  l.date_expected_closure_date AT TIME ZONE 'Asia/Kolkata' AS expected_closure_date,
  l.date_first_call_date_and_time AT TIME ZONE 'Asia/Kolkata' AS first_call_date,
  CASE WHEN l.number_first_call_duration = -1 THEN NULL
       ELSE l.number_first_call_duration::INT END   AS first_call_duration_seconds,
  l.date_next_follow_up_date AT TIME ZONE 'Asia/Kolkata' AS next_follow_up_date,
  l.date_recapture_date AT TIME ZONE 'Asia/Kolkata' AS recapture_date,
  l.number_recapture_count::INT                     AS recapture_count,
  l.dropdown_skill_map_group                        AS skill_map_group,
  l.dropdown_lead_distributiontype                  AS lead_distribution_type
FROM leads l
LEFT JOIN team_member tm ON LOWER(tm.email) = LOWER(l.assignee)
WHERE l.updated_on > $1  -- incremental: pass last_synced_at
ORDER BY l.updated_on;
```

### Pull calls from TeleCRM
```sql
SELECT
  TRIM(c.actionid) AS telecrm_call_id,
  TRIM(c.leadid)   AS lead_telecrm_id,
  c.teammember_email AS agent_email,
  tm.name          AS agent_name,
  CASE c.type
    WHEN 'CALLER_DESK_OUTGOING_CALL' THEN 'outbound'
    WHEN 'CALLER_DESK_INCOMING_CALL' THEN 'inbound'
    ELSE 'unknown'
  END              AS call_direction,
  CASE c.status
    WHEN 'ANSWER'               THEN 'connected'
    WHEN 'PICKED'               THEN 'connected'
    WHEN 'CANCEL BY AGENT'      THEN 'not_connected'
    WHEN 'CANCEL BY CUSTOMER'   THEN 'not_connected'
    WHEN 'CANCEL'               THEN 'not_connected'
    WHEN 'NO ANSWER'            THEN 'no_answer'
    ELSE 'unknown'
  END              AS call_status,
  GREATEST(c.duration::INT, 0) AS duration_seconds,
  c.created_on AT TIME ZONE 'Asia/Kolkata' AS call_started_at,
  CASE WHEN c.duration > 0
    THEN (c.created_on + (c.duration || ' seconds')::INTERVAL) AT TIME ZONE 'Asia/Kolkata'
    ELSE NULL
  END AS call_ended_at
FROM action_callerdesk c
LEFT JOIN team_member tm ON LOWER(tm.email) = LOWER(c.teammember_email)
WHERE c.created_on > $1
ORDER BY c.created_on;
```

### Pull tasks from TeleCRM
```sql
SELECT
  TRIM(cf.task_id)  AS telecrm_task_id,
  TRIM(cf.leadid)   AS lead_telecrm_id,
  cf.assignee       AS assignee_email,
  tm.name           AS assignee_name,
  'call'::TEXT      AS task_type,
  cf.deadline AT TIME ZONE 'Asia/Kolkata' AS due_at,
  CASE WHEN cf.status IN ('Done','Late')
    THEN cf.updated_on AT TIME ZONE 'Asia/Kolkata'
    ELSE NULL
  END AS completed_at,
  CASE cf.status
    WHEN 'Done'      THEN 'completed'
    WHEN 'Late'      THEN 'completed'
    WHEN 'Pending'   THEN 'pending'
    WHEN 'Cancelled' THEN 'cancelled'
    ELSE 'pending'
  END AS status
FROM call_followup cf
LEFT JOIN team_member tm ON LOWER(tm.email) = LOWER(cf.assignee)
WHERE cf.updated_on > $1
ORDER BY cf.updated_on;
```

---

## OPEN QUESTIONS (need answers before ETL)

1. **"Booking" definition:** Is `First Payment Done` the correct "WON" status? Or should both `First Payment Done` + `Initial Deposit` count?

2. **Agent scope:** Edwin/Adarsh/Ashok have very few direct leads (157/1/17). Does the scorecard measure:
   - Their *own* directly-assigned leads only?
   - Or leads of all agents under their team?
   - Or should scorecard filter by a `skill_map_group` or `list_name` value?

3. **Phase 1 data go-live date:** Are we tracking from Q1 FY2026 (Jan 1, 2026) or from the actual data start (Dec 20, 2025)?

4. **`Negotiation Stage`** (1 lead) — should it be included in qualified stages alongside `Negotiation`?

5. **Timezone confirmation:** TeleCRM timestamps assumed IST. Has this been confirmed with TeleCRM support?

"""
Cox & Kings EOS Scorecard — Supabase Upsert ETL  (Task 3)
Pulls incremental data from TeleCRM RDS → upserts into Supabase raw_* tables.
Also regenerates public/live_data.json as a by-product.

Run:  python3 etl_supabase_sync.py
      python3 etl_supabase_sync.py --full   # ignore last_sync_at, repull everything
"""
import sys
import json
import math
import argparse
from datetime import date, datetime, timedelta, timezone
from collections import defaultdict

import os
import pathlib
import re
import psycopg2
import httpx

# ── Load .env.local (no external dependency needed) ───────────────────────────
def _load_dotenv():
    env_file = pathlib.Path(__file__).parent / ".env.local"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        m = re.match(r'^([A-Z0-9_]+)\s*=\s*(.+)$', line)
        if m:
            os.environ.setdefault(m.group(1), m.group(2).strip('"\''))

_load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
def _require(key):
    v = os.environ.get(key)
    if not v:
        raise RuntimeError(f"Missing required env var: {key}  (add it to .env.local)")
    return v

TELECRM = dict(
    host=_require("TELECRM_DB_HOST"),
    port=int(os.environ.get("TELECRM_DB_PORT", "5432")),
    dbname=_require("TELECRM_DB_NAME"),
    user=_require("TELECRM_DB_USER"),
    password=_require("TELECRM_DB_PASS"),
    connect_timeout=20,
)
SUPABASE_URL = _require("SUPABASE_URL")
SERVICE_KEY  = _require("SUPABASE_SERVICE_ROLE_KEY")
SUPABASE_H   = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",
}

BATCH_SIZE = 500   # rows per API call

# ── Quarter ───────────────────────────────────────────────────────────────────
Q1_START = date(2026, 1, 1)
Q1_END   = date(2026, 3, 31)
IST      = timezone(timedelta(hours=5, minutes=30))

def ist_to_utc(dt):
    """Convert naive IST datetime to UTC-aware datetime."""
    if dt is None:
        return None
    return dt.replace(tzinfo=IST).astimezone(timezone.utc).isoformat()

def week_num(d):
    if isinstance(d, datetime):
        d = d.date()
    if d is None:
        return None
    n = (d - Q1_START).days // 7 + 1
    return n if 1 <= n <= 13 else None

def week_label(n):
    return f"Wk {n}"

def safe_float(val):
    """Cast VARCHAR money/numeric field; return None on empty/non-numeric."""
    if val is None:
        return None
    try:
        v = float(str(val).strip().replace(",", ""))
        return None if math.isnan(v) or math.isinf(v) else v
    except (ValueError, TypeError):
        return None

def safe_int(val):
    f = safe_float(val)
    return None if f is None else int(f)

# ── Team structure ─────────────────────────────────────────────────────────────
TEAMS = {
    "edwin": {
        "email": "edwin.rajappan@coxandkings.com",
        "members": [
            "edwin.rajappan@coxandkings.com", "ashish.nigam@coxandkings.com",
            "astik.dubey@coxandkings.com",    "hemant.singh@coxandkings.com",
            "hushendra.kajania@coxandkings.com", "kavita.kumari@coxandkings.com",
            "mohd.hamza@coxandkings.com",     "rahul.menaria@coxandkings.com",
            "rahul.rai@coxandkings.com",      "riya.tyagi@coxandkings.com",
            "sumit.kumar@coxandkings.com",    "syed.shah@coxandkings.com",
            "tejal.choudhary@coxandkings.com", "vaishali.singh@coxandkings.com",
        ],
    },
    "adarsh": {
        "email": "adarsh.raheja@coxandkings.com",
        "members": [
            "adarsh.raheja@coxandkings.com",  "amit.barik@coxandkings.com",
            "santosh.rai@coxandkings.com",    "soni.singh@coxandkings.com",
            "pratik.gupta@coxandkings.com",   "anand.narayan@coxandkings.com",
            "ashamp.kumar@coxandkings.com",   "damanpreet.kaur@coxandkings.com",
            "dheeraj.sharma@coxandkings.com", "faizan.khan@coxandkings.com",
            "puneet.upadhyay@coxandkings.com", "zaid.jahangir@coxandkings.com",
        ],
    },
    "ashok": {
        "email": "ashok.pednekar@coxandkings.com",
        "members": [
            "ashok.pednekar@coxandkings.com", "aditya.singh@coxandkings.com",
            "amruta.thakur@coxandkings.com",  "bharat.dubey@coxandkings.com",
            "bharat.mali@coxandkings.com",    "chandani.yede@coxandkings.com",
            "harshil.desai@coxandkings.com",  "juned.khan@coxandkings.com",
            "princy.kunjumon@coxandkings.com", "rakesh.dornala@coxandkings.com",
            "rohit.kumar@coxandkings.com",    "shakil.khan@coxandkings.com",
            "shaktisinh.jadeja@coxandkings.com", "yogita.saxena@coxandkings.com",
            "aditya.sathe@coxandkings.com",
        ],
    },
}

EMAIL_TO_MANAGER = {}
ALL_TEAM_EMAILS  = []
MEMBER_NAMES     = {}   # email → display name (from TELECRM teams table if available)

# Build from TEAMS dict as fallback names
_NAME_FROM_EMAIL = {
    "edwin.rajappan@coxandkings.com":    "Edwin Ravi Rajappan",
    "ashish.nigam@coxandkings.com":      "Ashish Nigam",
    "astik.dubey@coxandkings.com":       "Astik Dubey",
    "hemant.singh@coxandkings.com":      "Hemant Singh",
    "hushendra.kajania@coxandkings.com": "Hushendra Kajania",
    "kavita.kumari@coxandkings.com":     "Kavita Kumari",
    "mohd.hamza@coxandkings.com":        "Mohd Hamza",
    "rahul.menaria@coxandkings.com":     "Rahul Menaria",
    "rahul.rai@coxandkings.com":         "Rahul Rai",
    "riya.tyagi@coxandkings.com":        "Riya Tyagi",
    "sumit.kumar@coxandkings.com":       "Sumit Kumar",
    "syed.shah@coxandkings.com":         "Syed Wali Ahmad Shah",
    "tejal.choudhary@coxandkings.com":   "Tejal Choudhary",
    "vaishali.singh@coxandkings.com":    "Vaishali Singh",
    "adarsh.raheja@coxandkings.com":     "Adarsh Raheja",
    "amit.barik@coxandkings.com":        "Amit Barik",
    "santosh.rai@coxandkings.com":       "Santosh Kumar Rai",
    "soni.singh@coxandkings.com":        "Soni Singh",
    "pratik.gupta@coxandkings.com":      "Pratik Gupta",
    "anand.narayan@coxandkings.com":     "Anand Narayan",
    "ashamp.kumar@coxandkings.com":      "Ashamp Kumar",
    "damanpreet.kaur@coxandkings.com":   "Damanpreet Kaur",
    "dheeraj.sharma@coxandkings.com":    "Dheeraj Sharma",
    "faizan.khan@coxandkings.com":       "Faizan Khan",
    "puneet.upadhyay@coxandkings.com":   "Puneet Upadhyay",
    "zaid.jahangir@coxandkings.com":     "Zaid Bin Jahangir",
    "ashok.pednekar@coxandkings.com":    "Ashok Padnekar",
    "aditya.singh@coxandkings.com":      "Aditya Singh FRN",
    "amruta.thakur@coxandkings.com":     "Amruta Thakur FRN",
    "bharat.dubey@coxandkings.com":      "Bharat Dubey FRN",
    "bharat.mali@coxandkings.com":       "Bharat Mali FRN",
    "chandani.yede@coxandkings.com":     "Chandani Yede FRN",
    "harshil.desai@coxandkings.com":     "Harshil Desai FRN",
    "juned.khan@coxandkings.com":        "Juned Khan FRN",
    "princy.kunjumon@coxandkings.com":   "Princy FRN",
    "rakesh.dornala@coxandkings.com":    "Rakesh Dornala FRN",
    "rohit.kumar@coxandkings.com":       "Rohit Kumar FRN",
    "shakil.khan@coxandkings.com":       "Shakil Khan FRN",
    "shaktisinh.jadeja@coxandkings.com": "Shaktisinh Jadeja FRN",
    "yogita.saxena@coxandkings.com":     "Yogita FRN",
    "aditya.sathe@coxandkings.com":      "Aditya Sathe FRN",
}

for mgr, info in TEAMS.items():
    for em in info["members"]:
        EMAIL_TO_MANAGER[em.lower()] = mgr
        ALL_TEAM_EMAILS.append(em)

QUALIFIED_STAGES = {
    'changes required', 'customer quote reviewing', 'first payment done',
    'initial deposit', 'negotiation', 'negotiation stage',
    'post quote | indiscussion | fu 1', 'post quote | indiscussion | fu 2',
    'post quote | indiscussion | fu 3', 'post quote | indiscussion | fu 4',
    'post quote | no response 1', 'post quote | no response 2',
    'post quote | no response 3', 'post quote | no response 4',
    'qualified', 'qualified | fit', 'qualified | git',
    'quote explained', 'quote sent', 'revised quote sent',
}

def is_qualified(status):
    return (status or "").lower().strip() in QUALIFIED_STAGES

def is_won(status):
    return (status or "").lower().strip() == 'first payment done'


# ── SLA deadline ───────────────────────────────────────────────────────────────
def sla_deadline(created_on):
    if created_on is None:
        return None
    dt = created_on  # naive IST
    hour, dow = dt.hour, dt.weekday()  # 0=Mon, 6=Sun

    if dow == 6:
        sla_start = dt.replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=1)
    elif hour < 10:
        sla_start = dt.replace(hour=10, minute=0, second=0, microsecond=0)
    elif hour >= 20:
        sla_start = dt.replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(
            days=2 if dow == 5 else 1
        )
    else:
        sla_start = dt

    return sla_start + timedelta(minutes=60)


# ── Supabase helpers ───────────────────────────────────────────────────────────
def get_last_sync(client, table_name, full_refresh=False):
    if full_refresh:
        return datetime(1970, 1, 1)
    r = client.get(
        f"{SUPABASE_URL}/rest/v1/etl_sync_log",
        params={"table_name": f"eq.{table_name}", "select": "last_sync_at", "limit": "1"},
        headers=SUPABASE_H,
    )
    if r.status_code == 200 and r.json():
        ts = r.json()[0].get("last_sync_at", "1970-01-01T00:00:00Z")
        # Normalize fractional seconds to 6 digits (Python fromisoformat is strict)
        ts = re.sub(r'\.(\d{1,6})\d*', lambda m: '.' + m.group(1).ljust(6, '0'), ts)
        return datetime.fromisoformat(ts.replace("Z", "+00:00")).astimezone(IST).replace(tzinfo=None)
    return datetime(1970, 1, 1)


def update_sync_log(client, table_name, rows_upserted, error_msg=None):
    payload = {
        "table_name": table_name,
        "last_sync_at": datetime.now(timezone.utc).isoformat(),
        "rows_upserted": rows_upserted,
        "error_msg": error_msg,
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    r = client.post(
        f"{SUPABASE_URL}/rest/v1/etl_sync_log?on_conflict=table_name",
        headers=SUPABASE_H,
        content=json.dumps(payload),
    )
    if r.status_code not in (200, 201):
        print(f"  Warning: could not update sync log for {table_name}: {r.status_code} {r.text[:200]}")


def upsert_batch(client, table, rows, conflict_col):
    if not rows:
        return 0
    total = 0
    for i in range(0, len(rows), BATCH_SIZE):
        batch = rows[i : i + BATCH_SIZE]
        r = client.post(
            f"{SUPABASE_URL}/rest/v1/{table}?on_conflict={conflict_col}",
            headers=SUPABASE_H,
            content=json.dumps(batch),
        )
        if r.status_code not in (200, 201):
            print(f"  ERROR upserting {table} batch {i//BATCH_SIZE+1}: {r.status_code} {r.text[:300]}")
            sys.exit(1)
        total += len(batch)
        print(f"  {table}: {total}/{len(rows)} rows upserted", end="\r")
    print()
    return total


# ── TeleCRM Pull: Leads ────────────────────────────────────────────────────────
def pull_leads(cur, since_ist):
    """Fetch ALL leads updated since `since_ist` (naive IST datetime)."""
    cur.execute("""
        SELECT
            TRIM(leadid)                              AS telecrm_id,
            created_on,
            updated_on,
            COALESCE(is_deleted, false)               AS is_deleted,
            LOWER(TRIM(assignee))                     AS assignee_email,
            TRIM(text_name)                           AS name,
            TRIM(phone_phone)                         AS phone,
            TRIM(phone_alternate_phone)               AS alternate_phone,
            TRIM(email_email)                         AS email,
            TRIM(dropdown_lead_source)                AS lead_source,
            list_name,
            TRIM(status)                              AS status,
            TRIM(rating)                              AS rating_raw,
            TRIM(lost_reason)                         AS lost_reason,
            TRIM(dropdown_travel_destination)         AS travel_destination,
            TRIM(text_travel_destination_name)        AS travel_destination_name,
            date_travel_date,
            number_number_of_travelers_adults         AS travelers_adults,
            number_number_of_travelers_child_with_beds AS travelers_child_beds,
            number_number_of_travelers_child_no_bed   AS travelers_child_nobed,
            number_number_of_travelers_infants         AS travelers_infants,
            money_approximate_budget                  AS budget_raw,
            TRIM(text_package_name)                   AS package_name,
            TRIM(dropdown_who_are_you_planning_to_travel_with) AS who_travelling_with,
            TRIM(dropdown_when_would_you_like_to_travel) AS when_to_travel,
            TRIM(dropdown_when_would_you_like_to_book)   AS when_to_book,
            TRIM(dropdown_buyer_type)                 AS buyer_type,
            TRIM(dropdown_flights_booked)             AS flights_booked,
            TRIM(dropdown_visa_status)                AS visa_status,
            TRIM(text_utm_source)                     AS utm_source,
            TRIM(text_utm_medium)                     AS utm_medium,
            TRIM(text_utm_campaign)                   AS utm_campaign,
            TRIM(text_utm_term)                       AS utm_term,
            TRIM(text_utm_content)                    AS utm_content,
            TRIM(text_gclid)                          AS gclid,
            TRIM(text_fbclid)                         AS fbclid,
            TRIM(text_facebook_ad)                    AS facebook_ad,
            TRIM(text_facebook_ad_name)               AS facebook_ad_name,
            TRIM(text_facebook_campaign)              AS facebook_campaign,
            TRIM(text_facebook_lead_id)               AS facebook_lead_id,
            TRIM(text_facebook_ad_set_id)             AS facebook_ad_set_id,
            TRIM(text_facebook_ad_set_name)           AS facebook_ad_set_name,
            money_expected_margin                     AS expected_margin_raw,
            money_margin                              AS margin_raw,
            money_advanced_received                   AS advanced_received_raw,
            date_expected_closure_date                AS expected_closure_date,
            date_first_call_date_and_time             AS first_call_date,
            CASE WHEN number_first_call_duration = -1 THEN NULL
                 ELSE number_first_call_duration::INT END AS first_call_dur,
            date_next_follow_up_date                  AS next_follow_up_date,
            date_recapture_date                       AS recapture_date,
            number_recapture_count                    AS recapture_count,
            TRIM(dropdown_skill_map_group)            AS skill_map_group,
            TRIM(dropdown_lead_distributiontype)      AS lead_distribution_type
        FROM leads
        WHERE COALESCE(is_deleted, false) = false
          AND (created_on >= %s OR updated_on >= %s)
        ORDER BY created_on
    """, (since_ist, since_ist))
    return cur.fetchall()


def build_lead_rows(rows):
    out = []
    for r in rows:
        (telecrm_id, created_on, updated_on, is_deleted, assignee_email,
         name, phone, alt_phone, email, lead_source, list_name, status, rating_raw,
         lost_reason, travel_dest, travel_dest_name, travel_date,
         travelers_adults, travelers_child_beds, travelers_child_nobed, travelers_infants,
         budget_raw, package_name, who_travelling, when_travel, when_book,
         buyer_type, flights_booked, visa_status,
         utm_source, utm_medium, utm_campaign, utm_term, utm_content,
         gclid, fbclid, fb_ad, fb_ad_name, fb_campaign, fb_lead_id, fb_ad_set_id, fb_ad_set_name,
         expected_margin_raw, margin_raw, advanced_received_raw, expected_closure_date,
         first_call_date, first_call_dur,
         next_follow_up_date, recapture_date, recapture_count,
         skill_map_group, lead_dist_type) = r

        row = {
            "telecrm_id":                    telecrm_id,
            "created_on":                    ist_to_utc(created_on),
            "updated_on":                    ist_to_utc(updated_on),
            "is_deleted":                    bool(is_deleted),
            "assignee":                      _NAME_FROM_EMAIL.get(assignee_email or ""),
            "assignee_email":                assignee_email,
            "name":                          name or None,
            "phone":                         phone or None,
            "alternate_phone":               alt_phone or None,
            "email":                         email or None,
            "lead_source":                   lead_source or None,
            "list_names":                    list(list_name) if list_name else [],
            "status":                        status or None,
            "rating":                        safe_float(rating_raw),
            "lost_reason":                   lost_reason or None,
            "travel_destination":            travel_dest or None,
            "travel_destination_name":       travel_dest_name or None,
            "travel_date":                   ist_to_utc(travel_date),
            "number_of_travelers_adults":    safe_int(travelers_adults),
            "number_of_travelers_child_beds": safe_int(travelers_child_beds),
            "number_of_travelers_child_nobed": safe_int(travelers_child_nobed),
            "number_of_travelers_infants":   safe_int(travelers_infants),
            "approximate_budget":            safe_float(budget_raw),
            "package_name":                  package_name or None,
            "who_travelling_with":           who_travelling or None,
            "when_to_travel":                when_travel or None,
            "when_to_book":                  when_book or None,
            "buyer_type":                    buyer_type or None,
            "flights_booked":                flights_booked or None,
            "visa_status":                   visa_status or None,
            "utm_source":                    utm_source or None,
            "utm_medium":                    utm_medium or None,
            "utm_campaign":                  utm_campaign or None,
            "utm_term":                      utm_term or None,
            "utm_content":                   utm_content or None,
            "gclid":                         gclid or None,
            "fbclid":                        fbclid or None,
            "facebook_ad":                   fb_ad or None,
            "facebook_ad_name":              fb_ad_name or None,
            "facebook_campaign":             fb_campaign or None,
            "facebook_lead_id":              fb_lead_id or None,
            "facebook_ad_set_id":            fb_ad_set_id or None,
            "facebook_ad_set_name":          fb_ad_set_name or None,
            "expected_margin":               safe_float(expected_margin_raw),
            "margin":                        safe_float(margin_raw),
            "advanced_received":             safe_float(advanced_received_raw),
            "expected_closure_date":         ist_to_utc(expected_closure_date),
            "first_call_date":               ist_to_utc(first_call_date),
            "first_call_duration_seconds":   first_call_dur,
            "next_follow_up_date":           ist_to_utc(next_follow_up_date),
            "recapture_date":                ist_to_utc(recapture_date),
            "recapture_count":               safe_int(recapture_count) or 0,
            "skill_map_group":               skill_map_group or None,
            "lead_distribution_type":        lead_dist_type or None,
        }
        out.append(row)
    return out


# ── TeleCRM Pull: Call Logs ────────────────────────────────────────────────────
def pull_call_logs(cur, lead_ids, since_ist):
    if not lead_ids:
        return []
    cur.execute("""
        SELECT
            TRIM(actionid)           AS telecrm_call_id,
            TRIM(leadid)             AS lead_telecrm_id,
            LOWER(TRIM(teammember_email)) AS agent_email,
            TRIM(type)               AS call_direction_raw,
            TRIM(status)             AS call_status_raw,
            CASE WHEN duration = -1 THEN 0
                 ELSE duration::INT END AS duration_seconds,
            created_on
        FROM action_callerdesk
        WHERE TRIM(leadid) = ANY(%s::text[])
          AND created_on >= %s
    """, (lead_ids, since_ist))
    return cur.fetchall()


def build_call_rows(rows):
    out = []
    for r in rows:
        (telecrm_call_id, lead_telecrm_id, agent_email,
         call_direction_raw, call_status_raw, duration_seconds, created_on) = r

        # Normalize status: TeleCRM 'ANSWER' → 'connected', rest → 'not_connected'
        call_status = "connected" if call_status_raw == "ANSWER" else "not_connected"

        # Normalize direction
        direction = None
        if call_direction_raw:
            d = call_direction_raw.lower()
            if "inbound" in d:
                direction = "inbound"
            elif "outbound" in d:
                direction = "outbound"

        out.append({
            "telecrm_call_id":  telecrm_call_id,
            "lead_telecrm_id":  lead_telecrm_id,
            "agent_email":      agent_email or None,
            "agent_name":       _NAME_FROM_EMAIL.get(agent_email or ""),
            "call_direction":   direction,
            "call_status":      call_status,
            "duration_seconds": duration_seconds,
            "call_started_at":  ist_to_utc(created_on),
        })
    return out


# ── TeleCRM Pull: Tasks ────────────────────────────────────────────────────────
def pull_tasks(cur, since_ist, known_lead_ids=None):
    """
    known_lead_ids: set of lead IDs already in raw_leads.
    Tasks referencing leads outside this set get lead_telecrm_id=NULL
    to avoid FK violation (those tasks still count for SLA via assignee_email).
    """
    emails_lower = [e.lower() for e in ALL_TEAM_EMAILS]
    cur.execute("""
        SELECT
            TRIM(task_id)               AS telecrm_task_id,
            TRIM(leadid)                AS lead_telecrm_id,
            LOWER(TRIM(assignee))       AS assignee_email,
            deadline,
            updated_on,
            TRIM(status)                AS status_raw
        FROM call_followup
        WHERE LOWER(TRIM(assignee)) = ANY(%s::text[])
          AND (created_on >= %s OR updated_on >= %s)
          AND deadline IS NOT NULL
    """, (emails_lower, since_ist, since_ist))
    rows = cur.fetchall()
    # Null-out any lead_telecrm_id not present in raw_leads to avoid FK errors
    if known_lead_ids:
        rows = [
            (tid, (lid if lid in known_lead_ids else None), ae, dl, uo, st)
            for (tid, lid, ae, dl, uo, st) in rows
        ]
    return rows


def build_task_rows(rows):
    out = []
    for r in rows:
        (telecrm_task_id, lead_telecrm_id, assignee_email,
         deadline, updated_on, status_raw) = r

        # Normalize status
        if status_raw == "Done":
            # Completed on time — completed_at = deadline (treat deadline as completion when Done)
            # We store completed_at = updated_on (when it was marked Done)
            status_norm = "completed"
            completed_at = ist_to_utc(updated_on) if updated_on else None
        elif status_raw == "Late":
            status_norm = "completed"
            # Late = done after deadline; mark completed_at as deadline+1s so generated col = false
            completed_at = ist_to_utc(deadline + timedelta(seconds=1)) if deadline else None
        elif status_raw == "Cancelled":
            status_norm = "cancelled"
            completed_at = None
        else:
            status_norm = "pending"
            completed_at = None

        out.append({
            "telecrm_task_id": telecrm_task_id,
            "lead_telecrm_id": lead_telecrm_id,
            "assignee_email":  assignee_email or None,
            "assignee_name":   _NAME_FROM_EMAIL.get(assignee_email or ""),
            "task_type":       "call",
            "due_at":          ist_to_utc(deadline),
            "completed_at":    completed_at,
            "status":          status_norm,
        })
    return out


# ── Metrics computation (mirrors etl_compute_metrics.py) ─────────────────────
def compute_metrics_from_supabase(client):
    """
    Re-read raw data from Supabase views and produce the live_data.json structure.
    Falls back to direct TeleCRM query if views aren't ready.
    """
    # Try fetching from v_scorecard_full (Supabase view)
    r = client.get(
        f"{SUPABASE_URL}/rest/v1/v_scorecard_full?select=*&limit=10000",
        headers={**SUPABASE_H, "Prefer": ""},
    )
    if r.status_code == 200:
        return _transform_scorecard_view(r.json())
    # View not ready yet — compute from raw tables directly
    return None


def _transform_scorecard_view(rows):
    """Transform v_scorecard_full rows → dashboard data dict."""
    out = {"edwin": {}, "adarsh": {}, "ashok": {}, "deeksha": {}, "total_sales": {}}
    for row in rows:
        section = row.get("section_id")
        wn = row.get("week_number")
        if not section or not wn:
            continue
        wk = week_label(wn)
        if section not in out:
            out[section] = {}
        metrics = {k: v for k, v in row.items()
                   if k not in ("section_id", "week_number", "quarter_id", "section_label")}
        out[section][wk] = metrics
    return out


def compute_metrics_direct(conn):
    """Compute metrics directly from TeleCRM (same as etl_compute_metrics.py)."""
    from collections import defaultdict

    cur = conn.cursor()
    emails_lower = [e.lower() for e in ALL_TEAM_EMAILS]

    # Leads for Q1
    cur.execute("""
        SELECT
            TRIM(leadid), created_on, LOWER(TRIM(assignee)) AS assignee_email, status,
            date_first_call_date_and_time,
            CASE WHEN number_first_call_duration = -1 THEN NULL
                 ELSE number_first_call_duration::INT END AS first_call_dur
        FROM leads
        WHERE created_on::date BETWEEN %s AND %s
          AND LOWER(TRIM(assignee)) = ANY(%s::text[])
          AND COALESCE(is_deleted, false) = false
        ORDER BY created_on
    """, (Q1_START, Q1_END, emails_lower))
    leads = cur.fetchall()

    lead_ids = [r[0] for r in leads]
    lead_map = {r[0]: {"created_on": r[1], "assignee_email": r[2], "status": r[3],
                        "first_call_date": r[4], "first_call_dur": r[5]} for r in leads}

    # Connected calls
    connected_leads = set()
    if lead_ids:
        cur.execute("""
            SELECT DISTINCT TRIM(leadid) FROM action_callerdesk
            WHERE TRIM(leadid) = ANY(%s::text[]) AND status = 'ANSWER' AND duration >= 60
        """, (lead_ids,))
        connected_leads = {r[0] for r in cur.fetchall()}

    # Tasks
    task_sla = defaultdict(lambda: {"total": 0, "on_time": 0})
    cur.execute("""
        SELECT LOWER(TRIM(assignee)), deadline, status FROM call_followup
        WHERE LOWER(TRIM(assignee)) = ANY(%s::text[])
          AND deadline::date BETWEEN %s AND %s
          AND status != 'Cancelled'
    """, (emails_lower, Q1_START, Q1_END))
    for row in cur.fetchall():
        agent_email, deadline, status = row
        if deadline is None:
            continue
        wn = week_num(deadline)
        if wn is None:
            continue
        mgr = EMAIL_TO_MANAGER.get(agent_email)
        if mgr is None:
            continue
        key = (mgr, wn)
        task_sla[key]["total"] += 1
        if status == "Done":
            task_sla[key]["on_time"] += 1

    # Ad spend from Supabase
    spend_by_week = defaultdict(float)
    for table in ["facebook_ads", "google_ads"]:
        r = client_global.get(
            f"{SUPABASE_URL}/rest/v1/{table}?select=date,spend&limit=10000",
            headers={**SUPABASE_H, "Prefer": ""},
        )
        if r.status_code == 200:
            for row in r.json():
                d = date.fromisoformat(row["date"])
                wn = week_num(d)
                if wn and row.get("spend"):
                    spend_by_week[wn] += float(row["spend"]) * 1.18

    # Compute
    mgr_week = {mgr: defaultdict(lambda: {"total": 0, "sla_ok": 0, "connected": 0,
                                           "qualified": 0, "won": 0})
                for mgr in TEAMS}
    mkt_week = defaultdict(lambda: {"total": 0, "qualified": 0})

    for lid, lead in lead_map.items():
        created_on = lead["created_on"]
        wn = week_num(created_on)
        if wn is None:
            continue
        ae = lead["assignee_email"]
        mgr = EMAIL_TO_MANAGER.get(ae)
        if mgr is None:
            continue

        w = mgr_week[mgr][wn]
        w["total"] += 1
        fc = lead["first_call_date"]
        if fc is not None:
            deadline = sla_deadline(created_on)
            if deadline and fc <= deadline:
                w["sla_ok"] += 1
        if lid in connected_leads:
            w["connected"] += 1
        if is_qualified(lead["status"]):
            w["qualified"] += 1
        if is_won(lead["status"]):
            w["won"] += 1

        mkt_week[wn]["total"] += 1
        if is_qualified(lead["status"]):
            mkt_week[wn]["qualified"] += 1

    def pct(num, denom):
        if not denom:
            return None
        v = round(num * 100.0 / denom, 1)
        return None if math.isnan(v) else v

    out = {}
    total_by_week = defaultdict(lambda: {"total": 0, "sla_ok": 0, "connected": 0,
                                          "qualified": 0, "won": 0})

    for mgr in ["edwin", "adarsh", "ashok"]:
        out[mgr] = {}
        for wn in range(1, 14):
            w = mgr_week[mgr].get(wn)
            if not w or w["total"] == 0:
                continue
            ts = task_sla.get((mgr, wn), {"total": 0, "on_time": 0})
            out[mgr][week_label(wn)] = {
                "total_leads":       w["total"],
                "pct_contacted_sla": pct(w["sla_ok"], w["total"]),
                "pct_connected":     pct(w["connected"], w["total"]),
                "pct_quote_sent":    pct(w["qualified"], w["total"]),
                "conversion_pct":    pct(w["won"], w["total"]),
                "no_of_bookings":    w["won"],
                "pct_followups_sla": pct(ts["on_time"], ts["total"]),
            }
            for k in ("total", "sla_ok", "connected", "qualified", "won"):
                total_by_week[wn][k] += w[k]

    out["total_sales"] = {}
    for wn in range(1, 14):
        w = total_by_week.get(wn)
        if not w or w["total"] == 0:
            continue
        mgr_pcts = {"sla": [], "conn": [], "qual": [], "conv": [], "fu": []}
        for mgr in ["edwin", "adarsh", "ashok"]:
            mw = mgr_week[mgr].get(wn, {})
            mt = mw.get("total", 0)
            if mt:
                mgr_pcts["sla"].append(pct(mw["sla_ok"], mt) or 0)
                mgr_pcts["conn"].append(pct(mw["connected"], mt) or 0)
                mgr_pcts["qual"].append(pct(mw["qualified"], mt) or 0)
                mgr_pcts["conv"].append(pct(mw["won"], mt) or 0)
            ts = task_sla.get((mgr, wn), {"total": 0, "on_time": 0})
            if ts["total"]:
                mgr_pcts["fu"].append(pct(ts["on_time"], ts["total"]) or 0)

        def avg(lst): return round(sum(lst) / len(lst), 1) if lst else None

        out["total_sales"][week_label(wn)] = {
            "total_leads":       w["total"],
            "pct_contacted_sla": avg(mgr_pcts["sla"]),
            "pct_connected":     avg(mgr_pcts["conn"]),
            "pct_quote_sent":    avg(mgr_pcts["qual"]),
            "conversion_pct":    avg(mgr_pcts["conv"]),
            "no_of_bookings":    w["won"],
            "pct_followups_sla": avg(mgr_pcts["fu"]),
        }

    out["deeksha"] = {}
    for wn in range(1, 14):
        m = mkt_week.get(wn)
        if not m or m["total"] == 0:
            continue
        spend = spend_by_week.get(wn, 0)
        total = m["total"]
        qual  = m["qualified"]
        out["deeksha"][week_label(wn)] = {
            "total_leads":     total,
            "total_qualified": qual,
            "total_spend":     round(spend) if spend else None,
            "cpl":             round(spend / total) if spend and total else None,
            "cpql":            round(spend / qual)  if spend and qual  else None,
        }

    return out


# ── Main ───────────────────────────────────────────────────────────────────────
client_global = None  # module-level so compute_metrics_direct can access it

def main():
    global client_global
    parser = argparse.ArgumentParser()
    parser.add_argument("--full", action="store_true",
                        help="Full refresh — ignore last_sync_at, repull all Q1 data")
    parser.add_argument("--skip-json", action="store_true",
                        help="Skip regenerating public/live_data.json")
    args = parser.parse_args()

    print(f"{'FULL REFRESH' if args.full else 'Incremental sync'} starting...")

    client = httpx.Client(timeout=60)
    client_global = client

    # ── Check if Supabase schema is live ───────────────────────────────────────
    r = client.get(f"{SUPABASE_URL}/rest/v1/raw_leads?limit=1",
                   headers={**SUPABASE_H, "Prefer": ""})
    supabase_ready = r.status_code == 200
    if not supabase_ready:
        print(f"⚠  Supabase schema not detected (HTTP {r.status_code}).")
        print("   Run supabase_schema.sql in the SQL Editor first.")
        print("   Regenerating live_data.json only...\n")

    if supabase_ready:
        # ── Determine last sync timestamps ─────────────────────────────────────
        last_sync_leads = get_last_sync(client, "raw_leads", args.full)
        last_sync_calls = get_last_sync(client, "raw_call_logs", args.full)
        last_sync_tasks = get_last_sync(client, "raw_tasks", args.full)
        print(f"  Leads since:    {last_sync_leads}")
        print(f"  Calls since:    {last_sync_calls}")
        print(f"  Tasks since:    {last_sync_tasks}")

        # ── Connect to TeleCRM ─────────────────────────────────────────────────
        print("\nConnecting to TeleCRM RDS...")
        conn = psycopg2.connect(**TELECRM)
        cur  = conn.cursor()

        # ── LEADS ──────────────────────────────────────────────────────────────
        print("\n── Syncing raw_leads ──")
        lead_rows_raw = pull_leads(cur, last_sync_leads)
        print(f"  {len(lead_rows_raw)} leads fetched from TeleCRM")
        lead_rows = build_lead_rows(lead_rows_raw)
        n_leads = upsert_batch(client, "raw_leads", lead_rows, "telecrm_id")
        update_sync_log(client, "raw_leads", n_leads)
        print(f"  ✓ {n_leads} leads upserted")

        # Get all lead IDs in Supabase scope for call/task fetching
        all_lead_ids = [r["telecrm_id"] for r in lead_rows]
        # If incremental, also need existing lead IDs for call lookup
        # Just use Q1 leads from the fresh fetch
        if args.full or not all_lead_ids:
            # Fetch all Q1 lead IDs for call/task linking
            cur.execute("""
                SELECT TRIM(leadid) FROM leads
                WHERE created_on::date BETWEEN %s AND %s
                  AND LOWER(TRIM(assignee)) = ANY(%s::text[])
                  AND COALESCE(is_deleted, false) = false
            """, (Q1_START, Q1_END, [e.lower() for e in ALL_TEAM_EMAILS]))
            all_lead_ids = [r[0] for r in cur.fetchall()]

        # ── CALL LOGS ──────────────────────────────────────────────────────────
        print("\n── Syncing raw_call_logs ──")
        call_rows_raw = pull_call_logs(cur, all_lead_ids, last_sync_calls)
        print(f"  {len(call_rows_raw)} call log rows fetched")
        call_rows = build_call_rows(call_rows_raw)
        n_calls = upsert_batch(client, "raw_call_logs", call_rows, "telecrm_call_id")
        update_sync_log(client, "raw_call_logs", n_calls)
        print(f"  ✓ {n_calls} call logs upserted")

        # ── TASKS ──────────────────────────────────────────────────────────────
        print("\n── Syncing raw_tasks ──")
        known_lead_ids = set(all_lead_ids)
        task_rows_raw = pull_tasks(cur, last_sync_tasks, known_lead_ids)
        print(f"  {len(task_rows_raw)} tasks fetched")
        task_rows = build_task_rows(task_rows_raw)
        n_tasks = upsert_batch(client, "raw_tasks", task_rows, "telecrm_task_id")
        update_sync_log(client, "raw_tasks", n_tasks)
        print(f"  ✓ {n_tasks} tasks upserted")

        conn.close()

    # ── Regenerate live_data.json ──────────────────────────────────────────────
    if not args.skip_json:
        print("\n── Regenerating public/live_data.json ──")
        conn2 = psycopg2.connect(**TELECRM)
        metrics = compute_metrics_direct(conn2)
        conn2.close()

        out_path = "public/live_data.json"
        with open(out_path, "w") as f:
            json.dump({
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "quarter":      "Q1 FY2026",
                "data":         metrics,
            }, f, indent=2)
        print(f"  ✓ Wrote {out_path}")
        for mgr in ["edwin", "adarsh", "ashok", "deeksha", "total_sales"]:
            wks = list(metrics.get(mgr, {}).keys())
            print(f"    {mgr:<12}: {len(wks)} weeks — {wks}")

    print("\n✓ ETL sync complete.")


if __name__ == "__main__":
    main()

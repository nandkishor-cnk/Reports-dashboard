"""
Cox & Kings EOS Scorecard — ETL Metrics Computation
Pulls from TeleCRM RDS, computes weekly metrics, writes public/live_data.json
Run: python3 etl_compute_metrics.py
"""
import os
import pathlib
import re
import psycopg2
import httpx
import json
import math
from datetime import date, datetime, timedelta
from collections import defaultdict

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

# ── Config ────────────────────────────────────────────────────
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
SUPABASE_H   = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}"}

# ── Quarter definition ────────────────────────────────────────
Q1_START = date(2026, 1, 1)
Q1_END   = date(2026, 3, 31)

def week_num(d):
    """Return 1–13 week number for Q1 FY2026, or None if outside."""
    if isinstance(d, datetime):
        d = d.date()
    if d is None:
        return None
    n = (d - Q1_START).days // 7 + 1
    return n if 1 <= n <= 13 else None

def week_label(n):
    return f"Wk {n}"

# ── Team structure ────────────────────────────────────────────
TEAMS = {
    "edwin": {
        "email": "edwin.rajappan@coxandkings.com",
        "members": [
            "edwin.rajappan@coxandkings.com",
            "ashish.nigam@coxandkings.com",
            "astik.dubey@coxandkings.com",
            "hemant.singh@coxandkings.com",
            "hushendra.kajania@coxandkings.com",
            "kavita.kumari@coxandkings.com",
            "mohd.hamza@coxandkings.com",
            "rahul.menaria@coxandkings.com",
            "rahul.rai@coxandkings.com",
            "riya.tyagi@coxandkings.com",
            "sumit.kumar@coxandkings.com",
            "syed.shah@coxandkings.com",
            "tejal.choudhary@coxandkings.com",
            "vaishali.singh@coxandkings.com",
        ]
    },
    "adarsh": {
        "email": "adarsh.raheja@coxandkings.com",
        "members": [
            "adarsh.raheja@coxandkings.com",
            "amit.barik@coxandkings.com",
            "santosh.rai@coxandkings.com",
            "soni.singh@coxandkings.com",
            "pratik.gupta@coxandkings.com",
            "anand.narayan@coxandkings.com",
            "ashamp.kumar@coxandkings.com",
            "damanpreet.kaur@coxandkings.com",
            "dheeraj.sharma@coxandkings.com",
            "faizan.khan@coxandkings.com",
            "puneet.upadhyay@coxandkings.com",
            "zaid.jahangir@coxandkings.com",
        ]
    },
    "ashok": {
        "email": "ashok.pednekar@coxandkings.com",
        "members": [
            "ashok.pednekar@coxandkings.com",
            "aditya.singh@coxandkings.com",
            "amruta.thakur@coxandkings.com",
            "bharat.dubey@coxandkings.com",
            "bharat.mali@coxandkings.com",
            "chandani.yede@coxandkings.com",
            "harshil.desai@coxandkings.com",
            "juned.khan@coxandkings.com",
            "princy.kunjumon@coxandkings.com",
            "rakesh.dornala@coxandkings.com",
            "rohit.kumar@coxandkings.com",
            "shakil.khan@coxandkings.com",
            "shaktisinh.jadeja@coxandkings.com",
            "yogita.saxena@coxandkings.com",
            "aditya.sathe@coxandkings.com",
        ]
    },
}

# Build reverse map: email → manager
EMAIL_TO_MANAGER = {}
ALL_TEAM_EMAILS  = []
for mgr, info in TEAMS.items():
    for em in info["members"]:
        EMAIL_TO_MANAGER[em.lower()] = mgr
        ALL_TEAM_EMAILS.append(em)

# ── Qualified stages ──────────────────────────────────────────
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

# ── SLA deadline (TeleCRM timestamps assumed IST) ─────────────
IST_OFFSET = timedelta(hours=5, minutes=30)

def sla_deadline(created_on):
    """60-min business-hours SLA. created_on is a naive datetime (IST)."""
    if created_on is None:
        return None
    dt = created_on  # treated as IST
    hour = dt.hour
    dow  = dt.weekday()  # 0=Mon, 6=Sun

    if dow == 6:  # Sunday → next Monday 10:00
        sla_start = dt.replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=1)
    elif hour < 10:
        sla_start = dt.replace(hour=10, minute=0, second=0, microsecond=0)
    elif hour >= 20:
        if dow == 5:  # Saturday → Monday
            sla_start = dt.replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=2)
        else:
            sla_start = dt.replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=1)
    else:
        sla_start = dt

    return sla_start + timedelta(minutes=60)

# ── Pull TeleCRM data ────────────────────────────────────────
def fetch_telecrm():
    print("Connecting to TeleCRM RDS...")
    conn = psycopg2.connect(**TELECRM)
    cur  = conn.cursor()

    placeholders = ",".join(["%s"] * len(ALL_TEAM_EMAILS))

    # 1. Leads for Q1 FY2026
    print("  Fetching leads...")
    cur.execute(f"""
        SELECT
            leadid,
            created_on,
            assignee,
            status,
            date_first_call_date_and_time,
            CASE WHEN number_first_call_duration = -1 THEN NULL
                 ELSE number_first_call_duration::INT END AS first_call_dur
        FROM leads
        WHERE created_on::date BETWEEN %s AND %s
          AND LOWER(assignee) = ANY(%s::text[])
          AND COALESCE(is_deleted, false) = false
        ORDER BY created_on
    """, (Q1_START, Q1_END, [e.lower() for e in ALL_TEAM_EMAILS]))
    leads = cur.fetchall()
    print(f"  {len(leads)} leads in Q1 FY2026 for all teams")

    lead_ids = [r[0].strip() for r in leads]
    lead_map  = {}  # leadid → row
    for r in leads:
        lid = r[0].strip()
        lead_map[lid] = {
            "created_on":      r[1],
            "assignee_email":  (r[2] or "").lower().strip(),
            "status":          r[3],
            "first_call_date": r[4],
            "first_call_dur":  r[5],
        }

    # 2. Call logs — connected calls per lead
    print("  Fetching call logs...")
    connected_leads = set()
    if lead_ids:
        placeholders2 = ",".join(["%s"] * len(lead_ids))
        cur.execute(f"""
            SELECT DISTINCT TRIM(leadid)
            FROM action_callerdesk
            WHERE TRIM(leadid) = ANY(%s::text[])
              AND status = 'ANSWER'
              AND duration >= 60
        """, ([lid for lid in lead_ids],))
        connected_leads = {r[0] for r in cur.fetchall()}
    print(f"  {len(connected_leads)} leads with meaningful connects (60s+)")

    # 3. Tasks — follow-up SLA per agent per week
    print("  Fetching tasks...")
    task_sla = defaultdict(lambda: {"total": 0, "on_time": 0})
    if ALL_TEAM_EMAILS:
        cur.execute(f"""
            SELECT
                LOWER(assignee),
                deadline,
                status
            FROM call_followup
            WHERE LOWER(assignee) = ANY(%s::text[])
              AND deadline::date BETWEEN %s AND %s
              AND status != 'Cancelled'
        """, ([e.lower() for e in ALL_TEAM_EMAILS], Q1_START, Q1_END))
        for row in cur.fetchall():
            agent_email, deadline, status = row[0], row[1], row[2]
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
            if status == "Done":  # Done=on time; Late=overdue
                task_sla[key]["on_time"] += 1
    print(f"  {sum(v['total'] for v in task_sla.values())} tasks across all managers")

    conn.close()
    return lead_map, connected_leads, task_sla

# ── Pull ad spend from Supabase ──────────────────────────────
def fetch_ad_spend():
    print("Fetching ad spend from Supabase...")
    spend_by_week = defaultdict(float)  # week_num → spend_with_gst

    for table in ["facebook_ads", "google_ads"]:
        r = httpx.get(
            f"{SUPABASE_URL}/rest/v1/{table}?select=date,spend&limit=10000",
            headers=SUPABASE_H, timeout=30
        )
        if r.status_code != 200:
            print(f"  Warning: {table} not accessible ({r.status_code})")
            continue
        rows = r.json()
        for row in rows:
            d = date.fromisoformat(row["date"])
            wn = week_num(d)
            if wn and row.get("spend"):
                spend_by_week[wn] += float(row["spend"]) * 1.18  # add 18% GST

    print(f"  Spend found for weeks: {sorted(spend_by_week.keys())}")
    return spend_by_week

# ── Compute metrics ──────────────────────────────────────────
def compute_metrics(lead_map, connected_leads, task_sla, spend_by_week):
    print("Computing metrics...")

    # Per manager, per week: accumulate lead-level stats
    # Structure: mgr_week[manager][week] = {counters}
    mgr_week = {
        mgr: defaultdict(lambda: {
            "total": 0, "sla_ok": 0, "connected": 0,
            "qualified": 0, "won": 0,
        })
        for mgr in TEAMS
    }
    # Marketing: all leads
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

        # SLA check
        fc = lead["first_call_date"]
        if fc is not None:
            deadline = sla_deadline(created_on)
            if deadline and fc <= deadline:
                w["sla_ok"] += 1

        # Connected
        if lid in connected_leads:
            w["connected"] += 1

        # Qualified / Won
        if is_qualified(lead["status"]):
            w["qualified"] += 1
        if is_won(lead["status"]):
            w["won"] += 1

        # Marketing (all leads regardless of manager)
        mkt_week[wn]["total"] += 1
        if is_qualified(lead["status"]):
            mkt_week[wn]["qualified"] += 1

    # Build output dict
    out = {}

    def pct(num, denom):
        if not denom:
            return None
        return round(num * 100.0 / denom, 1)

    def safe(val):
        return None if (val is None or (isinstance(val, float) and math.isnan(val))) else val

    # Sales managers
    total_by_week = defaultdict(lambda: {
        "total": 0, "sla_ok": 0, "connected": 0,
        "qualified": 0, "won": 0,
    })

    for mgr in ["edwin", "adarsh", "ashok"]:
        out[mgr] = {}
        for wn in range(1, 14):
            w = mgr_week[mgr].get(wn)
            if not w or w["total"] == 0:
                continue
            ts = task_sla.get((mgr, wn), {"total": 0, "on_time": 0})
            wk = week_label(wn)
            out[mgr][wk] = {
                "total_leads":       w["total"],
                "pct_contacted_sla": safe(pct(w["sla_ok"],    w["total"])),
                "pct_connected":     safe(pct(w["connected"], w["total"])),
                "pct_quote_sent":    safe(pct(w["qualified"], w["total"])),
                "conversion_pct":    safe(pct(w["won"],       w["total"])),
                "no_of_bookings":    w["won"],
                "pct_followups_sla": safe(pct(ts["on_time"], ts["total"])),
            }
            # Accumulate for total_sales
            for k in ("total", "sla_ok", "connected", "qualified", "won"):
                total_by_week[wn][k] += w[k]

    # Total sales
    out["total_sales"] = {}
    for wn in range(1, 14):
        w = total_by_week.get(wn)
        if not w or w["total"] == 0:
            continue
        # Average % metrics across 3 managers
        mgr_pcts = {"sla": [], "conn": [], "qual": [], "conv": [], "fu": []}
        for mgr in ["edwin", "adarsh", "ashok"]:
            mw = mgr_week[mgr].get(wn, {})
            mt = mw.get("total", 0)
            if mt:
                mgr_pcts["sla"].append(pct(mw["sla_ok"],    mt) or 0)
                mgr_pcts["conn"].append(pct(mw["connected"], mt) or 0)
                mgr_pcts["qual"].append(pct(mw["qualified"], mt) or 0)
                mgr_pcts["conv"].append(pct(mw["won"],       mt) or 0)
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

    # Marketing (Deeksha)
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

# ── Main ─────────────────────────────────────────────────────
if __name__ == "__main__":
    lead_map, connected_leads, task_sla = fetch_telecrm()
    spend_by_week = fetch_ad_spend()
    metrics = compute_metrics(lead_map, connected_leads, task_sla, spend_by_week)

    out_path = "public/live_data.json"
    with open(out_path, "w") as f:
        json.dump({
            "generated_at": datetime.utcnow().isoformat() + "Z",
            "quarter":      "Q1 FY2026",
            "data":         metrics,
        }, f, indent=2)

    print(f"\nWrote {out_path}")
    # Print summary
    for mgr in ["edwin", "adarsh", "ashok", "deeksha", "total_sales"]:
        weeks = list(metrics.get(mgr, {}).keys())
        print(f"  {mgr:<12}: {len(weeks)} weeks of data — {weeks}")

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { lazy, Suspense } from "react";
import { createClient } from "@supabase/supabase-js";

// ── Supabase client (uses anon key from env) ─────────────────
const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPA_KEY = import.meta.env.VITE_SUPABASE_KEY;
const supabase = SUPA_URL && SUPA_KEY ? createClient(SUPA_URL, SUPA_KEY) : null;

// ═══════════════════════════════════════════════════════════════
//  COX & KINGS — EOS WEEKLY SCORECARD DASHBOARD
//  Phase 1: Sales (Edwin, Adarsh, Ashok) + Marketing (Deeksha)
// ═══════════════════════════════════════════════════════════════

const WEEKS = Array.from({ length: 13 }, (_, i) => `Wk ${i + 1}`);

const QUARTERS = [
  { id: "q1fy26", label: "Q1 FY2026", range: "Jan – Mar 2026" },
  { id: "q2fy26", label: "Q2 FY2026", range: "Apr – Jun 2026" },
  { id: "q3fy26", label: "Q3 FY2026", range: "Jul – Sep 2026" },
  { id: "q4fy26", label: "Q4 FY2026", range: "Oct – Dec 2026" },
];

const SALES_METRICS = [
  { key: "total_leads", label: "Total No. of Leads Taken", type: "num", up: true },
  { key: "pct_contacted_sla", label: "% Leads Contacted as per SLA", type: "pct", up: true },
  { key: "pct_connected", label: "% Leads Connected", type: "pct", up: true },
  { key: "pct_quote_sent", label: "% Quote Sent", type: "pct", up: true },
  { key: "conversion_pct", label: "Conversion %", type: "pct", up: true },
  { key: "no_of_bookings", label: "No. of Bookings", type: "num", up: true },
  { key: "avg_booking_value", label: "Average Booking Value", type: "inr", blank: true },
  { key: "pct_departure", label: "% Departure Filled", type: "pct", blank: true },
  { key: "pct_followups_sla", label: "% Follow-ups Done as per SLA", type: "pct", up: true },
];

const SECTIONS = [
  {
    id: "deeksha", title: "DEEKSHA — PERFORMANCE MARKETING", owner: "Deeksha",
    accentColor: "#A78BFA", badgeText: "AUTO • META + TELECRM",
    metrics: [
      { key: "total_leads", label: "Total Leads Generated", type: "num", up: true },
      { key: "cpl", label: "Cost Per Lead (CPL)", type: "inr", up: false },
      { key: "total_qualified", label: "Total Qualified Leads", type: "num", up: true },
      { key: "cpql", label: "Cost Per Qualified Lead", type: "inr", up: false },
      { key: "total_spend", label: "Total Spend incl. GST", type: "inr", up: null },
      { key: "gm_roas", label: "GM ROAS", type: "num", blank: true },
    ]
  },
  {
    id: "loyana", title: "LOYANA — BRAND", owner: "Loyana",
    accentColor: "#F472B6", badgeText: "MANUAL ENTRY",
    metrics: [
      { key: "content_published", label: "Content Pieces Published", type: "num", up: true },
      { key: "follower_growth", label: "Social Media Follower Growth", type: "num", up: true },
      { key: "engagement_rate", label: "Engagement Rate", type: "pct", up: true },
      { key: "organic_traffic", label: "Organic Website Traffic", type: "num", up: true },
      { key: "pr_mentions", label: "PR Mentions / Media Coverage", type: "num", blank: true },
      { key: "newsletter_sent", label: "Email Newsletter Sent (Y/N)", type: "bool", blank: true },
    ]
  },
  {
    id: "l1", title: "L1 TEAM LEAD — TO BE HIRED", owner: "TBH",
    accentColor: "#FBBF24", badgeText: "POSITION OPEN",
    metrics: [
      { key: "pct_qualified", label: "% Leads Qualified", type: "pct", up: true },
      { key: "pct_allocated", label: "% Leads Allocated Correctly", type: "pct", up: true },
      { key: "sla_5min", label: "SLA Compliance (5-min)", type: "pct", up: true },
      { key: "avg_talktime", label: "Average Talktime", type: "dur", up: null },
      { key: "median_talktime", label: "Median Talktime", type: "dur", up: null },
      { key: "lead_contact_rate", label: "Lead-to-Contact Rate", type: "pct", up: true },
    ]
  },
  { id: "edwin", title: "EDWIN — SALES", owner: "Edwin", accentColor: "#34D399", badgeText: "AUTO • TELECRM", metrics: SALES_METRICS },
  { id: "adarsh", title: "ADARSH — SALES", owner: "Adarsh", accentColor: "#34D399", badgeText: "AUTO • TELECRM", metrics: SALES_METRICS },
  {
    id: "ashok", title: "ASHOK — SALES", owner: "Ashok",
    accentColor: "#34D399", badgeText: "AUTO • TELECRM",
    metrics: [
      ...SALES_METRICS.filter(m => m.key !== "pct_departure"),
      { key: "advance_received", label: "Advance Received", type: "inr", blank: true },
    ]
  },
  {
    id: "total_sales", title: "TOTAL — SALES (EDWIN + ADARSH + ASHOK)", owner: "Total",
    accentColor: "#22D3EE", badgeText: "AUTO-COMPUTED",
    metrics: [
      { key: "total_leads", label: "Total No. of Leads Taken", type: "num", up: true },
      { key: "pct_contacted_sla", label: "% Leads Contacted as per SLA", type: "pct", up: true },
      { key: "pct_connected", label: "% Leads Connected", type: "pct", up: true },
      { key: "pct_quote_sent", label: "% Quote Sent", type: "pct", up: true },
      { key: "conversion_pct", label: "Conversion %", type: "pct", up: true },
      { key: "no_of_bookings", label: "No. of Bookings", type: "num", up: true },
      { key: "avg_booking_value", label: "Average Booking Value", type: "inr", blank: true },
      { key: "advance_received", label: "Advance Received", type: "inr", blank: true },
      { key: "pct_followups_sla", label: "% Follow-ups Done as per SLA", type: "pct", up: true },
    ]
  },
  // ── HOLD sections ──────────────────────────────────────────
  {
    id: "bhavna", title: "BHAVNA — PRODUCT / CX", owner: "Bhavna", accentColor: "#4B5563", hold: true,
    metrics: [
      { key: "ready_deps", label: "No. of Ready-to-Sell Departures", type: "num" },
      { key: "cal_coverage", label: "% Calendar Coverage", type: "pct" },
      { key: "new_products", label: "New Products Launched / Quarter", type: "num" },
      { key: "post_trip_score", label: "Post-Trip Experience Score", type: "num" },
      { key: "nps", label: "NPS Score", type: "num" },
    ]
  },
  {
    id: "pooja", title: "POOJA — BUYING", owner: "Pooja", accentColor: "#4B5563", hold: true,
    metrics: [
      { key: "gm_pct", label: "Gross Margin %", type: "pct" },
      { key: "dmc_contracted", label: "No. of DMCs Contracted", type: "num" },
      { key: "free_cancel", label: "% Contracts with 30-Day Free Cancellation", type: "pct" },
      { key: "zero_upfront", label: "% Zero Upfront Payment Contracts", type: "pct" },
      { key: "dmc_quality", label: "DMC Quality Score", type: "num" },
    ]
  },
  {
    id: "ops", title: "OPERATIONS (TBH)", owner: "Ops", accentColor: "#4B5563", hold: true,
    metrics: [
      { key: "visa_on_time", label: "% Visa Applications Processed On Time", type: "pct" },
      { key: "docs_on_time", label: "% Documents Sent On Time", type: "pct" },
      { key: "supplier_conf", label: "Supplier Confirmation Rate", type: "pct" },
      { key: "escalation_rate", label: "On-Trip Escalation Rate", type: "pct" },
      { key: "escalation_time", label: "Escalation Resolution Time (hrs)", type: "num" },
      { key: "refund_time", label: "Refund Processing Time (days)", type: "num" },
      { key: "bookings_clean", label: "% Bookings Closed Clean", type: "pct" },
    ]
  },
  {
    id: "archit", title: "ARCHIT — FINANCE", owner: "Archit", accentColor: "#4B5563", hold: true,
    metrics: [
      { key: "cash_balance", label: "Cash Balance", type: "inr" },
      { key: "advance_rate", label: "Advance Collection Rate", type: "pct" },
      { key: "ar_overdue", label: "Accounts Receivable Overdue %", type: "pct" },
      { key: "supplier_pay", label: "Supplier Payment Compliance", type: "pct" },
      { key: "pnl_on_time", label: "Weekly P&L Delivered On Time", type: "bool" },
      { key: "budget_var", label: "Budget vs Actual Variance", type: "pct" },
      { key: "gm_accuracy", label: "Gross Margin Tracking Accuracy", type: "pct" },
    ]
  },
  {
    id: "sachin", title: "SACHIN — TECH", owner: "Sachin", accentColor: "#4B5563", hold: true,
    metrics: [
      { key: "uptime", label: "Website Uptime %", type: "pct", blank: true },
      { key: "load_time", label: "Website Load Time (seconds)", type: "num", blank: true },
      { key: "quote_time", label: "Quote Generation Time (mins)", type: "num", blank: true },
      { key: "system_uptime", label: "System Uptime (CRM/ERP/DB)", type: "pct", blank: true },
      { key: "data_sync", label: "Data Sync Accuracy", type: "pct", blank: true },
      { key: "lead_leakage", label: "Lead Leakage Rate", type: "pct", blank: true },
      { key: "feature_delivery", label: "Feature / Improvement Delivery Rate", type: "pct", blank: true },
      { key: "auto_comms", label: "Auto Customer Comms Coverage", type: "pct", blank: true },
      { key: "dash_avail", label: "Dashboard / Reporting Availability", type: "pct", blank: true },
      { key: "data_security", label: "Data Security & Backup Compliance", type: "pct", blank: true },
    ]
  },
  {
    id: "anushka", title: "ANUSHKA — HR", owner: "Anushka", accentColor: "#4B5563", hold: true,
    metrics: [
      { key: "open_positions", label: "Open Positions vs Plan", type: "num", blank: true },
      { key: "time_to_fill", label: "Time to Fill (days)", type: "num", blank: true },
      { key: "cost_per_hire", label: "Cost Per Hire", type: "inr", blank: true },
      { key: "offer_accept", label: "Offer Acceptance Rate", type: "pct", blank: true },
      { key: "retention_90", label: "90-Day Retention Rate", type: "pct", blank: true },
      { key: "attrition", label: "Attrition Rate (Monthly)", type: "pct", blank: true },
      { key: "q_convo", label: "Quarterly Conversation Completion %", type: "pct", blank: true },
      { key: "core_values", label: "Core Values Alignment Score", type: "num", blank: true },
    ]
  },
];

// ─── Mock data (replace with Supabase queries) ───────────────
function rng(seed, min, max) {
  const x = Math.sin(seed) * 10000;
  return Math.round(min + (x - Math.floor(x)) * (max - min));
}

function buildMock() {
  const d = {};
  const agents = [
    { id: "edwin", i: 1 },
    { id: "adarsh", i: 2 },
    { id: "ashok", i: 3 },
  ];
  agents.forEach(({ id, i }) => {
    d[id] = {};
    WEEKS.forEach((wk, w) => {
      if (w < 6) {
        d[id][wk] = {
          total_leads: rng(i * 100 + w, 40, 75),
          pct_contacted_sla: rng(i * 200 + w, 62, 95),
          pct_connected: rng(i * 300 + w, 48, 78),
          pct_quote_sent: rng(i * 400 + w, 38, 68),
          conversion_pct: rng(i * 500 + w, 2, 9),
          no_of_bookings: rng(i * 600 + w, 1, 6),
          pct_followups_sla: rng(i * 700 + w, 60, 92),
        };
      }
    });
  });

  d.deeksha = {};
  WEEKS.forEach((wk, w) => {
    if (w < 6) {
      const tl = rng(900 + w, 140, 320);
      const ql = rng(800 + w, 70, 160);
      const sp = rng(700 + w, 90000, 220000);
      d.deeksha[wk] = {
        total_leads: tl,
        total_qualified: ql,
        total_spend: sp,
        cpl: Math.round(sp / tl),
        cpql: Math.round(sp / ql),
      };
    }
  });
  return d;
}

const MOCK_DATA = buildMock();

const DEFAULT_TARGETS = {
  deeksha: { total_leads: 200, total_qualified: 100, cpl: 600, cpql: 1100, total_spend: null },
  edwin: { total_leads: 60, pct_contacted_sla: 80, pct_connected: 65, pct_quote_sent: 55, conversion_pct: 5, no_of_bookings: 3, pct_followups_sla: 80 },
  adarsh: { total_leads: 60, pct_contacted_sla: 80, pct_connected: 65, pct_quote_sent: 55, conversion_pct: 5, no_of_bookings: 3, pct_followups_sla: 80 },
  ashok: { total_leads: 50, pct_contacted_sla: 75, pct_connected: 60, pct_quote_sent: 50, conversion_pct: 4, no_of_bookings: 2, pct_followups_sla: 75 },
};

// ─── Utilities ───────────────────────────────────────────────
function getWeekDateRange(quarterId, weekNum) {
  let startStr;
  if (quarterId === "q1fy26") startStr = "2026-01-01T12:00:00Z";
  else if (quarterId === "q2fy26") startStr = "2026-04-01T12:00:00Z";
  else if (quarterId === "q3fy26") startStr = "2026-07-01T12:00:00Z";
  else if (quarterId === "q4fy26") startStr = "2026-10-01T12:00:00Z";
  else return "";

  const d = new Date(startStr);
  d.setDate(d.getDate() + (weekNum - 1) * 7);

  const dEnd = new Date(d);
  dEnd.setDate(dEnd.getDate() + 6);

  if (weekNum === 13) {
    if (quarterId === "q1fy26") dEnd.setMonth(2, 31);
    else if (quarterId === "q2fy26") dEnd.setMonth(5, 30);
    else if (quarterId === "q3fy26") dEnd.setMonth(8, 30);
    else if (quarterId === "q4fy26") dEnd.setMonth(11, 31);
  }

  const opts = { month: 'short', day: 'numeric' };
  return `${d.toLocaleDateString('en-US', opts)} - ${dEnd.toLocaleDateString('en-US', opts)}`;
}

function fmt(val, type) {
  if (val === null || val === undefined) return null;
  if (type === "pct") return `${val}%`;
  if (type === "inr") {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(0)}K`;
    return `₹${val}`;
  }
  if (type === "dur") {
    const m = Math.floor(val / 60), s = val % 60;
    return `${m}m ${s}s`;
  }
  if (type === "bool") return val ? "Y" : "N";
  return String(val);
}

function getStatus(val, target, up) {
  if (val == null || target == null || up == null) return "neutral";
  if (up) return val >= target ? "green" : "red";
  return val <= target ? "green" : "red";
}

// ─── CSS ─────────────────────────────────────────────────────
const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #0B1628; }
  ::-webkit-scrollbar-thumb { background: #1E3050; border-radius: 4px; }
  input:focus { outline: 2px solid #C9A252 !important; }
  .btn-outline:hover { border-color: #4A6A90 !important; color: #A0B8D0 !important; background: #0F1E30 !important; }
  .nav-btn:hover { background: #0F1E30 !important; color: #8AAAC8 !important; }
  .scorecard-row:hover td { background: rgba(255,255,255,0.02) !important; }
  .cell-green { background: rgba(52, 211, 153, 0.13) !important; }
  .cell-red   { background: rgba(248, 113, 113, 0.13) !important; }
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }
`;

// ─── Main App ────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("scorecard");
  const [quarter, setQuarter] = useState("q1fy26");
  const [targets, setTargets] = useState(DEFAULT_TARGETS);
  const [filterSection, setFilterSection] = useState(null);
  const [qOpen, setQOpen] = useState(false);
  const [sideCollapsed, setSideCollapsed] = useState(false);
  const [liveData, setLiveData] = useState(MOCK_DATA);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [realtimeStatus, setRealtimeStatus] = useState("connecting"); // connecting | connected | polling | disconnected
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState(null);
  const fileRef = useRef();
  const refreshTimerRef = useRef(null);

  // Load live data — Supabase REST (primary) → live_data.json (fallback)
  useEffect(() => {
    setDataLoading(true);
    setDataError(null);

    const SUPA_URL = import.meta.env.VITE_SUPABASE_URL;
    const SUPA_KEY = import.meta.env.VITE_SUPABASE_KEY;

    const loadFromSupabase = async () => {
      const hdrs = {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        Accept: "application/json",
      };

      // Step 1: resolve quarter label → Supabase UUID
      // quarters.id is a UUID; the label (e.g. "Q1 FY2026") maps to quarters.name
      const qLabel = QUARTERS.find(q => q.id === quarter)?.label; // e.g. "Q1 FY2026"
      if (!qLabel) throw new Error(`Unknown quarter: ${quarter}`);

      const qRes = await fetch(
        `${SUPA_URL}/rest/v1/quarters?name=eq.${encodeURIComponent(qLabel)}&select=id`,
        { headers: hdrs }
      );
      if (!qRes.ok) throw new Error(`Quarters lookup ${qRes.status}`);
      const qRows = await qRes.json();
      if (!qRows.length) throw new Error(`Quarter "${qLabel}" not found in Supabase`);
      const quarterUuid = qRows[0].id;

      // Step 2: fetch scorecard data using the UUID
      const url =
        `${SUPA_URL}/rest/v1/v_scorecard_full` +
        `?quarter_id=eq.${quarterUuid}&select=section_id,week_number,metric_key,value`;
      const res = await fetch(url, { headers: hdrs });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      const rows = await res.json();
      if (!rows.length) throw new Error("No rows from Supabase for this quarter");

      // Transform flat rows → { section_id: { "Wk N": { metric_key: value } } }
      const nested = {};
      rows.forEach(({ section_id, week_number, metric_key, value }) => {
        const wk = `Wk ${week_number}`;
        if (!nested[section_id]) nested[section_id] = {};
        if (!nested[section_id][wk]) nested[section_id][wk] = {};
        nested[section_id][wk][metric_key] = value;
      });
      return nested;
    };

    const loadFromJSON = async () => {
      const res = await fetch("/live_data.json");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setGeneratedAt(j.generated_at);
      return j.data;
    };

    (async () => {
      try {
        if (SUPA_URL && SUPA_KEY) {
          const nested = await loadFromSupabase();
          setLiveData(nested);
          setGeneratedAt(new Date().toISOString());
        } else {
          const data = await loadFromJSON();
          setLiveData(data);
        }
      } catch (supaErr) {
        console.warn("Supabase fetch failed, falling back to live_data.json:", supaErr.message);
        try {
          const data = await loadFromJSON();
          setLiveData(data);
        } catch (jsonErr) {
          setDataError(jsonErr.message);
        }
      } finally {
        setDataLoading(false);
      }
    })();
  }, [quarter]);

  // ── Trigger data reload (called by Realtime or polling) ─────
  const reloadData = useCallback(() => {
    setDataLoading(true);
    setDataError(null);

    const loadFromSupabase = async () => {
      const hdrs = {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        Accept: "application/json",
      };
      const qLabel = QUARTERS.find(q => q.id === quarter)?.label;
      if (!qLabel) throw new Error(`Unknown quarter: ${quarter}`);

      const qRes = await fetch(
        `${SUPA_URL}/rest/v1/quarters?name=eq.${encodeURIComponent(qLabel)}&select=id`,
        { headers: hdrs }
      );
      if (!qRes.ok) throw new Error(`Quarters lookup ${qRes.status}`);
      const qRows = await qRes.json();
      if (!qRows.length) throw new Error(`Quarter "${qLabel}" not found`);
      const quarterUuid = qRows[0].id;

      const url =
        `${SUPA_URL}/rest/v1/v_scorecard_full` +
        `?quarter_id=eq.${quarterUuid}&select=section_id,week_number,metric_key,value`;
      const res = await fetch(url, { headers: hdrs });
      if (!res.ok) throw new Error(`Supabase ${res.status}`);
      const rows = await res.json();
      if (!rows.length) throw new Error("No rows");

      const nested = {};
      rows.forEach(({ section_id, week_number, metric_key, value }) => {
        const wk = `Wk ${week_number}`;
        if (!nested[section_id]) nested[section_id] = {};
        if (!nested[section_id][wk]) nested[section_id][wk] = {};
        nested[section_id][wk][metric_key] = value;
      });
      return nested;
    };

    const loadFromJSON = async () => {
      const res = await fetch("/live_data.json?t=" + Date.now());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = await res.json();
      setGeneratedAt(j.generated_at);
      return j.data;
    };

    (async () => {
      try {
        if (SUPA_URL && SUPA_KEY) {
          const nested = await loadFromSupabase();
          setLiveData(nested);
          setGeneratedAt(new Date().toISOString());
        } else {
          const data = await loadFromJSON();
          setLiveData(data);
        }
      } catch {
        try {
          const data = await loadFromJSON();
          setLiveData(data);
        } catch (e) {
          setDataError(e.message);
        }
      } finally {
        setDataLoading(false);
      }
    })();
  }, [quarter]);

  // ── Supabase Realtime subscription ──────────────────────────
  useEffect(() => {
    if (!supabase) {
      // No Supabase config — fall back to polling live_data.json every 5 min
      setRealtimeStatus("polling");
      const pollInterval = setInterval(() => {
        reloadData();
      }, 5 * 60 * 1000);
      return () => clearInterval(pollInterval);
    }

    let debounceTimer = null;

    const channel = supabase
      .channel("scorecard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "raw_leads" },
        (payload) => {
          console.log("[Realtime] raw_leads change:", payload.eventType);
          setLastRealtimeEvent(new Date().toISOString());
          // Debounce: wait 3s for batch of changes to settle before refreshing
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => reloadData(), 3000);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "raw_call_logs" },
        (payload) => {
          console.log("[Realtime] raw_call_logs change:", payload.eventType);
          setLastRealtimeEvent(new Date().toISOString());
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => reloadData(), 3000);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "raw_tasks" },
        (payload) => {
          console.log("[Realtime] raw_tasks change:", payload.eventType);
          setLastRealtimeEvent(new Date().toISOString());
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => reloadData(), 3000);
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] status:", status);
        if (status === "SUBSCRIBED") {
          setRealtimeStatus("connected");
          // Clear any fallback polling since Realtime works
          if (refreshTimerRef.current) {
            clearInterval(refreshTimerRef.current);
            refreshTimerRef.current = null;
          }
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("[Realtime] Connection failed, falling back to polling");
          setRealtimeStatus("polling");
          // Start polling every 5 minutes as fallback
          if (!refreshTimerRef.current) {
            refreshTimerRef.current = setInterval(() => reloadData(), 5 * 60 * 1000);
          }
        } else {
          setRealtimeStatus("connecting");
        }
      });

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      supabase.removeChannel(channel);
    };
  }, [reloadData]);

  const currentQ = QUARTERS.find(q => q.id === quarter);

  const visibleSections = useMemo(
    () => filterSection ? SECTIONS.filter(s => s.id === filterSection) : SECTIONS,
    [filterSection]
  );

  // PDF Export — full scorecard (landscape A4)
  const [pdfLoading, setPdfLoading] = useState(false);
  const exportPDF = useCallback(async () => {
    setPdfLoading(true);
    try {
      const { pdf, Document, Page, View, Text, StyleSheet, Font } = await import("@react-pdf/renderer");

      const C = {
        bg: "#0B1628",
        header: "#0D1F36",
        banner: "#0F2840",
        rowOdd: "#0D1A2A",
        rowEven: "#0B1628",
        text: "#D4E0EC",
        dim: "#5A7A9A",
        gold: "#C9A252",
        green: "#0A2A18",
        greenText: "#34D399",
        red: "#2A0A0A",
        redText: "#F87171",
        border: "#1A3050",
        white: "#FFFFFF",
      };

      const styles = StyleSheet.create({
        page: { backgroundColor: C.bg, padding: 14, fontFamily: "Helvetica" },
        header: { marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
        headerL: { flexDirection: "column" },
        title: { fontSize: 14, color: C.gold, fontFamily: "Helvetica-Bold", letterSpacing: 1.5 },
        subtitle: { fontSize: 8, color: C.dim, marginTop: 2, letterSpacing: 0.5 },
        generatedAt: { fontSize: 7, color: C.dim, textAlign: "right" },
        banner: { backgroundColor: C.banner, flexDirection: "row", paddingVertical: 4, paddingHorizontal: 4, marginTop: 6, borderLeft: 2, borderLeftColor: C.gold },
        bannerText: { fontSize: 7.5, color: C.gold, fontFamily: "Helvetica-Bold", letterSpacing: 0.8, flex: 1 },
        table: { marginBottom: 2 },
        row: { flexDirection: "row", borderBottom: 0.5, borderBottomColor: C.border },
        colLabel: { width: 130, paddingHorizontal: 4, paddingVertical: 2 },
        colOwner: { width: 40, paddingHorizontal: 2, paddingVertical: 2, textAlign: "center" },
        colTarget: { width: 40, paddingHorizontal: 2, paddingVertical: 2, textAlign: "center" },
        colWk: { flex: 1, paddingHorizontal: 1, paddingVertical: 2, textAlign: "center" },
        cellText: { fontSize: 6, color: C.text },
        cellDim: { fontSize: 6, color: C.dim },
        cellGreen: { backgroundColor: C.green },
        cellRed: { backgroundColor: C.red },
        cellGreenTxt: { fontSize: 6, color: C.greenText, fontFamily: "Helvetica-Bold" },
        cellRedTxt: { fontSize: 6, color: C.redText, fontFamily: "Helvetica-Bold" },
        hdrRow: { backgroundColor: C.header, flexDirection: "row", paddingVertical: 3 },
        hdrText: { fontSize: 6, color: C.dim, fontFamily: "Helvetica-Bold", letterSpacing: 0.3 },
      });

      const activeSections = SECTIONS.filter(s => !s.hold);
      const now = generatedAt
        ? new Date(generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " IST"
        : new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

      const doc = (
        <Document title={`CKings EOS ${quarter}`} author="Cox & Kings">
          <Page size="A4" orientation="landscape" style={styles.page}>
            {/* ── Header ───────────────────────── */}
            <View style={styles.header}>
              <View style={styles.headerL}>
                <Text style={styles.title}>COX & KINGS — EOS WEEKLY SCORECARD</Text>
                <Text style={styles.subtitle}>{currentQ?.label} · {currentQ?.range}</Text>
              </View>
              <Text style={styles.generatedAt}>Data as of {now}</Text>
            </View>

            {/* ── Column header ─────────────────── */}
            <View style={styles.hdrRow}>
              <View style={styles.colLabel}><Text style={styles.hdrText}>MEASURABLE</Text></View>
              <View style={styles.colOwner}><Text style={styles.hdrText}>OWNER</Text></View>
              <View style={styles.colTarget}><Text style={styles.hdrText}>TARGET</Text></View>
              {WEEKS.map((wk, i) => (
                <View key={wk} style={styles.colWk}>
                  <Text style={styles.hdrText}>{wk}</Text>
                  <Text style={{ fontSize: 4.5, color: '#5A7A9A', marginTop: 1, fontFamily: "Helvetica", textAlign: "center" }}>{getWeekDateRange(quarter, i + 1)}</Text>
                </View>
              ))}
            </View>

            {/* ── Sections ─────────────────────── */}
            {activeSections.map(sec => (
              <View key={sec.id} style={styles.table} wrap={false}>
                {/* Section banner */}
                <View style={[styles.banner, { borderLeftColor: sec.accentColor }]}>
                  <Text style={[styles.bannerText, { color: sec.accentColor }]}>{sec.title}</Text>
                  <Text style={{ fontSize: 6, color: C.dim, paddingTop: 1 }}>{sec.badgeText}</Text>
                </View>

                {/* Metric rows */}
                {sec.metrics.filter(m => !m.blank).map((m, mi) => {
                  const tgt = targets[sec.id]?.[m.key] ?? null;
                  return (
                    <View key={m.key} style={[styles.row, { backgroundColor: mi % 2 === 0 ? C.rowOdd : C.rowEven }]}>
                      <View style={styles.colLabel}>
                        <Text style={styles.cellText}>{m.label}</Text>
                      </View>
                      <View style={styles.colOwner}>
                        <Text style={styles.cellDim}>{sec.owner}</Text>
                      </View>
                      <View style={styles.colTarget}>
                        <Text style={styles.cellDim}>{tgt != null ? fmt(tgt, m.type) : "—"}</Text>
                      </View>
                      {WEEKS.map(wk => {
                        const raw = liveData[sec.id]?.[wk]?.[m.key] ?? null;
                        const st = getStatus(raw, tgt, m.up);
                        const txt = raw != null ? fmt(raw, m.type) : "";
                        const isGreen = st === "green";
                        const isRed = st === "red";
                        return (
                          <View key={wk} style={[styles.colWk, isGreen ? styles.cellGreen : isRed ? styles.cellRed : {}]}>
                            <Text style={isGreen ? styles.cellGreenTxt : isRed ? styles.cellRedTxt : styles.cellDim}>
                              {txt || "—"}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            ))}
          </Page>
        </Document>
      );

      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `CKings_EOS_${quarter}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("PDF export failed: " + err.message);
    } finally {
      setPdfLoading(false);
    }
  }, [liveData, targets, quarter, currentQ, generatedAt]);

  // CSV Export — full scorecard
  const exportCSV = useCallback(() => {
    const rows = [["Department", "Owner", "Metric", "Target", ...WEEKS]];
    SECTIONS.forEach(sec => {
      sec.metrics.forEach(m => {
        const tgt = targets[sec.id]?.[m.key] ?? "";
        const vals = WEEKS.map(wk => liveData[sec.id]?.[wk]?.[m.key] ?? "");
        rows.push([sec.title, sec.owner, m.label, tgt, ...vals]);
      });
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `CKings_EOS_${quarter}.csv`;
    a.click();
  }, [targets, quarter]);

  // Target CSV upload
  const onTargetFile = useCallback(e => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const updated = { ...targets };
      ev.target.result.trim().split("\n").slice(1).forEach(line => {
        const [sid, mkey, val] = line.split(",").map(c => c.replace(/"/g, "").trim());
        if (sid && mkey) {
          if (!updated[sid]) updated[sid] = {};
          updated[sid][mkey] = val === "" ? null : Number(val);
        }
      });
      setTargets(updated);
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [targets]);

  return (
    <>
      <style>{STYLE}</style>
      <div style={{ display: "flex", height: "100vh", background: "#0B1628", color: "#D4E0EC", fontFamily: "'Sora', sans-serif", overflow: "hidden" }}>

        {/* ── SIDEBAR ─────────────────────────────── */}
        <aside style={{
          width: sideCollapsed ? 52 : 228, minWidth: sideCollapsed ? 52 : 228,
          background: "#060F1C", borderRight: "1px solid #162236",
          display: "flex", flexDirection: "column", transition: "width 0.2s",
          overflow: "hidden"
        }}>
          {/* Logo */}
          <div style={{ padding: sideCollapsed ? "18px 14px" : "18px 20px", borderBottom: "1px solid #162236", display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 26, height: 26, borderRadius: 6, background: "linear-gradient(135deg,#C9A252,#8B6A30)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#060F1C" }}>CK</div>
            {!sideCollapsed && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: "#C9A252", letterSpacing: "0.12em" }}>COX & KINGS</div>
                <div style={{ fontSize: 8, color: "#2E4A60", letterSpacing: "0.1em", marginTop: 1 }}>EOS SCORECARD SYSTEM</div>
              </div>
            )}
          </div>

          {/* Views */}
          {!sideCollapsed && (
            <div style={{ padding: "14px 12px 6px" }}>
              <div style={{ fontSize: 8, color: "#1E3A50", letterSpacing: "0.18em", fontWeight: 700, padding: "0 8px 8px" }}>VIEWS</div>
              {[
                { id: "scorecard", icon: "▦", label: "Full Scorecard" },
                { id: "targets", icon: "◎", label: "Manage Targets" },
              ].map(v => (
                <button key={v.id} className="nav-btn" onClick={() => setView(v.id)} style={{
                  width: "100%", textAlign: "left", padding: "8px 12px", borderRadius: 7,
                  border: "none", cursor: "pointer", marginBottom: 2, fontSize: 12,
                  display: "flex", alignItems: "center", gap: 8,
                  background: view === v.id ? "#162236" : "transparent",
                  color: view === v.id ? "#C9A252" : "#4A6A8A",
                  fontFamily: "'Sora', sans-serif", fontWeight: view === v.id ? 600 : 400,
                  transition: "all 0.12s"
                }}>
                  <span style={{ fontSize: 14 }}>{v.icon}</span> {v.label}
                </button>
              ))}
            </div>
          )}

          {/* Departments */}
          {!sideCollapsed && (
            <div style={{ padding: "8px 12px", flex: 1, overflowY: "auto" }}>
              <div style={{ fontSize: 8, color: "#1E3A50", letterSpacing: "0.18em", fontWeight: 700, padding: "0 8px 8px" }}>DEPARTMENTS</div>
              <button className="nav-btn" onClick={() => setFilterSection(null)} style={{
                width: "100%", textAlign: "left", padding: "7px 12px", borderRadius: 7, border: "none",
                background: !filterSection ? "#162236" : "transparent",
                color: !filterSection ? "#D4E0EC" : "#4A6A8A",
                fontSize: 11, cursor: "pointer", marginBottom: 2, fontFamily: "'Sora', sans-serif",
              }}>All Departments</button>
              {SECTIONS.map(sec => (
                <button key={sec.id} className="nav-btn" onClick={() => setFilterSection(filterSection === sec.id ? null : sec.id)} style={{
                  width: "100%", textAlign: "left", padding: "7px 12px", borderRadius: 7, border: "none",
                  background: filterSection === sec.id ? "#162236" : "transparent",
                  color: filterSection === sec.id ? "#D4E0EC" : "#4A6A8A",
                  fontSize: 11, cursor: "pointer", marginBottom: 1,
                  display: "flex", alignItems: "center", gap: 7,
                  fontFamily: "'Sora', sans-serif", transition: "all 0.12s"
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: 2, background: sec.hold ? "#243040" : sec.accentColor, flexShrink: 0 }} />
                  {sec.owner}
                  {sec.hold && <span style={{ marginLeft: "auto", fontSize: 8, color: "#243040", fontWeight: 700 }}>HOLD</span>}
                </button>
              ))}
            </div>
          )}

          {/* Collapse toggle */}
          <div style={{ padding: "12px", borderTop: "1px solid #162236" }}>
            <button onClick={() => setSideCollapsed(!sideCollapsed)} style={{
              width: "100%", padding: "6px", borderRadius: 6, border: "1px solid #162236",
              background: "transparent", color: "#2E4A60", cursor: "pointer", fontSize: 12
            }}>{sideCollapsed ? "▶" : "◀"}</button>
          </div>
        </aside>

        {/* ── MAIN ─────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

          {/* Header */}
          <header style={{
            background: "#060F1C", borderBottom: "1px solid #162236",
            padding: "12px 24px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0
          }}>
            <div style={{ flex: 1 }}>
              <h1 style={{ fontSize: 14, fontWeight: 700, color: "#D4E0EC", letterSpacing: "0.04em" }}>EOS Weekly Scorecard</h1>
              <p style={{ fontSize: 10, color: "#2E4A60", marginTop: 2 }}>
                Track weekly · Level 10 Meeting · <span style={{ color: "#34D399" }}>●</span> Green = on track · <span style={{ color: "#F87171" }}>●</span> Red = off track · 13 weeks = 1 quarter
              </p>
            </div>

            {/* Live data status */}
            {dataLoading && (
              <div style={{ padding: "4px 12px", borderRadius: 20, background: "#0F1E30", border: "1px solid #1E3A50", fontSize: 9, color: "#4A6A8A", fontWeight: 700, letterSpacing: "0.1em" }}>
                ⟳ LOADING LIVE DATA...
              </div>
            )}
            {dataError && (
              <div style={{ padding: "4px 12px", borderRadius: 20, background: "#1A0A0A", border: "1px solid #5A1A1A", fontSize: 9, color: "#F87171", fontWeight: 700, letterSpacing: "0.1em" }}>
                ⚠ MOCK DATA (no JSON)
              </div>
            )}
            {!dataLoading && !dataError && generatedAt && (
              <div style={{ padding: "4px 12px", borderRadius: 20, background: "#0A1A0A", border: "1px solid #1A4A2A", fontSize: 9, color: "#34D399", fontWeight: 700, letterSpacing: "0.1em" }}>
                ● LIVE · {new Date(generatedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} IST
              </div>
            )}

            {/* Realtime connection indicator */}
            <div style={{
              padding: "4px 12px", borderRadius: 20, fontSize: 9, fontWeight: 700, letterSpacing: "0.1em",
              display: "flex", alignItems: "center", gap: 5,
              background: realtimeStatus === "connected" ? "#0A1A0A" : realtimeStatus === "polling" ? "#1A1A0A" : "#0F1E30",
              border: `1px solid ${realtimeStatus === "connected" ? "#1A4A2A" : realtimeStatus === "polling" ? "#4A4A1A" : "#1E3A50"}`,
              color: realtimeStatus === "connected" ? "#34D399" : realtimeStatus === "polling" ? "#FBBF24" : "#4A6A8A",
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", display: "inline-block",
                background: realtimeStatus === "connected" ? "#34D399" : realtimeStatus === "polling" ? "#FBBF24" : "#4A6A8A",
                animation: realtimeStatus === "connected" ? "pulse 2s ease-in-out infinite" : "none",
                boxShadow: realtimeStatus === "connected" ? "0 0 6px #34D399" : "none",
              }} />
              {realtimeStatus === "connected" ? "REALTIME" : realtimeStatus === "polling" ? "POLLING" : realtimeStatus === "connecting" ? "CONNECTING…" : "OFFLINE"}
            </div>

            {/* Phase badge */}
            <div style={{ padding: "4px 12px", borderRadius: 20, background: "#0F1E30", border: "1px solid #1E3A50", fontSize: 9, color: "#4A6A8A", fontWeight: 700, letterSpacing: "0.12em" }}>
              PHASE 1 — SALES + MARKETING
            </div>

            {/* Quarter dropdown */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setQOpen(!qOpen)} style={{
                background: "#0F1E30", border: "1px solid #1E3A50", borderRadius: 8,
                color: "#C9A252", padding: "7px 14px", fontSize: 11, fontWeight: 700,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
                fontFamily: "'Sora', sans-serif"
              }}>
                {currentQ.label}
                <span style={{ fontSize: 9, color: "#3A5A70", fontWeight: 400 }}>{currentQ.range}</span>
                <span style={{ fontSize: 9 }}>▾</span>
              </button>
              {qOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", right: 0,
                  background: "#060F1C", border: "1px solid #1E3A50", borderRadius: 10,
                  padding: 6, zIndex: 200, minWidth: 220, boxShadow: "0 8px 32px rgba(0,0,0,0.5)"
                }}>
                  {QUARTERS.map(q => (
                    <button key={q.id} onClick={() => { setQuarter(q.id); setQOpen(false); }} style={{
                      display: "block", width: "100%", textAlign: "left", padding: "8px 14px",
                      background: quarter === q.id ? "#162236" : "transparent",
                      border: "none", borderRadius: 7,
                      color: quarter === q.id ? "#C9A252" : "#4A6A8A",
                      fontSize: 11, cursor: "pointer", fontFamily: "'Sora', sans-serif",
                    }}>
                      <span style={{ fontWeight: 600 }}>{q.label}</span>
                      <span style={{ marginLeft: 8, fontSize: 9, color: "#2E4A60" }}>{q.range}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={exportCSV} style={{
                background: "#C9A252", border: "none", borderRadius: 8, color: "#060F1C",
                padding: "8px 16px", fontSize: 11, fontWeight: 800, cursor: "pointer",
                letterSpacing: "0.06em", fontFamily: "'Sora', sans-serif"
              }}>↓ CSV</button>
              <button onClick={exportPDF} disabled={pdfLoading} style={{
                background: pdfLoading ? "#4A3010" : "#7C3AED", border: "none", borderRadius: 8,
                color: pdfLoading ? "#9A7040" : "#FFFFFF", padding: "8px 16px",
                fontSize: 11, fontWeight: 800, cursor: pdfLoading ? "wait" : "pointer",
                letterSpacing: "0.06em", fontFamily: "'Sora', sans-serif", opacity: pdfLoading ? 0.7 : 1
              }}>{pdfLoading ? "⌛ PDF…" : "↓ PDF"}</button>
            </div>
          </header>

          {/* Content */}
          <main style={{ flex: 1, overflow: "auto" }}>
            {view === "scorecard" && <ScorecardView sections={visibleSections} data={liveData} targets={targets} quarter={quarter} />}
            {view === "targets" && <TargetsView targets={targets} setTargets={setTargets} fileRef={fileRef} onUpload={onTargetFile} />}
          </main>
        </div>

        <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={onTargetFile} />
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SCORECARD TABLE VIEW
// ═══════════════════════════════════════════════════════════════
function ScorecardView({ sections, data, targets, quarter }) {
  return (
    <div style={{ overflow: "auto", height: "100%" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>

        {/* Sticky column headers */}
        <thead>
          <tr style={{ background: "#060F1C", position: "sticky", top: 0, zIndex: 20 }}>
            <th style={{ ...TH, width: 290, minWidth: 290, textAlign: "left", padding: "11px 18px", position: "sticky", left: 0, zIndex: 30, background: "#060F1C", borderRight: "1px solid #162236" }}>MEASURABLE</th>
            <th style={{ ...TH, width: 72, minWidth: 72 }}>OWNER</th>
            <th style={{ ...TH, width: 80, minWidth: 80, borderRight: "2px solid #1E3050" }}>TARGET</th>
            {WEEKS.map((wk, i) => (
              <th key={wk} style={TH}>
                <div>{wk}</div>
                <div style={{ fontSize: 8, color: "#4A6A8A", fontWeight: 400, marginTop: 2, letterSpacing: "normal" }}>{getWeekDateRange(quarter, i + 1)}</div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {sections.map(sec => (
            <>
              {/* Section banner */}
              <tr key={`${sec.id}__hdr`}>
                <td colSpan={3 + WEEKS.length} style={{
                  padding: "9px 18px", background: "#0A1828",
                  borderTop: "2px solid #162236", borderBottom: "1px solid #162236"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: sec.hold ? "#243040" : sec.accentColor, flexShrink: 0 }} />
                    <span style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                      color: sec.hold ? "#2E4A60" : sec.accentColor,
                      fontFamily: "'Sora', sans-serif"
                    }}>{sec.title}</span>
                    {sec.badgeText && (
                      <span style={{
                        fontSize: 8, padding: "2px 8px", borderRadius: 4, fontWeight: 700,
                        letterSpacing: "0.1em",
                        background: sec.hold ? "#0C1824" : `${sec.accentColor}18`,
                        border: `1px solid ${sec.hold ? "#162236" : sec.accentColor + "44"}`,
                        color: sec.hold ? "#243040" : sec.accentColor + "CC",
                      }}>{sec.badgeText}</span>
                    )}
                  </div>
                </td>
              </tr>

              {/* Metric rows */}
              {sec.metrics.map((m, mi) => {
                const tgt = targets[sec.id]?.[m.key] ?? null;
                const isEven = mi % 2 === 0;
                return (
                  <tr key={`${sec.id}__${m.key}`} className="scorecard-row">
                    {/* Metric label — sticky left */}
                    <td style={{
                      ...TD, padding: "7px 18px",
                      fontFamily: "'Sora', sans-serif", fontSize: 11,
                      color: sec.hold || m.blank ? "#283A50" : "#94AAC0",
                      background: isEven ? "#0B1628" : "#0D1C30",
                      position: "sticky", left: 0, zIndex: 5,
                      borderRight: "1px solid #162236"
                    }}>{m.label}</td>

                    {/* Owner */}
                    <td style={{ ...TD, textAlign: "center", color: "#2A4060", fontFamily: "'Sora', sans-serif", fontSize: 10, background: isEven ? "#0B1628" : "#0D1C30" }}>
                      {sec.owner}
                    </td>

                    {/* Target */}
                    <td style={{ ...TD, textAlign: "center", borderRight: "2px solid #1E3050", color: "#C9A252", fontWeight: 600, background: isEven ? "#0B1628" : "#0D1C30" }}>
                      {m.blank || m.hold || sec.hold
                        ? <Dash />
                        : tgt !== null
                          ? <span style={{ fontSize: 11 }}>{fmt(tgt, m.type)}</span>
                          : <span style={{ color: "#243040", fontSize: 11 }}>—</span>
                      }
                    </td>

                    {/* Week cells */}
                    {WEEKS.map(wk => {
                      if (m.blank || m.hold || sec.hold) {
                        return <td key={wk} style={{ ...TD, textAlign: "center", background: isEven ? "#0B1628" : "#0D1C30" }}><Dash /></td>;
                      }
                      const val = data[sec.id]?.[wk]?.[m.key] ?? null;
                      const st = getStatus(val, tgt, m.up);
                      const cellBg = val === null ? "" : st === "green" ? "cell-green" : st === "red" ? "cell-red" : "";
                      return (
                        <td key={wk} className={cellBg} style={{ ...TD, textAlign: "center", background: isEven ? "#0B1628" : "#0D1C30" }}>
                          {val !== null
                            ? <span style={{ color: st === "green" ? "#34D399" : st === "red" ? "#F87171" : "#5A7A9A", fontWeight: 600, fontSize: 11 }}>{fmt(val, m.type)}</span>
                            : <span style={{ color: "#162236", fontSize: 14 }}>·</span>
                          }
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </>
          ))}

          {/* Bottom padding */}
          <tr><td colSpan={3 + WEEKS.length} style={{ height: 40 }} /></tr>
        </tbody>
      </table>
    </div>
  );
}

const TH = {
  padding: "11px 8px", fontSize: 8, fontWeight: 700, letterSpacing: "0.14em",
  color: "#2A4460", textAlign: "center", borderRight: "1px solid #0F1E2E",
  whiteSpace: "nowrap", fontFamily: "'Sora', sans-serif"
};
const TD = {
  padding: "7px 8px", borderBottom: "1px solid #0C1824", borderRight: "1px solid #0C1824",
  whiteSpace: "nowrap"
};
const Dash = () => <span style={{ color: "#162236", fontSize: 10 }}>—</span>;


// ═══════════════════════════════════════════════════════════════
//  TARGETS MANAGEMENT VIEW
// ═══════════════════════════════════════════════════════════════
function TargetsView({ targets, setTargets, fileRef, onUpload }) {
  const [editId, setEditId] = useState("edwin");
  const [saved, setSaved] = useState(false);

  const activeSec = SECTIONS.find(s => s.id === editId);
  const editableSections = SECTIONS.filter(s => !s.hold);

  const updateTarget = (metricKey, value) => {
    setTargets(prev => ({
      ...prev,
      [editId]: { ...prev[editId], [metricKey]: value === "" ? null : Number(value) }
    }));
    setSaved(false);
  };

  const downloadTemplate = () => {
    const rows = [["section_id", "metric_key", "target_value", "higher_is_better"]];
    SECTIONS.forEach(sec => {
      sec.metrics.forEach(m => {
        if (!m.blank && !sec.hold) {
          rows.push([sec.id, m.key, targets[sec.id]?.[m.key] ?? "", m.up === null ? "" : m.up ? "true" : "false"]);
        }
      });
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([rows.map(r => r.join(",")).join("\n")], { type: "text/csv" }));
    a.download = "targets_template.csv";
    a.click();
  };

  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div style={{ padding: 28, maxWidth: 900 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "#D4E0EC" }}>Manage Targets</h2>
          <p style={{ fontSize: 11, color: "#2E4A60", marginTop: 3 }}>Set per-metric targets for the current quarter. Upload via CSV or edit inline.</p>
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn-outline" onClick={downloadTemplate} style={{
          background: "transparent", border: "1px solid #1E3A50", borderRadius: 8,
          color: "#4A6A8A", padding: "8px 16px", fontSize: 11, cursor: "pointer",
          fontFamily: "'Sora', sans-serif", transition: "all 0.12s"
        }}>↓ Download CSV Template</button>
        <button className="btn-outline" onClick={() => fileRef.current?.click()} style={{
          background: "transparent", border: "1px solid #1E3A50", borderRadius: 8,
          color: "#4A6A8A", padding: "8px 16px", fontSize: 11, cursor: "pointer",
          fontFamily: "'Sora', sans-serif", transition: "all 0.12s"
        }}>↑ Upload Targets CSV</button>
        <input ref={fileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={onUpload} />
      </div>

      {/* Section tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {editableSections.map(sec => (
          <button key={sec.id} onClick={() => setEditId(sec.id)} style={{
            padding: "6px 16px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 600,
            fontFamily: "'Sora', sans-serif", transition: "all 0.12s",
            background: editId === sec.id ? sec.accentColor : "#0F1E30",
            border: `1px solid ${editId === sec.id ? sec.accentColor : "#1E3A50"}`,
            color: editId === sec.id ? "#060F1C" : "#4A6A8A",
          }}>{sec.owner}</button>
        ))}
      </div>

      {/* Target table */}
      {activeSec && (
        <div style={{ background: "#060F1C", borderRadius: 12, border: "1px solid #162236", overflow: "hidden" }}>
          <div style={{
            padding: "14px 22px", background: "#0A1828",
            borderBottom: "1px solid #162236", display: "flex", alignItems: "center", gap: 10
          }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: activeSec.accentColor }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: activeSec.accentColor, letterSpacing: "0.08em", fontFamily: "'Sora', sans-serif" }}>
              {activeSec.title}
            </span>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#0A1828", borderBottom: "1px solid #162236" }}>
                <th style={{ ...TH, textAlign: "left", padding: "10px 22px", width: "55%" }}>METRIC</th>
                <th style={{ ...TH, width: "15%" }}>TYPE</th>
                <th style={{ ...TH, width: "15%" }}>DIRECTION</th>
                <th style={{ ...TH, width: "15%" }}>TARGET</th>
              </tr>
            </thead>
            <tbody>
              {activeSec.metrics.map((m, i) => (
                <tr key={m.key} style={{ background: i % 2 === 0 ? "#0B1628" : "#0D1C30" }}>
                  <td style={{ ...TD, padding: "10px 22px", color: m.blank ? "#243040" : "#8AAAC0", fontFamily: "'Sora', sans-serif" }}>
                    {m.label}
                    {m.blank && <span style={{ marginLeft: 8, fontSize: 8, color: "#162236", background: "#0C1824", padding: "2px 6px", borderRadius: 3, fontWeight: 700, letterSpacing: "0.1em" }}>BLANK</span>}
                  </td>
                  <td style={{ ...TD, textAlign: "center", color: "#2A4060", fontSize: 10 }}>{m.type}</td>
                  <td style={{ ...TD, textAlign: "center" }}>
                    {m.up === true && <span style={{ color: "#34D399", fontSize: 10 }}>▲ Higher</span>}
                    {m.up === false && <span style={{ color: "#F87171", fontSize: 10 }}>▼ Lower</span>}
                    {m.up === null && <span style={{ color: "#2A4060", fontSize: 10 }}>— N/A</span>}
                    {m.blank && <span style={{ color: "#1E3050", fontSize: 10 }}>—</span>}
                  </td>
                  <td style={{ ...TD, textAlign: "center" }}>
                    {m.blank
                      ? <span style={{ color: "#162236", fontSize: 10 }}>not applicable</span>
                      : <input
                        type="number"
                        value={targets[editId]?.[m.key] ?? ""}
                        onChange={e => updateTarget(m.key, e.target.value)}
                        placeholder="—"
                        style={{
                          background: "#0F1E30", border: "1px solid #1E3A50", borderRadius: 7,
                          color: "#C9A252", fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600,
                          fontSize: 12, padding: "6px 10px", width: 90, textAlign: "center",
                          transition: "border-color 0.15s"
                        }}
                      />
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ padding: "14px 22px", borderTop: "1px solid #162236", display: "flex", justifyContent: "flex-end" }}>
            <button onClick={handleSave} style={{
              background: saved ? "#1A3A28" : activeSec.accentColor,
              border: "none", borderRadius: 8,
              color: saved ? "#34D399" : "#060F1C",
              padding: "8px 24px", fontSize: 11, fontWeight: 800,
              cursor: "pointer", fontFamily: "'Sora', sans-serif",
              transition: "all 0.2s"
            }}>
              {saved ? "✓ Saved" : "Save Targets"}
            </button>
          </div>
        </div>
      )}

      {/* CSV format reference */}
      <div style={{ marginTop: 20, padding: 18, background: "#060F1C", borderRadius: 10, border: "1px solid #0F1E30" }}>
        <div style={{ fontSize: 9, color: "#2A4060", fontWeight: 700, letterSpacing: "0.14em", marginBottom: 10 }}>CSV FORMAT REFERENCE</div>
        <code style={{ fontSize: 10, color: "#3A5A78", fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1.8, display: "block" }}>
          section_id,metric_key,target_value,higher_is_better<br />
          edwin,total_leads,60,true<br />
          edwin,pct_contacted_sla,80,true<br />
          edwin,conversion_pct,5,true<br />
          adarsh,total_leads,60,true<br />
          deeksha,cpl,600,false<br />
          deeksha,total_leads,200,true
        </code>
        <div style={{ marginTop: 12, fontSize: 10, color: "#1E3050" }}>
          ↑ Download Template CSV to get a pre-filled file with all metric keys and current targets.
        </div>
      </div>
    </div>
  );
}

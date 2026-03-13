/**
 * compute_scorecard.cjs
 *
 * Computes all EOS Scorecard metrics for Q1 FY2026 (Wk1-Wk13)
 * from live Supabase raw tables and upserts into scorecard_weekly_data.
 *
 * Metrics computed automatically:
 *   MARKETING: Total Leads Generated, Total Qualified Leads,
 *              Total Spend incl. GST, CPL, CPQL
 *   SALES (Adarsh & Ashok combined):
 *              Total No. of Leads Taken, % Leads Contacted per SLA,
 *              % Leads Connected, % Quote Sent, Conversion %,
 *              No. of Bookings, % Follow-ups Done per SLA
 *
 * Manual metrics left untouched: GM ROAS, Average Booking Value, Advance Received
 *
 * Usage: node compute_scorecard.cjs
 */

const https = require('https');

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL = 'https://gsawzusvwujowkjcftzi.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzYXd6dXN2d3Vqb3dramNmdHppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODk4ODEzMywiZXhwIjoyMDg0NTY0MTMzfQ.j_XdQU8zODin_bMJxXgA95_3N3ke6trXCPGtZT76YYM';

// Q1 FY2026: Jan 1 – Mar 31, 2026 (13 weeks)
const QUARTER_START = new Date('2026-01-01T00:00:00Z');
const QUARTER_END   = new Date('2026-04-01T00:00:00Z');

// 13 week buckets — dates match scorecard_dashboard.jsx WEEKS array
const WEEKS = Array.from({ length: 13 }, (_, i) => {
  const start = new Date(QUARTER_START);
  start.setDate(start.getDate() + i * 7);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return {
    num: i + 1,
    start,
    end,
    dateValue: start.toISOString().split('T')[0], // week_start_date in DB
  };
});

// Qualified lead statuses (from Scorecard_Calculations.md)
const QUALIFIED_STATUSES = new Set([
  'Changes Required',
  'Customer Quote Reviewing',
  'First Payment Done',
  'Initial Deposit',
  'Negotiation',
  'Negotiation Stage',
  'Post Quote | Indiscussion | FU 1',
  'Post Quote | Indiscussion | FU 2',
  'Post Quote | Indiscussion | FU 3',
  'Post Quote | Indiscussion | FU 4',
  'Post Quote | No Response 1',
  'Post Quote | No Response 2',
  'Post Quote | No Response 3',
  'Post Quote | No Response 4',
  'Qualified',
  'Qualified | FIT',
  'Qualified | GIT',
  'Quote Explained',
  'Quote Sent',
  'Revised Quote Sent',
]);

const WON_STATUS = 'First Payment Done';

// Team email local-parts (before @) — handles .com and .co variants
const ADARSH_TEAM = new Set([
  'adarsh.raheja', 'amit.barik', 'santosh.rai', 'soni.singh',
  'pratik.gupta', 'anand.narayan', 'ashamp.kumar', 'damanpreet.kaur',
  'dheeraj.sharma', 'faizan.khan', 'puneet.upadhyay', 'zaid.jahangir',
]);

const ASHOK_TEAM = new Set([
  'ashok.pednekar', 'aditya.singh', 'amruta.thakur', 'bharat.dubey',
  'bharat.mali', 'chandani.yede', 'harshil.desai', 'juned.khan',
  'princy.kunjumon', 'rakesh.dornala', 'rohit.kumar', 'shakil.khan',
  'shaktisinh.jadeja', 'yogita.saxena', 'aditya.sathe',
]);

const EDWIN_TEAM = new Set([
  'edwin.rajappan', 'ashish.nigam', 'astik.dubey', 'hemant.singh',
  'hushendra.kajania', 'kavita.kumari', 'mohd.hamza', 'rahul.menaria',
  'rahul.rai', 'riya.tyagi', 'sumit.kumar', 'syed.shah',
  'tejal.choudhary', 'vaishali.singh',
]);

// Metrics that are MANUAL (never overwritten by this script)
// NOTE: GM ROAS, Average Booking Value, Advance Received are now AUTO-computed
//       from the bookings table — removed from this set.
const MANUAL_METRIC_NAMES = new Set([]);

// IST offset in ms (UTC+5:30)
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// ── Supabase helpers ──────────────────────────────────────────────────────────

function supaReq(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: 'gsawzusvwujowkjcftzi.supabase.co',
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': KEY,
        'Authorization': `Bearer ${KEY}`,
        'Prefer': method === 'GET' ? 'count=exact' : 'return=minimal',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(opts, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode} ${path}: ${buf.slice(0, 200)}`));
        else { try { resolve(JSON.parse(buf)); } catch { resolve(buf); } }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function fetchAllPages(endpoint, batchSize = 1000) {
  const rows = [];
  let offset = 0;
  while (true) {
    const sep = endpoint.includes('?') ? '&' : '?';
    const page = await supaReq(`${endpoint}${sep}limit=${batchSize}&offset=${offset}`);
    if (!Array.isArray(page) || page.length === 0) break;
    rows.push(...page);
    if (page.length < batchSize) break;
    offset += batchSize;
    process.stdout.write('.');
  }
  return rows;
}

// ── Date / week helpers ───────────────────────────────────────────────────────

function getWeekIndex(isoDateStr) {
  if (!isoDateStr) return -1;
  const d = new Date(isoDateStr);
  for (let i = 0; i < WEEKS.length; i++) {
    if (d >= WEEKS[i].start && d < WEEKS[i].end) return i;
  }
  return -1;
}

function emailLocal(email) {
  return (email || '').split('@')[0].toLowerCase();
}

function inTeam(email, teamSet) {
  return teamSet.has(emailLocal(email));
}

// First-name → team lookup (fallback when sales_email is absent)
// Built from team sets: first word of the local-part (before first dot)
const FIRSTNAME_TO_TEAM = {};
for (const local of ADARSH_TEAM) {
  const fn = local.split('.')[0];
  FIRSTNAME_TO_TEAM[fn] = 'AA';
}
for (const local of ASHOK_TEAM) {
  const fn = local.split('.')[0];
  FIRSTNAME_TO_TEAM[fn] = 'AA'; // Adarsh+Ashok combined
}
for (const local of EDWIN_TEAM) {
  const fn = local.split('.')[0];
  FIRSTNAME_TO_TEAM[fn] = 'ED';
}

function getTeamFromBooking(b) {
  // Prefer email match
  if (b.sales_email) {
    const isAA = inTeam(b.sales_email, ADARSH_TEAM) || inTeam(b.sales_email, ASHOK_TEAM);
    const isEd = inTeam(b.sales_email, EDWIN_TEAM);
    return { isAA, isEd };
  }
  // Fallback: first-name match from sales_by (e.g. "Hushendra", "Ashish")
  if (b.sales_by) {
    const fn = b.sales_by.trim().split(/\s+/)[0].toLowerCase();
    const team = FIRSTNAME_TO_TEAM[fn];
    return { isAA: team === 'AA', isEd: team === 'ED' };
  }
  return { isAA: false, isEd: false };
}

// ── SLA helpers (60 business minutes) ────────────────────────────────────────
// Business hours: 10:00–20:00 IST, Mon–Sat

function toIST(d) {
  return new Date(d.getTime() + IST_OFFSET_MS);
}

function isBusinessDay(istDate) {
  const day = istDate.getUTCDay(); // 0=Sun, 6=Sat
  return day !== 0; // Mon-Sat
}

function businessDayStart(istDate) {
  // Returns IST datetime for 10:00 AM on the given IST day
  return new Date(Date.UTC(
    istDate.getUTCFullYear(), istDate.getUTCMonth(), istDate.getUTCDate(),
    10, 0, 0, 0
  ));
}

function nextBusinessOpen(utcDate) {
  // Returns the UTC datetime when the SLA clock should start for a given lead creation time
  let ist = toIST(utcDate);
  // Normalise: move to next day if after 20:00 IST or on Sunday
  const istHour = ist.getUTCHours();
  const istMin  = ist.getUTCMinutes();
  const totalMinutes = istHour * 60 + istMin;

  if (isBusinessDay(ist) && totalMinutes >= 10 * 60 && totalMinutes < 20 * 60) {
    // Within business hours — SLA clock starts immediately
    return utcDate;
  }

  // Move to next business day 10:00 IST
  let candidate = new Date(ist);
  if (totalMinutes >= 20 * 60) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  // Skip Sundays
  while (!isBusinessDay(candidate)) {
    candidate.setUTCDate(candidate.getUTCDate() + 1);
  }
  const openIST = businessDayStart(candidate); // IST 10:00 as UTC
  // Convert back to UTC
  return new Date(openIST.getTime() - IST_OFFSET_MS);
}

function isContactedWithinSLA(createdOnStr, firstCallStr) {
  if (!firstCallStr) return false;
  const created = new Date(createdOnStr);
  const firstCall = new Date(firstCallStr);
  const slaStart = nextBusinessOpen(created);
  const slaDeadline = new Date(slaStart.getTime() + 60 * 60 * 1000); // +60 min
  return firstCall <= slaDeadline;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const t0 = Date.now();

  // 1. Load metric IDs from config
  console.log('\n1. Loading scorecard_metrics_config…');
  const config = await supaReq('/rest/v1/scorecard_metrics_config?select=id,metric_name,category,owner&order=display_order');
  const metricByName = {};
  config.forEach(m => { metricByName[m.metric_name] = m; });
  console.log(`   ${config.length} metrics loaded.`);

  // Collect auto-computed metric IDs to delete old values
  const autoMetricIds = config
    .filter(m => !MANUAL_METRIC_NAMES.has(m.metric_name))
    .map(m => m.id);

  // Helper
  const mid = name => metricByName[name]?.id;

  // 2. Fetch raw leads for Q1 2026
  console.log('\n2. Fetching raw_leads for Q1 2026…');
  const leadsRaw = await fetchAllPages(
    `/rest/v1/raw_leads?select=telecrm_id,created_on,is_deleted,assignee_email,status,first_call_date&created_on=gte.2026-01-01T00:00:00&created_on=lt.2026-04-01T00:00:00`
  );
  const leads = leadsRaw.filter(l => !l.is_deleted);
  console.log(`\n   ${leads.length} active leads loaded.`);

  // 3. Fetch call logs for Q1 2026 (to detect meaningful connections per lead)
  console.log('\n3. Fetching raw_call_logs for Q1 2026…');
  const callLogs = await fetchAllPages(
    `/rest/v1/raw_call_logs?select=lead_telecrm_id,agent_email,is_meaningful_connect&call_started_at=gte.2026-01-01T00:00:00`
  );
  console.log(`\n   ${callLogs.length} call log rows loaded.`);

  // Build set of lead_telecrm_ids that had a meaningful connection
  const meaningfulLeads = new Set();
  callLogs.forEach(c => {
    if (c.is_meaningful_connect) meaningfulLeads.add(c.lead_telecrm_id);
  });

  // 4. Fetch tasks for Q1 2026 (for follow-up SLA metric)
  console.log('\n4. Fetching raw_tasks for Q1 2026…');
  const tasks = await fetchAllPages(
    `/rest/v1/raw_tasks?select=assignee_email,due_at,is_completed_on_time&due_at=gte.2026-01-01T00:00:00&due_at=lt.2026-04-01T00:00:00`
  );
  console.log(`\n   ${tasks.length} task rows loaded.`);

  // 5. Fetch bookings from Google Sheet sync (Q1 2026)
  console.log('\n5. Fetching bookings for Q1 2026…');
  const bookingsRaw = await fetchAllPages(
    `/rest/v1/bookings?select=query_id,sales_date,sales_by,sales_email,selling_price_inr,advance_received_inr,margin&sales_date=gte.2026-01-01&sales_date=lt.2026-04-01`
  );
  console.log(`\n   ${bookingsRaw.length} booking rows loaded.`);

  // 5b. Fetch ad spend for Q1 2026
  console.log('\n6. Fetching ad spend for Q1 2026…');
  const fbAds = await fetchAllPages(
    `/rest/v1/facebook_ads?select=date,spend&date=gte.2026-01-01&date=lt.2026-04-01`
  );
  const gAds = await fetchAllPages(
    `/rest/v1/google_ads?select=date,spend&date=gte.2026-01-01&date=lt.2026-04-01`
  );
  console.log(`\n   ${fbAds.length + gAds.length} ad spend rows loaded.`);

  // ── Aggregate ────────────────────────────────────────────────────────────────

  console.log('\n7. Aggregating metrics…');

  // Initialise per-week buckets
  const mkt = WEEKS.map(() => ({ leads: 0, qualified: 0, spend: 0 }));
  const salesAA = WEEKS.map(() => ({ total: 0, sla: 0, connected: 0, quoted: 0, won: 0, bookings: 0 }));
  const salesEd = WEEKS.map(() => ({ total: 0, sla: 0, connected: 0, quoted: 0, won: 0, bookings: 0 }));
  const salesAll = WEEKS.map(() => ({ total: 0, sla: 0, connected: 0, quoted: 0, won: 0, bookings: 0 }));
  const tasksSalesAA  = WEEKS.map(() => ({ due: 0, onTime: 0 }));
  const tasksSalesEd  = WEEKS.map(() => ({ due: 0, onTime: 0 }));
  const tasksSalesAll = WEEKS.map(() => ({ due: 0, onTime: 0 }));
  const tasksAll = WEEKS.map(() => ({ due: 0, onTime: 0 })); // for marketing (all)

  // Bookings financial buckets (from Google Sheet sync)
  const bkgAA  = WEEKS.map(() => ({ count: 0, selling: 0, advance: 0, margin: 0 }));
  const bkgEd  = WEEKS.map(() => ({ count: 0, selling: 0, advance: 0, margin: 0 }));
  const bkgAll = WEEKS.map(() => ({ count: 0, selling: 0, advance: 0, margin: 0 }));

  // --- Leads ---
  leads.forEach(l => {
    const wi = getWeekIndex(l.created_on);
    if (wi === -1) return;

    const isQualified = QUALIFIED_STATUSES.has(l.status);
    const isWon = l.status === WON_STATUS;
    const isSlaContacted = isContactedWithinSLA(l.created_on, l.first_call_date);
    const isConnected = meaningfulLeads.has(l.telecrm_id);

    // Marketing (all leads)
    mkt[wi].leads++;
    if (isQualified) mkt[wi].qualified++;

    // Team assignment
    const isAA  = inTeam(l.assignee_email, ADARSH_TEAM) || inTeam(l.assignee_email, ASHOK_TEAM);
    const isEd  = inTeam(l.assignee_email, EDWIN_TEAM);
    const isAny = isAA || isEd;

    if (isAA) {
      salesAA[wi].total++;
      if (isSlaContacted) salesAA[wi].sla++;
      if (isConnected)    salesAA[wi].connected++;
      if (isQualified)    salesAA[wi].quoted++;
      if (isWon)          { salesAA[wi].won++; salesAA[wi].bookings++; }
    }
    if (isEd) {
      salesEd[wi].total++;
      if (isSlaContacted) salesEd[wi].sla++;
      if (isConnected)    salesEd[wi].connected++;
      if (isQualified)    salesEd[wi].quoted++;
      if (isWon)          { salesEd[wi].won++; salesEd[wi].bookings++; }
    }
    if (isAny) {
      salesAll[wi].total++;
      if (isSlaContacted) salesAll[wi].sla++;
      if (isConnected)    salesAll[wi].connected++;
      if (isQualified)    salesAll[wi].quoted++;
      if (isWon)          { salesAll[wi].won++; salesAll[wi].bookings++; }
    }
  });

  // --- Tasks (follow-up SLA) ---
  tasks.forEach(t => {
    const wi = getWeekIndex(t.due_at);
    if (wi === -1) return;
    const onTime = !!t.is_completed_on_time;
    const isAA  = inTeam(t.assignee_email, ADARSH_TEAM) || inTeam(t.assignee_email, ASHOK_TEAM);
    const isEd  = inTeam(t.assignee_email, EDWIN_TEAM);

    tasksAll[wi].due++;
    if (onTime) tasksAll[wi].onTime++;

    if (isAA) { tasksSalesAA[wi].due++; if (onTime) tasksSalesAA[wi].onTime++; }
    if (isEd) { tasksSalesEd[wi].due++; if (onTime) tasksSalesEd[wi].onTime++; }
    if (isAA || isEd) { tasksSalesAll[wi].due++; if (onTime) tasksSalesAll[wi].onTime++; }
  });

  // --- Bookings (Google Sheet) ---
  bookingsRaw.forEach(b => {
    const wi = getWeekIndex(b.sales_date + 'T00:00:00Z');
    if (wi === -1) return;
    const selling = Number(b.selling_price_inr || 0);
    const advance = Number(b.advance_received_inr || 0);
    const margin  = Number(b.margin || 0);
    const { isAA, isEd } = getTeamFromBooking(b);
    if (isAA) {
      bkgAA[wi].count++;  bkgAA[wi].selling += selling;
      bkgAA[wi].advance += advance; bkgAA[wi].margin += margin;
    }
    if (isEd) {
      bkgEd[wi].count++;  bkgEd[wi].selling += selling;
      bkgEd[wi].advance += advance; bkgEd[wi].margin += margin;
    }
    if (isAA || isEd) {
      bkgAll[wi].count++;  bkgAll[wi].selling += selling;
      bkgAll[wi].advance += advance; bkgAll[wi].margin += margin;
    }
  });

  // --- Ad spend (ex-GST × 1.18) ---
  [...fbAds, ...gAds].forEach(row => {
    const wi = getWeekIndex(row.date + 'T00:00:00Z');
    if (wi === -1) return;
    mkt[wi].spend += Number(row.spend || 0) * 1.18;
  });

  // ── Build weekly_data rows ────────────────────────────────────────────────

  console.log('\n8. Building scorecard_weekly_data rows…');
  const rows = [];

  const pct  = (n, d) => d > 0 ? Math.round((n / d) * 1000) / 10 : null; // 1 decimal
  const round2 = v => Math.round(v * 100) / 100;

  WEEKS.forEach((wk, i) => {
    const m   = mkt[i];
    const aa  = salesAA[i];
    const ed  = salesEd[i];
    const al  = salesAll[i];
    const taa = tasksSalesAA[i];
    const ted = tasksSalesEd[i];
    const tal = tasksSalesAll[i];
    const baa = bkgAA[i];
    const bed = bkgEd[i];
    const bal = bkgAll[i];

    function push(metricName, value) {
      const id = mid(metricName);
      if (!id || value === null || value === undefined) return;
      rows.push({ metric_id: id, week_start_date: wk.dateValue, value });
    }

    // Marketing
    push('Total Leads Generated',   m.leads || null);
    push('Total Qualified Leads',   m.qualified || null);
    push('Total Spend incl. GST',   m.spend > 0 ? round2(m.spend) : null);
    push('Cost Per Lead (CPL)',      m.leads > 0 && m.spend > 0 ? round2(m.spend / m.leads) : null);
    push('Cost Per Qualified Lead', m.qualified > 0 && m.spend > 0 ? round2(m.spend / m.qualified) : null);
    // GM ROAS = Total Margin / Total Ad Spend (all teams combined)
    push('GM ROAS', bal.margin > 0 && m.spend > 0 ? round2(bal.margin / m.spend) : null);

    // Sales – All (Adarsh + Ashok + Edwin combined)
    push('Total No. of Leads Taken',        al.total || null);
    push('% Leads Contacted as per SLA',    pct(al.sla, al.total));
    push('% Leads Connected',               pct(al.connected, al.total));
    push('% Quote Sent',                    pct(al.quoted, al.total));
    push('Conversion %',                    pct(al.won, al.total));
    push('% Follow-ups Done as per SLA',    pct(tal.onTime, tal.due));
    // Booking financials – All teams combined (Adarsh + Ashok + Edwin)
    push('No. of Bookings',        bal.count   || null);
    push('Average Booking Value',  bal.count   > 0 ? round2(bal.selling / bal.count) : null);
    push('Advance Received',       bal.advance > 0 ? round2(bal.advance) : null);
  });

  console.log(`   ${rows.length} rows to upsert.`);

  // ── Delete old auto-computed values, then insert fresh ───────────────────

  if (autoMetricIds.length > 0) {
    console.log('\n9. Deleting stale auto-computed entries…');
    const idList = autoMetricIds.map(id => `"${id}"`).join(',');
    await supaReq(
      `/rest/v1/scorecard_weekly_data?metric_id=in.(${autoMetricIds.join(',')})`,
      'DELETE'
    );
    console.log('   Done.');
  }

  if (rows.length > 0) {
    console.log('\n10. Inserting fresh computed data…');
    // Insert in chunks of 200
    for (let i = 0; i < rows.length; i += 200) {
      await supaReq('/rest/v1/scorecard_weekly_data', 'POST', rows.slice(i, i + 200));
      process.stdout.write('.');
    }
    console.log(`\n   ${rows.length} rows inserted.`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────

  console.log('\n══════════════════════════════════════════');
  console.log('SCORECARD COMPUTE COMPLETE');
  console.log(`Elapsed: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log('\nWeek-by-week summary (Adarsh & Ashok):');
  console.log('Wk  | Leads | SLA% | Conn% | Quote% | Conv% | Bookings');
  WEEKS.forEach((wk, i) => {
    const aa = salesAA[i];
    if (aa.total === 0) return;
    console.log(
      `W${String(wk.num).padStart(2)} | ${String(aa.total).padStart(5)} | ` +
      `${String(pct(aa.sla,aa.total) ?? '—').padStart(4)} | ` +
      `${String(pct(aa.connected,aa.total) ?? '—').padStart(5)} | ` +
      `${String(pct(aa.quoted,aa.total) ?? '—').padStart(6)} | ` +
      `${String(pct(aa.won,aa.total) ?? '—').padStart(5)} | ` +
      `${aa.bookings}`
    );
  });

  console.log('\nWeek-by-week summary (Marketing):');
  console.log('Wk  | Leads | Qual | Spend (incl GST) | CPL');
  WEEKS.forEach((wk, i) => {
    const m = mkt[i];
    if (m.leads === 0) return;
    const cpl = m.leads > 0 && m.spend > 0 ? Math.round(m.spend / m.leads) : '—';
    console.log(
      `W${String(wk.num).padStart(2)} | ${String(m.leads).padStart(5)} | ` +
      `${String(m.qualified).padStart(4)} | ` +
      `${String(Math.round(m.spend)).padStart(16)} | ${cpl}`
    );
  });
  console.log('══════════════════════════════════════════\n');
}

run().catch(err => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});

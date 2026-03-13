/**
 * import_scorecard.cjs
 * 1. Adds missing metrics (14, 15) to scorecard_metrics_config
 * 2. Imports 6 weeks of weekly data from Company_Scorecard.xlsx
 *    into scorecard_weekly_data (Wk1=2026-01-01 … Wk6=2026-02-05)
 *
 * Usage: node import_scorecard.cjs
 */

const XLSX = require('xlsx');
const https = require('https');

const SUPABASE_URL = 'https://gsawzusvwujowkjcftzi.supabase.co';
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzYXd6dXN2d3Vqb3dramNmdHppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODk4ODEzMywiZXhwIjoyMDg0NTY0MTMzfQ.j_XdQU8zODin_bMJxXgA95_3N3ke6trXCPGtZT76YYM';

// Week 1 = 2026-01-01 (QUARTER_START), each week +7 days
const WEEK_DATES = Array.from({ length: 6 }, (_, i) => {
  const d = new Date('2026-01-01');
  d.setDate(d.getDate() + i * 7);
  return d.toISOString().split('T')[0];
});
console.log('Week dates:', WEEK_DATES);

// ── Supabase helpers ─────────────────────────────────────────────────────────

function supaRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + path);
    const data = body ? JSON.stringify(body) : '';
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': KEY,
        'Authorization': `Bearer ${KEY}`,
        'Prefer': 'return=representation',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(opts, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        if (res.statusCode >= 400) reject(new Error(`HTTP ${res.statusCode}: ${buf}`));
        else { try { resolve(JSON.parse(buf)); } catch { resolve(buf); } }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ── Excel data ───────────────────────────────────────────────────────────────

const wb = XLSX.readFile('Company_Scorecard.xlsx');
const ws = wb.Sheets['Company Scorecard'];
const rows = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });

// Rows 5–10 = metrics 1–6 (marketing), row indices 5-10, data cols 4-9
// Rows 12–20 = metrics 7–15 (sales), no data yet
const METRIC_ROWS = rows.filter(r => typeof r[0] === 'number');

// Build metric_name → weekly values map
const excelData = {};
METRIC_ROWS.forEach(r => {
  const name = String(r[2]).trim();
  const values = [r[4], r[5], r[6], r[7], r[8], r[9]];
  excelData[name] = values;
});

async function run() {
  // 1. Fetch existing metrics config
  console.log('\n1. Fetching scorecard_metrics_config…');
  const config = await supaRequest('/rest/v1/scorecard_metrics_config?select=id,metric_name,display_order&order=display_order', 'GET', null);
  console.log(`   Found ${config.length} metrics in DB.`);

  const metricByName = {};
  config.forEach(m => { metricByName[m.metric_name] = m; });

  // 2. Add missing metrics (14, 15)
  const missing = [
    { category: 'SALES PERFORMANCE', owner: 'Adarsh & Ashok', metric_name: 'Advance Received',              display_order: 14 },
    { category: 'SALES PERFORMANCE', owner: 'Adarsh & Ashok', metric_name: '% Follow-ups Done as per SLA', display_order: 15 },
  ].filter(m => !metricByName[m.metric_name]);

  if (missing.length > 0) {
    console.log(`\n2. Inserting ${missing.length} missing metrics…`);
    const inserted = await supaRequest('/rest/v1/scorecard_metrics_config', 'POST', missing);
    inserted.forEach(m => { metricByName[m.metric_name] = m; });
    console.log('   Done:', missing.map(m => m.metric_name).join(', '));
  } else {
    console.log('\n2. No missing metrics to add.');
  }

  // 3. Build weekly data upserts
  console.log('\n3. Building weekly data…');
  const weeklyRows = [];

  Object.entries(excelData).forEach(([metricName, values]) => {
    const metric = metricByName[metricName];
    if (!metric) {
      console.warn(`   WARNING: metric not found in DB: "${metricName}"`);
      return;
    }
    values.forEach((val, i) => {
      if (val !== '' && val !== null && val !== undefined) {
        weeklyRows.push({
          metric_id: metric.id,
          week_start_date: WEEK_DATES[i],
          value: Number(val),
        });
      }
    });
  });

  console.log(`   Prepared ${weeklyRows.length} weekly data points.`);

  if (weeklyRows.length === 0) {
    console.log('   Nothing to insert.');
    return;
  }

  // 4. Upsert (replace existing values for same metric+week)
  console.log('\n4. Upserting into scorecard_weekly_data…');
  const result = await supaRequest(
    '/rest/v1/scorecard_weekly_data',
    'POST',
    weeklyRows
  );
  console.log(`   Inserted ${Array.isArray(result) ? result.length : '?'} rows.`);

  // Summary
  console.log('\n=== Summary ===');
  Object.entries(excelData).forEach(([name, vals]) => {
    const filled = vals.filter(v => v !== '' && v !== null).length;
    if (filled > 0) console.log(`  ${name}: ${filled} weeks of data`);
  });
}

run().catch(err => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});

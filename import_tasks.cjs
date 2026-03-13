/**
 * import_tasks.cjs
 * Reads Master Task List from Project_Tracker.xlsx and upserts all
 * tasks into Supabase eos_tasks table.
 *
 * Usage: node import_tasks.cjs
 */

const XLSX = require('xlsx');
const https = require('https');

const SUPABASE_URL = 'https://gsawzusvwujowkjcftzi.supabase.co';
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdzYXd6dXN2d3Vqb3dramNmdHppIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODk4ODEzMywiZXhwIjoyMDg0NTY0MTMzfQ.j_XdQU8zODin_bMJxXgA95_3N3ke6trXCPGtZT76YYM';

// ── Date helpers ─────────────────────────────────────────────────────────────

function excelSerialToISO(serial) {
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return date.toISOString().split('T')[0];
}

const TEXT_DATE_MAP = {
  '1 april':  '2026-04-01',
  '6 april':  '2026-04-06',
  '13 april': '2026-04-13',
};

function resolveDeadline(raw, status) {
  if (!raw && status === 'Done') return '2026-03-13'; // today fallback
  if (!raw) return '2026-03-13';
  if (typeof raw === 'number') return excelSerialToISO(raw);
  const s = String(raw).trim().toLowerCase();
  if (s === 'done' || s === '—' || s === '') return '2026-03-13';
  if (TEXT_DATE_MAP[s]) return TEXT_DATE_MAP[s];
  // Try native parse (ISO or already valid)
  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return '2026-03-13';
}

// ── Load & clean tasks ────────────────────────────────────────────────────────

const wb = XLSX.readFile('Project_Tracker.xlsx');
const ws = wb.Sheets['Master Task List'];
const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

const tasks = rows
  .filter(r => r['#'] && r['Task'] && String(r['Task']).trim() !== '')
  .map(r => {
    const status = String(r['Status'] || 'Scheduled').trim();
    const deadline = resolveDeadline(r['Deadline'], status);
    return {
      workstream: String(r['Issue / Workstream'] || 'General').trim(),
      task_name:  String(r['Task']).trim(),
      owner:      String(r['Owner'] || '—').trim(),
      deadline,
      status: ['Overdue', 'Due Today', 'Upcoming', 'Scheduled', 'Done', 'TBD'].includes(status)
        ? (status === 'TBD' ? 'Scheduled' : status)
        : 'Scheduled',
    };
  });

console.log(`Parsed ${tasks.length} tasks from Excel.`);

// ── Supabase REST upsert ──────────────────────────────────────────────────────

function supabaseRequest(path, method, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + path);
    const data = JSON.stringify(body);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'Prefer': 'return=representation',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = https.request(options, res => {
      let buf = '';
      res.on('data', d => buf += d);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${buf}`));
        } else {
          try { resolve(JSON.parse(buf)); }
          catch { resolve(buf); }
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  // 1. Clear existing tasks so we get a clean import
  console.log('Clearing existing eos_tasks…');
  await supabaseRequest('/rest/v1/eos_tasks?id=neq.00000000-0000-0000-0000-000000000000', 'DELETE', {});
  console.log('Cleared.');

  // 2. Insert all tasks in one batch
  console.log(`Inserting ${tasks.length} tasks…`);
  const result = await supabaseRequest('/rest/v1/eos_tasks', 'POST', tasks);
  const count = Array.isArray(result) ? result.length : '?';
  console.log(`Done. ${count} tasks inserted into eos_tasks.`);

  // Print summary
  const byStatus = tasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});
  console.log('\nSummary by status:');
  Object.entries(byStatus).forEach(([s, n]) => console.log(`  ${s}: ${n}`));

  const byWS = tasks.reduce((acc, t) => {
    acc[t.workstream] = (acc[t.workstream] || 0) + 1;
    return acc;
  }, {});
  console.log('\nSummary by workstream:');
  Object.entries(byWS).forEach(([w, n]) => console.log(`  ${w}: ${n}`));
}

run().catch(err => {
  console.error('Import failed:', err.message);
  process.exit(1);
});

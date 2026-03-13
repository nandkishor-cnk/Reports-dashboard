/**
 * Cox & Kings — Bookings Sheet → Supabase Sync
 * ─────────────────────────────────────────────
 * Paste this entire file into Google Apps Script (Extensions → Apps Script).
 *
 * SETUP (one-time):
 *   1. Click ⚙ Project Settings → Script Properties → Add:
 *        SUPABASE_URL  = https://gsawzusvwujowkjcftzi.supabase.co
 *        SUPABASE_KEY  = <service role key from .env.local>
 *   2. Run syncBookings() once manually to authorise.
 *   3. Add a trigger: Triggers → Add Trigger → syncBookings → Time-driven → Every hour
 *      (or choose "From spreadsheet → On edit" for instant sync)
 *
 * SHEET COLUMNS (order doesn't matter — matched by header name):
 *   Query ID | Sales Date | Customer Details | Nature of Booking | Particulars
 *   Mark UP (INR) | Sales BY | Sales Email | Selling Price (INR) | Vendor Liability
 *   Advance Received (INR) | Tax (INR) | TCS (INR) | Margin
 */

// ── Config ─────────────────────────────────────────────────────────────────

const SHEET_NAME = 'Sheet1'; // Change if your tab has a different name
const BATCH_SIZE = 200;

// Month abbreviation → zero-padded month number (for "01-Mar-26" date format)
const MONTH_MAP = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

// Header → Supabase column mapping
const HEADER_MAP = {
  'Query ID':               'query_id',
  'Sales Date':             'sales_date',
  'Customer Details':       'customer_details',
  'Nature of Booking':      'nature_of_booking',
  'Particulars':            'particulars',
  'Mark UP (INR)':          'mark_up_inr',
  'Sales BY':               'sales_by',
  'Sales Email':            'sales_email',        // add this column to your sheet
  'Selling Price (INR)':    'selling_price_inr',
  'Vendor Liability':       'vendor_liability',
  'Advance Received (INR)': 'advance_received_inr',
  'Tax (INR)':              'tax_inr',
  'TCS (INR)':              'tcs_inr',
  'Margin':                 'margin',
};

// ── Main sync function ──────────────────────────────────────────────────────

function syncBookings() {
  const props  = PropertiesService.getScriptProperties();
  const url    = props.getProperty('SUPABASE_URL');
  const apiKey = props.getProperty('SUPABASE_KEY');

  if (!url || !apiKey) {
    throw new Error('SUPABASE_URL and SUPABASE_KEY must be set in Script Properties.');
  }

  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) throw new Error(`Sheet "${SHEET_NAME}" not found.`);

  const data = sheet.getDataRange().getValues();

  // Find the header row — search first 5 rows for one that contains "Query ID"
  let headerRowIdx = -1;
  for (let r = 0; r < Math.min(5, data.length); r++) {
    const clean = data[r].map(h => String(h).replace(/^\uFEFF/, '').trim());
    if (clean.some(h => h === 'Query ID')) { headerRowIdx = r; break; }
  }
  if (headerRowIdx === -1) {
    throw new Error('"Query ID" column not found in the first 5 rows. Check the sheet tab name and header spelling.');
  }

  // Build column index map (strip BOM + whitespace from every header)
  const colIndex = {};
  data[headerRowIdx].forEach((h, i) => {
    const key = String(h).replace(/^\uFEFF/, '').trim();
    if (HEADER_MAP[key]) colIndex[HEADER_MAP[key]] = i;
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Parse dates: handles Date objects, "01-Mar-26", "2026-03-01", "01/03/2026"
  function parseDate(val) {
    if (!val && val !== 0) return null;
    if (val instanceof Date) {
      return Utilities.formatDate(val, 'Asia/Kolkata', 'yyyy-MM-dd');
    }
    const s = String(val).trim();
    if (!s) return null;
    // "01-Mar-26" or "01-Mar-2026"
    const dmyAbbr = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
    if (dmyAbbr) {
      const [, d, mon, y] = dmyAbbr;
      const mm = MONTH_MAP[mon.toLowerCase()];
      const yyyy = y.length === 2 ? '20' + y : y;
      return `${yyyy}-${mm}-${d.padStart(2, '0')}`;
    }
    // "01/03/2026" or "01-03-2026"
    const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      const [, d, m, yyyy] = dmy;
      return `${yyyy}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    // Already ISO "2026-03-01"
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    return null;
  }

  // Strip ₹, spaces, commas → number or null  (handles Indian lakh format: "1,58,177")
  function parseNumber(val) {
    if (val === null || val === undefined || val === '') return null;
    if (typeof val === 'number') return val;
    const s = String(val).replace(/[₹\s,]/g, '').trim();
    if (!s) return null;
    const n = Number(s);
    return isNaN(n) ? null : n;
  }

  const NUMERIC_COLS = new Set([
    'mark_up_inr', 'selling_price_inr', 'vendor_liability',
    'advance_received_inr', 'tax_inr', 'tcs_inr', 'margin',
  ]);

  // ── Build rows ─────────────────────────────────────────────────────────────

  const rows = [];
  for (let r = headerRowIdx + 1; r < data.length; r++) {
    const row = data[r];
    const queryId = String(row[colIndex['query_id']] || '').trim();
    if (!queryId) continue; // skip blank rows

    const obj = {};
    for (const [col, idx] of Object.entries(colIndex)) {
      let val = row[idx];

      if (col === 'sales_date') {
        val = parseDate(val);
      } else if (NUMERIC_COLS.has(col)) {
        val = parseNumber(val);
      } else {
        // Text — normalise empty to null
        val = (val === '' || val === undefined || val === null) ? null : String(val).trim() || null;
      }

      obj[col] = val;
    }

    rows.push(obj);
  }

  if (rows.length === 0) {
    Logger.log('No data rows found.');
    return;
  }

  Logger.log(`${rows.length} rows to sync. Clearing existing data…`);

  // Full refresh: delete all existing rows, then insert fresh from sheet
  const deleteRes = UrlFetchApp.fetch(`${url}/rest/v1/bookings?id=neq.00000000-0000-0000-0000-000000000000`, {
    method: 'DELETE',
    headers: {
      'apikey':        apiKey,
      'Authorization': `Bearer ${apiKey}`,
      'Prefer':        'return=minimal',
    },
    muteHttpExceptions: true,
  });
  if (deleteRes.getResponseCode() >= 400) {
    throw new Error(`Failed to clear bookings table: HTTP ${deleteRes.getResponseCode()} — ${deleteRes.getContentText().slice(0, 200)}`);
  }

  // Insert all rows in batches
  let synced = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const response = UrlFetchApp.fetch(`${url}/rest/v1/bookings`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'apikey':        apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Prefer':        'return=minimal',
      },
      payload:            JSON.stringify(batch),
      muteHttpExceptions: true,
    });

    const code = response.getResponseCode();
    if (code >= 400) {
      Logger.log(`Error batch ${Math.floor(i / BATCH_SIZE) + 1}: HTTP ${code} — ${response.getContentText().slice(0, 300)}`);
    } else {
      synced += batch.length;
    }
  }

  Logger.log(`✅ Done. ${synced} / ${rows.length} rows inserted.`);
}

// ── Optional: onEdit trigger (instant sync on any cell change) ──────────────
// Uncomment if you prefer instant sync over hourly:
//
// function onEdit(e) {
//   syncBookings();
// }

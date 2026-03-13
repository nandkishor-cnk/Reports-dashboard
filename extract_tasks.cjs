const XLSX = require('xlsx');
const wb = XLSX.readFile('Project_Tracker.xlsx');
const ws = wb.Sheets['Master Task List'];
const data = XLSX.utils.sheet_to_json(ws, { defval: '' });

function excelDateToISO(serial) {
  if (!serial || typeof serial !== 'number') return serial;
  const date = new Date(Math.round((serial - 25569) * 86400 * 1000));
  return date.toISOString().split('T')[0];
}

const cleaned = data.map(row => ({
  id: row['#'],
  workstream: row['Issue / Workstream'],
  task_name: row['Task'],
  owner: row['Owner'],
  deadline: excelDateToISO(row['Deadline']),
  status: row['Status'],
  week: row['Week #'],
  days_left: row['Days Left']
}));

console.log(JSON.stringify(cleaned, null, 2));

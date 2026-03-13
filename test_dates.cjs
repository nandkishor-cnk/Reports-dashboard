const xlsx = require('xlsx');

const workbook = xlsx.readFile('./Project_Tracker.xlsx');
const sheet = workbook.Sheets['Master Task List'];
const data = xlsx.utils.sheet_to_json(sheet);

console.log('Total tasks:', data.length);
console.log('Sample task date:', data[0].Deadline, '->', new Date(Math.round((data[0].Deadline - 25569)*86400*1000)));
console.log('First 5 tasks:', data.slice(0, 5));

const xlsx = require('xlsx');
const workbook = xlsx.readFile('./Project_Tracker.xlsx');
const sheet = workbook.Sheets['Master Task List'];
const data = xlsx.utils.sheet_to_json(sheet);
const badDates = data.filter(r => typeof r.Deadline === 'string');
console.log(badDates.map(r => ({ task: r.Task, rawDeadline: r.Deadline })));

const xlsx = require('xlsx');

const workbook = xlsx.readFile('./Project_Tracker.xlsx');
console.log('Sheets:', workbook.SheetNames);

for (const sheetName of workbook.SheetNames) {
  console.log(`\n--- Sheet: ${sheetName} ---`);
  const sheet = workbook.Sheets[sheetName];
  const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
  console.log('Headers / Row 1:', data[0]);
  console.log('Row 2:', data[1]);
  console.log('Row 3:', data[2]);
}

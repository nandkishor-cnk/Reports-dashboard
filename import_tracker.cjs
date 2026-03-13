require('dotenv').config({ path: '.env.local' });
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Convert Excel Serial Date to JS String (YYYY-MM-DD)
function excelDateToJSDate(val) {
  if (!val) return null;
  
  // If it's already a string like "2026-03-12" or "1 April"
  if (typeof val === 'string') {
    let toParse = val;
    // If there's no 4-digit year in the string, assume 2026 to avoid JS falling back to 2001
    if (!/\\d{4}/.test(toParse) && toParse.toLowerCase() !== 'done') {
      toParse += ' 2026';
    }
    const parsed = new Date(toParse);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
    return null;
  }
  
  // If it's a serial number
  if (typeof val === 'number') {
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) return date.toISOString().split('T')[0];
  }
  
  return null;
}

async function uploadData() {
  console.log('Connecting to Supabase...');
  
  try {
    const workbook = xlsx.readFile('./Project_Tracker.xlsx');
    const sheet = workbook.Sheets['Master Task List'];
    const data = xlsx.utils.sheet_to_json(sheet);
    
    console.log(`Found ${data.length} tasks in Excel.`);

    // Map tasks for eos_tasks
    const tasksToInsert = data
      .filter(row => row['Task'] && row['Issue / Workstream']) // Ensure valid row
      .map(row => ({
        workstream: row['Issue / Workstream'],
        task_name: row['Task'],
        owner: row['Owner'] || 'Unassigned',
        deadline: excelDateToJSDate(row['Deadline']) || new Date().toISOString().split('T')[0],
        status: row['Status'] || 'Upcoming'
      }));

    // Identify unique issues
    const uniqueIssues = new Set();
    const issuesToInsert = [];
    
    for (const task of tasksToInsert) {
      if (!uniqueIssues.has(task.workstream)) {
        uniqueIssues.add(task.workstream);
        issuesToInsert.push({
          issue_name: task.workstream,
          raised_by: task.owner, // default to first owner seen
          workstream: 'Operations', // default generic workstream, as we are already using the issue name
          priority: 'Medium',
          status: 'Open'
        });
      }
    }

    console.log(`Clearing existing eos_tasks...`);
    // Delete all existing tasks (optional, doing it to prevent duplicates on re-upload)
    const { error: delError1 } = await supabase.from('eos_tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delError1) console.error("Error deleting tasks:", delError1);

    try {
      const { error: delError2 } = await supabase.from('eos_issues').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (delError2) console.error("Error deleting issues:", delError2);
    } catch (e) {
      console.warn("Skipping clearing eos_issues (table might not exist yet)");
    }

    console.log(`Inserting ${tasksToInsert.length} tasks...`);
    const { error: insertError1 } = await supabase.from('eos_tasks').insert(tasksToInsert);
    if (insertError1) throw insertError1;

    try {
      console.log(`Inserting ${issuesToInsert.length} issues...`);
      const { error: insertError2 } = await supabase.from('eos_issues').insert(issuesToInsert);
      if (insertError2) throw insertError2;
    } catch (e) {
      console.warn("Skipping inserting eos_issues (table might not exist yet)");
    }

    console.log('Successfully uploaded Project Tracker data to Supabase!');
  } catch (err) {
    console.error('Error uploading data:', err);
  }
}

uploadData();

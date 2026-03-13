import { Client } from "pg";
import { createClient } from "@supabase/supabase-js";
import { DateTime } from "luxon";

// ── Config ────────────────────────────────────────────────────────────────────
const IST_TZ = "Asia/Kolkata";
const BATCH_SIZE = 500;

function getSupabase() {
    const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!SUPABASE_URL || !SERVICE_KEY) {
        throw new Error("Missing Supabase credentials in env.");
    }
    return createClient(SUPABASE_URL, SERVICE_KEY, {
        auth: { persistSession: false },
    });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function istToUtc(dateStr) {
    if (!dateStr) return null;
    let d;
    if (dateStr instanceof Date) {
        const iso = dateStr.toISOString().replace("Z", "");
        d = DateTime.fromISO(iso, { zone: IST_TZ });
    } else {
        d = DateTime.fromISO(dateStr, { zone: IST_TZ });
    }
    return d.toUTC().toISO();
}

function safeFloat(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === "number") return val;
    const str = String(val).trim().replace(/,/g, "");
    const num = parseFloat(str);
    return isNaN(num) || !isFinite(num) ? null : num;
}

function safeInt(val) {
    const f = safeFloat(val);
    return f === null ? null : Math.floor(f);
}

// ── Teams ─────────────────────────────────────────────────────────────────────
const _NAME_FROM_EMAIL = {
    "edwin.rajappan@coxandkings.com": "Edwin Ravi Rajappan",
    "ashish.nigam@coxandkings.com": "Ashish Nigam",
    "astik.dubey@coxandkings.com": "Astik Dubey",
    "hemant.singh@coxandkings.com": "Hemant Singh",
    "hushendra.kajania@coxandkings.com": "Hushendra Kajania",
    "kavita.kumari@coxandkings.com": "Kavita Kumari",
    "mohd.hamza@coxandkings.com": "Mohd Hamza",
    "rahul.menaria@coxandkings.com": "Rahul Menaria",
    "rahul.rai@coxandkings.com": "Rahul Rai",
    "riya.tyagi@coxandkings.com": "Riya Tyagi",
    "sumit.kumar@coxandkings.com": "Sumit Kumar",
    "syed.shah@coxandkings.com": "Syed Wali Ahmad Shah",
    "tejal.choudhary@coxandkings.com": "Tejal Choudhary",
    "vaishali.singh@coxandkings.com": "Vaishali Singh",
    "adarsh.raheja@coxandkings.com": "Adarsh Raheja",
    "amit.barik@coxandkings.com": "Amit Barik",
    "santosh.rai@coxandkings.com": "Santosh Kumar Rai",
    "soni.singh@coxandkings.com": "Soni Singh",
    "pratik.gupta@coxandkings.com": "Pratik Gupta",
    "anand.narayan@coxandkings.com": "Anand Narayan",
    "ashamp.kumar@coxandkings.com": "Ashamp Kumar",
    "damanpreet.kaur@coxandkings.com": "Damanpreet Kaur",
    "dheeraj.sharma@coxandkings.com": "Dheeraj Sharma",
    "faizan.khan@coxandkings.com": "Faizan Khan",
    "puneet.upadhyay@coxandkings.com": "Puneet Upadhyay",
    "zaid.jahangir@coxandkings.com": "Zaid Bin Jahangir",
    "ashok.pednekar@coxandkings.com": "Ashok Padnekar",
    "aditya.singh@coxandkings.com": "Aditya Singh FRN",
    "amruta.thakur@coxandkings.com": "Amruta Thakur FRN",
    "bharat.dubey@coxandkings.com": "Bharat Dubey FRN",
    "bharat.mali@coxandkings.com": "Bharat Mali FRN",
    "chandani.yede@coxandkings.com": "Chandani Yede FRN",
    "harshil.desai@coxandkings.com": "Harshil Desai FRN",
    "juned.khan@coxandkings.com": "Juned Khan FRN",
    "princy.kunjumon@coxandkings.com": "Princy FRN",
    "rakesh.dornala@coxandkings.com": "Rakesh Dornala FRN",
    "rohit.kumar@coxandkings.com": "Rohit Kumar FRN",
    "shakil.khan@coxandkings.com": "Shakil Khan FRN",
    "shaktisinh.jadeja@coxandkings.com": "Shaktisinh Jadeja FRN",
    "yogita.saxena@coxandkings.com": "Yogita FRN",
    "aditya.sathe@coxandkings.com": "Aditya Sathe FRN",
};

const ALL_TEAM_EMAILS = Object.keys(_NAME_FROM_EMAIL).map(e => e.toLowerCase());

// ── Supabase helpers ──────────────────────────────────────────────────────────
async function getLastSync(supabase, tableName) {
    const { data, error } = await supabase
        .from("etl_sync_log")
        .select("last_sync_at")
        .eq("table_name", tableName)
        .limit(1)
        .single();

    if (error || !data?.last_sync_at) {
        return "1970-01-01T00:00:00.000000+00:00"; // Far past UTC string
    }
    return data.last_sync_at;
}

async function updateSyncLog(supabase, tableName, rowsUpserted, errMsg = null) {
    const payload = {
        table_name: tableName,
        last_sync_at: new Date().toISOString(),
        rows_upserted: rowsUpserted,
        error_msg: errMsg,
        completed_at: new Date().toISOString(),
    };
    await supabase.from("etl_sync_log").upsert(payload, { onConflict: "table_name" });
}

async function upsertBatch(supabase, table, rows, conflictCol) {
    let total = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from(table).upsert(batch, { onConflict: conflictCol });
        if (error) {
            console.error(`ERROR upserting ${table}:`, error);
            throw error;
        }
        total += batch.length;
    }
    return total;
}

// ── Main Sync Logic ───────────────────────────────────────────────────────────
async function runSync() {
    console.log("Starting ETL sync from Vercel Serverless...");

    const supabase = getSupabase();

    const TELECRM_DB_HOST = process.env.TELECRM_DB_HOST;
    const TELECRM_DB_PORT = process.env.TELECRM_DB_PORT || "5432";
    const TELECRM_DB_NAME = process.env.TELECRM_DB_NAME;
    const TELECRM_DB_USER = process.env.TELECRM_DB_USER;
    const TELECRM_DB_PASS = process.env.TELECRM_DB_PASS;

    const teleCrm = new Client({
        host: TELECRM_DB_HOST,
        port: parseInt(TELECRM_DB_PORT, 10),
        database: TELECRM_DB_NAME,
        user: TELECRM_DB_USER,
        password: TELECRM_DB_PASS,
        ssl: { rejectUnauthorized: false }
    });

    await teleCrm.connect();
    console.log("Connected to RDS.");

    try {
        const leadsSyncUtc = await getLastSync(supabase, "raw_leads");
        const callsSyncUtc = await getLastSync(supabase, "raw_call_logs");
        const tasksSyncUtc = await getLastSync(supabase, "raw_tasks");

        const toIstNaive = (utcIso) => DateTime.fromISO(utcIso, { zone: "utc" }).setZone(IST_TZ).toFormat("yyyy-MM-dd HH:mm:ss.u");

        const leadsSinceIst = toIstNaive(leadsSyncUtc);
        const callsSinceIst = toIstNaive(callsSyncUtc);
        const tasksSinceIst = toIstNaive(tasksSyncUtc);

        console.log("Sync timestamps (IST naive):", leadsSinceIst, callsSinceIst, tasksSinceIst);

        // ── LEADS ──
        const leadsQuery = `
      SELECT
          TRIM(leadid)                              AS telecrm_id,
          created_on,
          updated_on,
          COALESCE(is_deleted, false)               AS is_deleted,
          LOWER(TRIM(assignee))                     AS assignee_email,
          TRIM(text_name)                           AS name,
          TRIM(phone_phone)                         AS phone,
          TRIM(phone_alternate_phone)               AS alternate_phone,
          TRIM(email_email)                         AS email,
          TRIM(dropdown_lead_source)                AS lead_source,
          list_name,
          TRIM(status)                              AS status,
          TRIM(rating)                              AS rating_raw,
          TRIM(lost_reason)                         AS lost_reason,
          TRIM(dropdown_travel_destination)         AS travel_destination,
          TRIM(text_travel_destination_name)        AS travel_destination_name,
          date_travel_date,
          number_number_of_travelers_adults         AS travelers_adults,
          number_number_of_travelers_child_with_beds AS travelers_child_beds,
          number_number_of_travelers_child_no_bed   AS travelers_child_nobed,
          number_number_of_travelers_infants         AS travelers_infants,
          money_approximate_budget                  AS budget_raw,
          TRIM(text_package_name)                   AS package_name,
          TRIM(dropdown_who_are_you_planning_to_travel_with) AS who_travelling_with,
          TRIM(dropdown_when_would_you_like_to_travel) AS when_to_travel,
          TRIM(dropdown_when_would_you_like_to_book)   AS when_to_book,
          TRIM(dropdown_buyer_type)                 AS buyer_type,
          TRIM(dropdown_flights_booked)             AS flights_booked,
          TRIM(dropdown_visa_status)                AS visa_status,
          TRIM(text_utm_source)                     AS utm_source,
          TRIM(text_utm_medium)                     AS utm_medium,
          TRIM(text_utm_campaign)                   AS utm_campaign,
          TRIM(text_utm_term)                       AS utm_term,
          TRIM(text_utm_content)                    AS utm_content,
          TRIM(text_gclid)                          AS gclid,
          TRIM(text_fbclid)                         AS fbclid,
          TRIM(text_facebook_ad)                    AS facebook_ad,
          TRIM(text_facebook_ad_name)               AS facebook_ad_name,
          TRIM(text_facebook_campaign)              AS facebook_campaign,
          TRIM(text_facebook_lead_id)               AS facebook_lead_id,
          TRIM(text_facebook_ad_set_id)             AS facebook_ad_set_id,
          TRIM(text_facebook_ad_set_name)           AS facebook_ad_set_name,
          money_expected_margin                     AS expected_margin_raw,
          money_margin                              AS margin_raw,
          money_advanced_received                   AS advanced_received_raw,
          date_expected_closure_date                AS expected_closure_date,
          date_first_call_date_and_time             AS first_call_date,
          CASE WHEN number_first_call_duration = -1 THEN NULL
                ELSE number_first_call_duration::INT END AS first_call_dur,
          date_next_follow_up_date                  AS next_follow_up_date,
          date_recapture_date                       AS recapture_date,
          number_recapture_count                    AS recapture_count,
          TRIM(dropdown_skill_map_group)            AS skill_map_group,
          TRIM(dropdown_lead_distributiontype)      AS lead_distribution_type
      FROM leads
      WHERE COALESCE(is_deleted, false) = false
        AND (created_on >= $1 OR updated_on >= $1)
      ORDER BY created_on
    `;
        const leadRes = await teleCrm.query(leadsQuery, [leadsSinceIst]);
        const leadRows = leadRes.rows.map(row => ({
            telecrm_id: row.telecrm_id,
            created_on: istToUtc(row.created_on),
            updated_on: istToUtc(row.updated_on),
            is_deleted: !!row.is_deleted,
            assignee: _NAME_FROM_EMAIL[row.assignee_email || ""] || null,
            assignee_email: row.assignee_email,
            name: row.name || null,
            phone: row.phone || null,
            alternate_phone: row.alternate_phone || null,
            email: row.email || null,
            lead_source: row.lead_source || null,
            list_names: row.list_name || [],
            status: row.status || null,
            rating: safeFloat(row.rating_raw),
            lost_reason: row.lost_reason || null,
            travel_destination: row.travel_destination || null,
            travel_destination_name: row.travel_destination_name || null,
            travel_date: istToUtc(row.travel_date),
            number_of_travelers_adults: safeInt(row.travelers_adults),
            number_of_travelers_child_beds: safeInt(row.travelers_child_beds),
            number_of_travelers_child_nobed: safeInt(row.travelers_child_nobed),
            number_of_travelers_infants: safeInt(row.travelers_infants),
            approximate_budget: safeFloat(row.budget_raw),
            package_name: row.package_name || null,
            who_travelling_with: row.who_travelling_with || null,
            when_to_travel: row.when_to_travel || null,
            when_to_book: row.when_to_book || null,
            buyer_type: row.buyer_type || null,
            flights_booked: row.flights_booked || null,
            visa_status: row.visa_status || null,
            utm_source: row.utm_source || null,
            utm_medium: row.utm_medium || null,
            utm_campaign: row.utm_campaign || null,
            utm_term: row.utm_term || null,
            utm_content: row.utm_content || null,
            gclid: row.gclid || null,
            fbclid: row.fbclid || null,
            facebook_ad: row.facebook_ad || null,
            facebook_ad_name: row.facebook_ad_name || null,
            facebook_campaign: row.facebook_campaign || null,
            facebook_lead_id: row.facebook_lead_id || null,
            facebook_ad_set_id: row.facebook_ad_set_id || null,
            facebook_ad_set_name: row.facebook_ad_set_name || null,
            expected_margin: safeFloat(row.expected_margin_raw),
            margin: safeFloat(row.margin_raw),
            advanced_received: safeFloat(row.advanced_received_raw),
            expected_closure_date: istToUtc(row.expected_closure_date),
            first_call_date: istToUtc(row.first_call_date),
            first_call_duration_seconds: safeInt(row.first_call_dur),
            next_follow_up_date: istToUtc(row.next_follow_up_date),
            recapture_date: istToUtc(row.recapture_date),
            recapture_count: safeInt(row.recapture_count) || 0,
            skill_map_group: row.skill_map_group || null,
            lead_distribution_type: row.lead_distribution_type || null,
        }));
        if(leadRows.length > 0) {
           await upsertBatch(supabase, "raw_leads", leadRows, "telecrm_id");
           await updateSyncLog(supabase, "raw_leads", leadRows.length);
           console.log(`Upserted ${leadRows.length} leads.`);
        }

        // ── Retrieve All TeleCRM IDs mapped so far ──
        const allLeadIds = Array.from(new Set(leadRows.map(r => r.telecrm_id)));
        if (allLeadIds.length === 0) {
            const allRes = await teleCrm.query(`
        SELECT TRIM(leadid) as id FROM leads
        WHERE COALESCE(is_deleted, false) = false
        AND created_on::date BETWEEN $1 AND $2
        AND LOWER(TRIM(assignee)) = ANY($3)
      `, ["2026-01-01", "2026-03-31", ALL_TEAM_EMAILS]);
            allLeadIds.push(...allRes.rows.map(r => r.id));
        }

        // ── CALL LOGS ──
        if (allLeadIds.length > 0) {
            const callsQuery = `
        SELECT
            TRIM(actionid)           AS telecrm_call_id,
            TRIM(leadid)             AS lead_telecrm_id,
            LOWER(TRIM(teammember_email)) AS agent_email,
            TRIM(type)               AS call_direction_raw,
            TRIM(status)             AS call_status_raw,
            CASE WHEN duration = -1 THEN 0
                 ELSE duration::INT END AS duration_seconds,
            created_on
        FROM action_callerdesk
        WHERE TRIM(leadid) = ANY($1)
          AND created_on >= $2
      `;
            const callsRes = await teleCrm.query(callsQuery, [allLeadIds, callsSinceIst]);
            const callRows = callsRes.rows.map(row => {
                let direction = null;
                if (row.call_direction_raw) {
                    const d = row.call_direction_raw.toLowerCase();
                    if (d.includes("inbound")) direction = "inbound";
                    else if (d.includes("outbound")) direction = "outbound";
                }
                const isAnswered = row.call_status_raw === "ANSWER";
                const durSec = row.duration_seconds ?? 0;
                return {
                    telecrm_call_id: row.telecrm_call_id,
                    lead_telecrm_id: row.lead_telecrm_id,
                    agent_email: row.agent_email || null,
                    agent_name: _NAME_FROM_EMAIL[row.agent_email || ""] || null,
                    call_direction: direction,
                    call_status: isAnswered ? "connected" : "not_connected",
                    duration_seconds: durSec,
                    call_started_at: istToUtc(row.created_on),
                    is_meaningful_connect: isAnswered && durSec >= 60,
                };
            });
            if (callRows.length > 0) {
               await upsertBatch(supabase, "raw_call_logs", callRows, "telecrm_call_id");
               await updateSyncLog(supabase, "raw_call_logs", callRows.length);
               console.log(`Upserted ${callRows.length} call logs.`);
            }

            // ── TASKS ──
            const tasksQuery = `
        SELECT
            TRIM(task_id)               AS telecrm_task_id,
            TRIM(leadid)                AS lead_telecrm_id,
            LOWER(TRIM(assignee))       AS assignee_email,
            deadline,
            updated_on,
            TRIM(status)                AS status_raw
        FROM call_followup
        WHERE LOWER(TRIM(assignee)) = ANY($1)
          AND (created_on >= $2 OR updated_on >= $2)
          AND deadline IS NOT NULL
      `;
            const tasksRes = await teleCrm.query(tasksQuery, [ALL_TEAM_EMAILS, tasksSinceIst]);

            const fastLeadIdSet = new Set(allLeadIds);

            const taskRows = tasksRes.rows.map(row => {
                const leadId = fastLeadIdSet.has(row.lead_telecrm_id) ? row.lead_telecrm_id : null;
                let status_norm = "pending";
                let completed_at = null;

                if (row.status_raw === "Done") {
                    status_norm = "completed";
                    completed_at = istToUtc(row.updated_on);
                } else if (row.status_raw === "Late") {
                    status_norm = "completed";
                    if (row.deadline) {
                        const d = row.deadline instanceof Date ? row.deadline : new Date(row.deadline);
                        d.setSeconds(d.getSeconds() + 1);
                        completed_at = istToUtc(d);
                    }
                } else if (row.status_raw === "Cancelled") {
                    status_norm = "cancelled";
                }

                const dueUtc = row.deadline ? new Date(istToUtc(row.deadline)) : null;
                const completedUtc = completed_at ? new Date(completed_at) : null;
                const isOnTime = status_norm === "completed" &&
                    row.status_raw === "Done" &&
                    dueUtc !== null &&
                    completedUtc !== null &&
                    completedUtc <= dueUtc;

                return {
                    telecrm_task_id: row.telecrm_task_id,
                    lead_telecrm_id: leadId,
                    assignee_email: row.assignee_email || null,
                    assignee_name: _NAME_FROM_EMAIL[row.assignee_email || ""] || null,
                    task_type: "call",
                    due_at: istToUtc(row.deadline),
                    completed_at,
                    status: status_norm,
                    is_completed_on_time: isOnTime,
                };
            });
            if(taskRows.length > 0) {
               await upsertBatch(supabase, "raw_tasks", taskRows, "telecrm_task_id");
               await updateSyncLog(supabase, "raw_tasks", taskRows.length);
               console.log(`Upserted ${taskRows.length} tasks.`);
            }
        }

    } catch (error) {
        console.error("Sync failed:", error);
        throw error;
    } finally {
        await teleCrm.end();
    }
    return { success: true };
}

// ── Vercel HTTP Handler ──────────────────────────────────────────
export default async function handler(req, res) {
    if (req.method === "GET") {
        return res.status(200).json({ status: "ok", type: "vercel_serverless" });
    }

    if (req.method === "POST" || req.method === "OPTIONS") {
        console.log("Manual or Cron HTTP trigger received in Vercel API.");
        // CORS 
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === "OPTIONS") {
            return res.status(200).end();
        }

        try {
            const result = await runSync();
            return res.status(200).json(result);
        } catch (err) {
            console.error("Manual trigger error:", err);
            return res.status(500).json({ error: err.message });
        }
    }

    return res.status(405).json({ error: "Method not allowed" });
}

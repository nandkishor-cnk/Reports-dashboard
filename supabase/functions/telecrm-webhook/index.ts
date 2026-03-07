/**
 * Cox & Kings EOS — TeleCRM Webhook Handler  (Task 4)
 * Supabase Edge Function: receives TeleCRM lead-update events → upserts raw_leads
 *
 * Deploy:
 *   supabase functions deploy telecrm-webhook --project-ref gsawzusvwujowkjcftzi
 *
 * Endpoint URL (after deploy):
 *   https://gsawzusvwujowkjcftzi.supabase.co/functions/v1/telecrm-webhook
 *
 * Set env secret in Supabase dashboard → Project Settings → Edge Functions:
 *   TELECRM_WEBHOOK_SECRET = <your secret>
 *   SUPABASE_SERVICE_ROLE_KEY = <service role key>
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("TELECRM_WEBHOOK_SECRET") || "";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5h30m in ms

/** Convert naive IST ISO string to UTC ISO string. */
function istToUtc(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const d = new Date(raw.replace(" ", "T"));
    return new Date(d.getTime() - IST_OFFSET_MS).toISOString();
  } catch {
    return null;
  }
}

function safeNum(val: unknown): number | null {
  if (val === null || val === undefined || val === "" || val === -1) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

/** Map TeleCRM webhook payload → raw_leads row. */
function mapLeadPayload(body: Record<string, unknown>): Record<string, unknown> {
  const lead = (body.lead ?? body) as Record<string, unknown>;

  const assigneeEmail = ((lead.assignee as string) ?? "").toLowerCase().trim();

  return {
    telecrm_id:                     String(lead.leadid ?? "").trim(),
    created_on:                     istToUtc(lead.created_on as string),
    updated_on:                     istToUtc(lead.updated_on as string),
    is_deleted:                     Boolean(lead.is_deleted ?? false),
    assignee_email:                 assigneeEmail || null,
    name:                           (lead.text_name as string) || null,
    phone:                          (lead.phone_phone as string) || null,
    alternate_phone:                (lead.phone_alternate_phone as string) || null,
    email:                          (lead.email_email as string) || null,
    lead_source:                    (lead.dropdown_lead_source as string) || null,
    status:                         (lead.status as string) || null,
    rating:                         safeNum(lead.rating),
    lost_reason:                    (lead.lost_reason as string) || null,
    travel_destination:             (lead.dropdown_travel_destination as string) || null,
    travel_destination_name:        (lead.text_travel_destination_name as string) || null,
    travel_date:                    istToUtc(lead.date_travel_date as string),
    number_of_travelers_adults:     safeNum(lead.number_number_of_travelers_adults),
    number_of_travelers_child_beds: safeNum(lead.number_number_of_travelers_child_with_beds),
    number_of_travelers_child_nobed:safeNum(lead.number_number_of_travelers_child_no_bed),
    number_of_travelers_infants:    safeNum(lead.number_number_of_travelers_infants),
    approximate_budget:             safeNum(lead.money_approximate_budget),
    package_name:                   (lead.text_package_name as string) || null,
    who_travelling_with:            (lead.dropdown_who_are_you_planning_to_travel_with as string) || null,
    when_to_travel:                 (lead.dropdown_when_would_you_like_to_travel as string) || null,
    when_to_book:                   (lead.dropdown_when_would_you_like_to_book as string) || null,
    buyer_type:                     (lead.dropdown_buyer_type as string) || null,
    flights_booked:                 (lead.dropdown_flights_booked as string) || null,
    visa_status:                    (lead.dropdown_visa_status as string) || null,
    utm_source:                     (lead.text_utm_source as string) || null,
    utm_medium:                     (lead.text_utm_medium as string) || null,
    utm_campaign:                   (lead.text_utm_campaign as string) || null,
    utm_term:                       (lead.text_utm_term as string) || null,
    utm_content:                    (lead.text_utm_content as string) || null,
    gclid:                          (lead.text_gclid as string) || null,
    fbclid:                         (lead.text_fbclid as string) || null,
    facebook_ad:                    (lead.text_facebook_ad as string) || null,
    facebook_ad_name:               (lead.text_facebook_ad_name as string) || null,
    facebook_campaign:              (lead.text_facebook_campaign as string) || null,
    facebook_lead_id:               (lead.text_facebook_lead_id as string) || null,
    facebook_ad_set_id:             (lead.text_facebook_ad_set_id as string) || null,
    facebook_ad_set_name:           (lead.text_facebook_ad_set_name as string) || null,
    expected_margin:                safeNum(lead.money_expected_margin),
    margin:                         safeNum(lead.money_margin),
    advanced_received:              safeNum(lead.money_advanced_received),
    expected_closure_date:          istToUtc(lead.date_expected_closure_date as string),
    first_call_date:                istToUtc(lead.date_first_call_date_and_time as string),
    first_call_duration_seconds:    (lead.number_first_call_duration as number) === -1
                                      ? null
                                      : safeNum(lead.number_first_call_duration),
    next_follow_up_date:            istToUtc(lead.date_next_follow_up_date as string),
    recapture_date:                 istToUtc(lead.date_recapture_date as string),
    recapture_count:                safeNum(lead.number_recapture_count) ?? 0,
    skill_map_group:                (lead.dropdown_skill_map_group as string) || null,
    lead_distribution_type:         (lead.dropdown_lead_distributiontype as string) || null,
    raw_payload:                    lead,
  };
}

/** Verify TeleCRM HMAC-SHA256 signature (if secret configured). */
async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  if (!WEBHOOK_SECRET) return true; // no secret = skip verification (dev only)

  const signature = req.headers.get("x-telecrm-signature") ??
                    req.headers.get("x-hub-signature-256") ?? "";
  if (!signature) return false;

  const enc  = new TextEncoder();
  const key  = await crypto.subtle.importKey(
    "raw", enc.encode(WEBHOOK_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig  = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const hex  = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  const expected = `sha256=${hex}`;

  // Constant-time comparison
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  // ── CORS preflight ───────────────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { "Content-Type": "application/json" },
    });
  }

  const rawBody = await req.text();

  // ── Signature verification ───────────────────────────────────────────────────
  if (!(await verifySignature(req, rawBody))) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401, headers: { "Content-Type": "application/json" },
    });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400, headers: { "Content-Type": "application/json" },
    });
  }

  const event = (body.event ?? body.type ?? "lead_update") as string;
  const receivedAt = new Date().toISOString();

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  });

  // ── Log webhook receipt ──────────────────────────────────────────────────────
  await supabase.from("webhook_log").insert({
    source: "telecrm",
    event_type: event,
    payload_hash: String(rawBody.length),
    status: "processing",
    received_at: receivedAt,
  });

  // ── Map & upsert lead ────────────────────────────────────────────────────────
  const leadRow = mapLeadPayload(body);
  const telecrm_id = leadRow.telecrm_id as string;

  if (!telecrm_id) {
    await supabase.from("webhook_log").update({ status: "skipped", error_msg: "no leadid" })
      .eq("received_at", receivedAt);
    return new Response(JSON.stringify({ ok: true, skipped: "no leadid" }), {
      status: 200, headers: { "Content-Type": "application/json" },
    });
  }

  const { error } = await supabase
    .from("raw_leads")
    .upsert(leadRow, { onConflict: "telecrm_id" });

  if (error) {
    await supabase.from("webhook_log")
      .update({ status: "error", error_msg: error.message })
      .eq("received_at", receivedAt);
    console.error("Upsert error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }

  // ── Update webhook log as success ────────────────────────────────────────────
  await supabase.from("webhook_log")
    .update({ status: "ok" })
    .eq("received_at", receivedAt);

  return new Response(
    JSON.stringify({ ok: true, telecrm_id, event }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});

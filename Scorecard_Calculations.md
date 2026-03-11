# Cox & Kings EOS Scorecard — Metric Definitions & Calculations

This document outlines exactly how each metric is calculated in the EOS Scorecard Dashboard for the Sales and Performance Marketing teams based on raw data pulled from TeleCRM and other sources.

---

## 📅 Time Tracking (Weeks & SLA Days)
- **Week Definition:** A week spans exactly 7 days, starting on every Thursday from the beginning of the Financial Quarter. (e.g., Q1 Week 1 = Jan 1 - Jan 7).
- **Business Hours:** 10:00 AM – 8:00 PM IST
- **Business Days:** Monday to Saturday (Sundays are excluded from SLA clocks).
  - *If a lead arrives after 8 PM*, the SLA clock starts at 10 AM the following morning.
  - *If a lead arrives on Sunday*, the SLA clock starts at 10 AM on Monday.

---

## 📞 Sales Metrics (Edwin, Adarsh, Ashok)

### 1. Total No. of Leads Taken
- **Calculation:** Total count of unique leads created within the week assigned to the specific agent/team.
- **Conditions:** 
  - Excludes leads marked as `is_deleted = true`.
  - Filtered strictly by `created_on` falling within the respective 7-day week window.

### 2. % Leads Contacted as per SLA (60-minute rule)
- **Calculation:** `(Leads Contacted on time / Total Leads) * 100`
- **Definition of "On Time":** A lead is successfully contacted if the agent's `first_call_date_and_time` is less than or equal to `created_on + 60 true business minutes`.
- **Condition:** Business hours (10 AM-8 PM, Mon-Sat) apply to this 60-minute window.

### 3. % Leads Connected
- **Calculation:** `(Meaningful Connections / Total Leads) * 100`
- **Definition of "Meaningful Connection":** The `call_status` from TeleCRM's `action_callerdesk` is marked as "ANSWER" **AND** the `duration` of that specific call was **>= 60 seconds**.

### 4. % Quote Sent
- **Calculation:** `(Qualified Leads / Total Leads) * 100`
- **Definition of "Quote Sent/Qualified":** A lead is counted if its current `status` in TeleCRM matches *any* of the following qualified stages:
  - Changes Required
  - Customer Quote Reviewing
  - First Payment Done (also counts as Won)
  - Initial Deposit (also counts as Won)
  - Negotiation / Negotiation Stage
  - Post Quote | Indiscussion | FU 1/2/3/4
  - Post Quote | No Response 1/2/3/4
  - Qualified / Qualified | FIT / Qualified | GIT
  - Quote Explained
  - Quote Sent
  - Revised Quote Sent

### 5. Conversion %
- **Calculation:** `(Won Leads / Total Leads) * 100`
- **Definition of "Won":** A lead's current `status` is explicitly set to **"First Payment Done"**. 

### 6. No. of Bookings
- **Calculation:** A raw count of all leads marked as "First Payment Done" for that week.

### 7. % Follow-ups Done as per SLA
- **Calculation:** `(Tasks Completed On Time / Total Tasks Due in Week) * 100`
- **Definition of "On Time":** A task (from TeleCRM `call_followup`) is marked as "Done" on or before its `deadline` timestamp. Tasks marked as "Late" or "Cancelled" fail the SLA.

*(Note: "Average Booking Value", "Advance Received", and "% Departure Filled" are placeholders currently maintained manually/separately pending direct financial system integration).*

---

## 📈 Performance Marketing Metrics (Deeksha)

### 1. Total Leads Generated
- **Calculation:** The aggregate count of all non-deleted leads created in TeleCRM during the week where the lead source indicates marketing activity (or based on global totals evaluated week-over-week).

### 2. Total Qualified Leads
- **Calculation:** A count of marketing-generated leads that reached any of the "Qualified / Quote Sent" stages listed in Sales Metric #4.

### 3. Total Spend incl. GST
- **Calculation:** `raw_ad_spend * 1.18`. 
- **Source:** Data pulled directly from Facebook Ads / Google Ads (via Windsor.ai to Supabase). The raw spend is multiplied by 1.18 to calculate the final 18% GST inclusive value.

### 4. Cost Per Lead (CPL)
- **Calculation:** `Total Spend incl. GST / Total Leads Generated`

### 5. Cost Per Qualified Lead (CPQL)
- **Calculation:** `Total Spend incl. GST / Total Qualified Leads`

---

## 💡 Team Mapping
All metrics are rolled up automatically based on the assignee email logged in TeleCRM. If an agent shifts teams, their historical metrics remain tied to the manager they rolled up to at the time the lead was processed. 

**Total Sales** is the aggregate combination of Edwin, Adarsh, and Ashok's lead pools (with averages weighted correctly by total pool size for percentages, not just straight averages of the three percentages).

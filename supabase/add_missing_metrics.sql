-- Run this in Supabase SQL Editor to add missing metrics and fix owner names.
-- Safe to re-run.

-- 1. Update owner for existing SALES PERFORMANCE metrics
UPDATE public.scorecard_metrics_config
SET owner = 'Adarsh & Ashok & Edwin'
WHERE category = 'SALES PERFORMANCE'
  AND owner = 'Adarsh & Ashok';

-- 2. Add missing metrics (if not already present)
INSERT INTO public.scorecard_metrics_config (category, owner, metric_name, display_order)
SELECT v.category, v.owner, v.metric_name, v.display_order
FROM (VALUES
  ('SALES PERFORMANCE', 'Adarsh & Ashok & Edwin', 'Advance Received',             14),
  ('SALES PERFORMANCE', 'Adarsh & Ashok & Edwin', '% Follow-ups Done as per SLA', 15)
) AS v(category, owner, metric_name, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.scorecard_metrics_config c
  WHERE c.metric_name = v.metric_name
);

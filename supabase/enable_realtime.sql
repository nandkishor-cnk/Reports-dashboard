-- ═══════════════════════════════════════════════════════════════
--  Enable Supabase Realtime on raw data tables
--  Run this in the Supabase SQL Editor (Dashboard → SQL Editor)
-- ═══════════════════════════════════════════════════════════════

-- Add tables to the Realtime publication so change events are
-- broadcast to connected WebSocket clients.

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.raw_leads;
    RAISE NOTICE 'Added raw_leads to supabase_realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'raw_leads already in supabase_realtime';
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.raw_call_logs;
    RAISE NOTICE 'Added raw_call_logs to supabase_realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'raw_call_logs already in supabase_realtime';
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.raw_tasks;
    RAISE NOTICE 'Added raw_tasks to supabase_realtime';
  EXCEPTION WHEN duplicate_object THEN
    RAISE NOTICE 'raw_tasks already in supabase_realtime';
  END;
END
$$;

-- Verify
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY tablename;

-- Bookings table — synced from Google Sheet via Apps Script
-- Full refresh on each sync (delete all + insert). Query ID is NOT unique.
-- This script is idempotent — safe to run multiple times.

CREATE TABLE IF NOT EXISTS public.bookings (
    id                   UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    query_id             TEXT    NOT NULL,
    sales_date           DATE,
    customer_details     TEXT,
    nature_of_booking    TEXT,
    particulars          TEXT,
    mark_up_inr          NUMERIC,
    sales_by             TEXT,
    sales_email          TEXT,
    selling_price_inr    NUMERIC,
    vendor_liability     NUMERIC,
    advance_received_inr NUMERIC,
    tax_inr              NUMERIC,
    tcs_inr              NUMERIC,
    margin               NUMERIC,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Drop unique constraint on query_id if it exists (from earlier schema version)
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.bookings'::regclass
    AND contype = 'u'
    AND conname ILIKE '%query_id%';
  IF con_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.bookings DROP CONSTRAINT ' || quote_ident(con_name);
    RAISE NOTICE 'Dropped unique constraint: %', con_name;
  END IF;
END $$;

-- Indexes (safe to re-run)
CREATE INDEX IF NOT EXISTS idx_bookings_sales_date  ON public.bookings (sales_date);
CREATE INDEX IF NOT EXISTS idx_bookings_sales_email ON public.bookings (sales_email);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON public.bookings;
CREATE TRIGGER trg_bookings_updated_at
BEFORE UPDATE ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.bookings;

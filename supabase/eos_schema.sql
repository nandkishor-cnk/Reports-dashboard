-- EOS Tracker Schema
CREATE TABLE public.eos_tasks (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    workstream TEXT NOT NULL,
    task_name TEXT NOT NULL,
    owner TEXT NOT NULL,
    deadline DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'Upcoming',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Realtime for tasks
ALTER PUBLICATION supabase_realtime ADD TABLE public.eos_tasks;


-- Scorecard Metrics Configuration
CREATE TABLE public.scorecard_metrics_config (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL, -- e.g., 'MARKETING PERFORMANCE', 'SALES PERFORMANCE'
    owner TEXT,
    metric_name TEXT NOT NULL,
    target_value NUMERIC,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Scorecard Weekly Data
CREATE TABLE public.scorecard_weekly_data (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_id UUID NOT NULL REFERENCES public.scorecard_metrics_config(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    value NUMERIC,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(metric_id, week_start_date)
);

-- Realtime for scorecard data
ALTER PUBLICATION supabase_realtime ADD TABLE public.scorecard_metrics_config;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scorecard_weekly_data;

-- Seed some initial metrics config based on the Excel design
INSERT INTO public.scorecard_metrics_config (category, owner, metric_name, display_order) VALUES
('MARKETING PERFORMANCE', 'Deeksha', 'Total Leads Generated', 1),
('MARKETING PERFORMANCE', 'Deeksha', 'Cost Per Lead (CPL)', 2),
('MARKETING PERFORMANCE', 'Deeksha', 'Total Qualified Leads', 3),
('MARKETING PERFORMANCE', 'Deeksha', 'Cost Per Qualified Lead', 4),
('MARKETING PERFORMANCE', 'Deeksha', 'Total Spend incl. GST', 5),
('MARKETING PERFORMANCE', 'Deeksha', 'GM ROAS', 6),

('SALES PERFORMANCE', 'Adarsh & Ashok', 'Total No. of Leads Taken', 7),
('SALES PERFORMANCE', 'Adarsh & Ashok', '% Leads Contacted as per SLA', 8),
('SALES PERFORMANCE', 'Adarsh & Ashok', '% Leads Connected', 9),
('SALES PERFORMANCE', 'Adarsh & Ashok', '% Quote Sent', 10),
('SALES PERFORMANCE', 'Adarsh & Ashok', 'Conversion %', 11),
('SALES PERFORMANCE', 'Adarsh & Ashok', 'No. of Bookings', 12),
('SALES PERFORMANCE', 'Adarsh & Ashok', 'Average Booking Value', 13);

-- EOS Issues Tracking
CREATE TABLE public.eos_issues (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    issue_name TEXT NOT NULL,
    raised_by TEXT NOT NULL,
    workstream TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Medium',
    status TEXT NOT NULL DEFAULT 'Open',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Realtime for issues
ALTER PUBLICATION supabase_realtime ADD TABLE public.eos_issues;

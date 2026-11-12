-- Lets a Committee Report point at the specific Draft Ordinances/Resolutions/Communications it
-- measures (e.g. a joint report's numbered "(1) ... (2) ..." items), so the mobile app can show
-- each one as its own link to that measure's own attached file, not just the report's.
alter table public.committee_reports add column if not exists measures text[] not null default '{}';

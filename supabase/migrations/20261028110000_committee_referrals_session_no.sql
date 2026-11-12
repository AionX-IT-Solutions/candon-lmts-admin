-- =============================================================================
-- Committee Referrals: the session the draft was referred in.
-- Mirror the column in TABLE_COLUMNS (lib/db/schema.ts) of candon-lmts-admin and candon-app.
-- =============================================================================
alter table public.committee_referrals add column if not exists session_no text collate "C";

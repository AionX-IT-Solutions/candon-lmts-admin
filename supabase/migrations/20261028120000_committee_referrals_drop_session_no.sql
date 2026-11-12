-- =============================================================================
-- Committee Referrals have no session number (as in the existing Candon LMTS); the column added in
-- 20261028110000 never held data.
-- Mirror the columns in TABLE_COLUMNS (lib/db/schema.ts) of candon-lmts-admin and candon-app.
-- =============================================================================
alter table public.committee_referrals drop column if exists session_no;

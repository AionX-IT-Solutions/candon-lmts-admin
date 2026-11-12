-- =============================================================================
-- Committee Referrals, as in the existing Candon LMTS: Draft Code, Short Title (title),
-- Recommendation, Findings and Remarks — no committee / date / session / term, no attachment.
-- The columns dropped here were added earlier today and never held data.
-- Mirror the columns in TABLE_COLUMNS (lib/db/schema.ts) of candon-lmts-admin and candon-app.
-- =============================================================================
alter table public.committee_referrals
  add column if not exists draft_code text collate "C",
  add column if not exists recommendation text collate "C",
  add column if not exists findings text collate "C";

alter table public.committee_referrals
  drop column if exists committee,
  drop column if exists date_referred,
  drop column if exists session_no,
  drop column if exists term_id;

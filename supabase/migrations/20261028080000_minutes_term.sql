-- =============================================================================
-- Order of Business sessions belong to a council term (session numbers start over each term).
-- Mirror the new column in TABLE_COLUMNS (lib/db/schema.ts) of candon-lmts-admin and candon-app.
-- =============================================================================
alter table public.minutes
  add column if not exists term_id uuid references public.terms (id) on delete set null;
create index if not exists minutes_term_id_idx on public.minutes (term_id);

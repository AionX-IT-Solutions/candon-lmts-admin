-- =============================================================================
-- Per-session reading history for Draft Ordinances/Resolutions
--   A draft keeps ONE file and ONE "current" session_no/reading (used by the Drafts list
--   pages), but its legislative journey can span several sessions (e.g. 1st Reading in
--   session 001-2026, 2nd Reading in session 002-2026). Each session's Order of Business
--   must keep showing what actually happened THAT session, even after a later edit moves
--   the draft on to its next reading — so every save snapshots a (session, reading) row
--   here instead of overwriting history. Same privilege as the drafts themselves; no new
--   module/UI, no new privilege. Mirror the columns in TABLE_COLUMNS (lib/db/schema.ts) of
--   candon-lmts-admin and candon-app.
-- =============================================================================

create table if not exists public.draft_ordinance_readings (
  id uuid primary key default gen_random_uuid(),
  draft_no text collate "C" not null,
  session_no text collate "C" not null,
  reading text collate "C" not null,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists draft_ordinance_readings_draft_session_idx
  on public.draft_ordinance_readings (draft_no, session_no);
create index if not exists draft_ordinance_readings_session_no_idx
  on public.draft_ordinance_readings (session_no);

create table if not exists public.draft_resolution_readings (
  id uuid primary key default gen_random_uuid(),
  draft_no text collate "C" not null,
  session_no text collate "C" not null,
  reading text collate "C" not null,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists draft_resolution_readings_draft_session_idx
  on public.draft_resolution_readings (draft_no, session_no);
create index if not exists draft_resolution_readings_session_no_idx
  on public.draft_resolution_readings (session_no);

-- Backfill: every existing draft's CURRENT session/reading becomes its first history row,
-- so sessions that already reference these drafts don't go blank the moment this ships.
insert into public.draft_ordinance_readings (draft_no, session_no, reading)
select draft_ordinance_number, session_no, reading
from public.draft_ordinances
where coalesce(draft_ordinance_number, '') <> ''
  and coalesce(session_no, '') <> ''
  and coalesce(reading, '') <> ''
on conflict (draft_no, session_no) do nothing;

insert into public.draft_resolution_readings (draft_no, session_no, reading)
select draft_resolution_number, session_no, reading
from public.draft_resolutions
where coalesce(draft_resolution_number, '') <> ''
  and coalesce(session_no, '') <> ''
  and coalesce(reading, '') <> ''
on conflict (draft_no, session_no) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- Rules, updated_at and realtime for the new tables — same privilege as the drafts
-- themselves ('Draft Ordinance/s and Draft Resolutions'), so nothing new to grant.
-- Insert allows 'add' OR 'edit': progressing an existing draft to a new session/reading
-- is an edit of the draft, but may still be a brand-new row in ITS history table.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('draft_ordinance_readings', 'Draft Ordinance/s and Draft Resolutions'),
      ('draft_resolution_readings', 'Draft Ordinance/s and Draft Resolutions')
    ) as v(tbl, module)
  loop
    execute format('alter table public.%I enable row level security', t.tbl);

    execute format('drop trigger if exists set_updated_at on public.%I', t.tbl);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      t.tbl
    );

    execute format('drop policy if exists "members can read" on public.%I', t.tbl);
    execute format('drop policy if exists "privileged can insert" on public.%I', t.tbl);
    execute format('drop policy if exists "privileged can update" on public.%I', t.tbl);
    execute format('drop policy if exists "privileged can delete" on public.%I', t.tbl);

    execute format(
      'create policy "members can read" on public.%I for select to authenticated using (private.is_member())',
      t.tbl
    );
    execute format(
      'create policy "privileged can insert" on public.%I for insert to authenticated with check (private.can(%L, ''add'') or private.can(%L, ''edit''))',
      t.tbl, t.module, t.module
    );
    execute format(
      'create policy "privileged can update" on public.%I for update to authenticated using (private.can(%L, ''edit'')) with check (private.can(%L, ''edit''))',
      t.tbl, t.module, t.module
    );
    execute format(
      'create policy "privileged can delete" on public.%I for delete to authenticated using (private.can(%L, ''delete''))',
      t.tbl, t.module
    );

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t.tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t.tbl);
    end if;
  end loop;
end
$$;

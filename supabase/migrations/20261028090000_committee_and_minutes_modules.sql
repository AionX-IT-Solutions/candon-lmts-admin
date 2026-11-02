-- =============================================================================
-- Sessions & Committees modules (from the existing Candon LMTS menu)
--   • session_minutes          — Session Minutes                     (privilege 'Session Minutes')
--   • committee_referrals      — Committee Referrals                 (privilege 'Committee Referrals')
--   • committee_transcripts    — Committee Hearing/Meeting Transcripts (privilege 'Committee Transcripts')
--   • public_hearing_minutes   — Public Hearing Minutes              (privilege 'Public Hearing Minutes')
--   • committee_reports.report_type — the module also keeps committee meeting / hearing minutes
-- Same rules as the other modules: members read; Add / Edit / Delete per privilege (private.can).
-- Mirror the columns in TABLE_COLUMNS (lib/db/schema.ts) of candon-lmts-admin and candon-app.
-- =============================================================================

create table if not exists public.session_minutes (
  id uuid primary key default gen_random_uuid(),
  session_no text collate "C",
  category text collate "C",
  date text collate "C",
  tag text collate "C",
  term_id uuid references public.terms (id) on delete set null,
  file_path text,
  file_type text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.committee_referrals (
  id uuid primary key default gen_random_uuid(),
  title text collate "C",
  committee text collate "C",
  date_referred text collate "C",
  session_no text collate "C",
  remarks text collate "C",
  term_id uuid references public.terms (id) on delete set null,
  file_path text,
  file_type text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.committee_transcripts (
  id uuid primary key default gen_random_uuid(),
  title text collate "C",
  committee text collate "C",
  category text collate "C",
  date text collate "C",
  tag text collate "C",
  term_id uuid references public.terms (id) on delete set null,
  file_path text,
  file_type text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.public_hearing_minutes (
  id uuid primary key default gen_random_uuid(),
  title text collate "C",
  committee text collate "C",
  date text collate "C",
  tag text collate "C",
  term_id uuid references public.terms (id) on delete set null,
  file_path text,
  file_type text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Committee Reports also holds committee meeting and hearing minutes
alter table public.committee_reports add column if not exists report_type text collate "C";

-- ─────────────────────────────────────────────────────────────────────────────
-- Rules, updated_at, term index and realtime for the new tables
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('session_minutes', 'Session Minutes'),
      ('committee_referrals', 'Committee Referrals'),
      ('committee_transcripts', 'Committee Transcripts'),
      ('public_hearing_minutes', 'Public Hearing Minutes')
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
      'create policy "privileged can insert" on public.%I for insert to authenticated with check (private.can(%L, ''add''))',
      t.tbl, t.module
    );
    execute format(
      'create policy "privileged can update" on public.%I for update to authenticated using (private.can(%L, ''edit'')) with check (private.can(%L, ''edit''))',
      t.tbl, t.module, t.module
    );
    execute format(
      'create policy "privileged can delete" on public.%I for delete to authenticated using (private.can(%L, ''delete''))',
      t.tbl, t.module
    );

    execute format('create index if not exists %I on public.%I (term_id)', t.tbl || '_term_id_idx', t.tbl);

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t.tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t.tbl);
    end if;
  end loop;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage folders for their PDFs (same list as before plus the four new folders)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function private.folder_privilege(folder text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case folder
    when 'GeneralOrdinances' then 'Ordinances'
    when 'Resolutions' then 'Resolutions'
    when 'DraftOrdinances' then 'Draft Ordinance/s and Draft Resolutions'
    when 'DraftResolutions' then 'Draft Ordinance/s and Draft Resolutions'
    when 'minutes' then 'Calendar of Business'
    when 'TranscriptOfProceedings' then 'Transcript of Proceedings'
    when 'OtherCommunications' then 'Other Communications'
    when 'Incoming' then 'Incoming'
    when 'BrgyActions' then 'Barangay Actions'
    when 'Review' then 'Barangay Review'
    when 'CommitteeReports' then 'Committee Reports'
    when 'Addendum' then 'Addendum and Corrections'
    when 'otherMatters' then 'Other Matters'
    when 'tricycle' then 'Tricycle Franchise'
    when 'Users' then 'Account Management'
    when 'Officials' then 'S.P Members'
    when 'SessionMinutes' then 'Session Minutes'
    when 'CommitteeReferrals' then 'Committee Referrals'
    when 'CommitteeTranscripts' then 'Committee Transcripts'
    when 'PublicHearingMinutes' then 'Public Hearing Minutes'
    else null
  end;
$$;

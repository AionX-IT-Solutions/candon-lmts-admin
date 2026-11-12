-- =============================================================================
-- City council terms
--   • public.terms — each council term (e.g. "2025–2028") with its start/end dates
--   • officials.term_id and committees.term_id replace the old free-text
--     officials.term / committees.batch columns (existing values become terms first)
-- Mirror new columns in TABLE_COLUMNS (lib/db/schema.ts) of candon-lmts-admin and candon-app.
-- =============================================================================

create table if not exists public.terms (
  id uuid primary key default gen_random_uuid(),
  name text collate "C",
  start_date text collate "C",
  end_date text collate "C",
  remarks text collate "C",
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.terms enable row level security;

drop trigger if exists set_updated_at on public.terms;
create trigger set_updated_at
  before update on public.terms
  for each row execute function private.set_updated_at();

-- Same rules as the officials table: members read, 'S.P Members' write
drop policy if exists "members can read" on public.terms;
create policy "members can read" on public.terms
  for select to authenticated using (private.is_member());
drop policy if exists "privileged can insert" on public.terms;
create policy "privileged can insert" on public.terms
  for insert to authenticated with check (private.has_privilege('S.P Members'));
drop policy if exists "privileged can update" on public.terms;
create policy "privileged can update" on public.terms
  for update to authenticated
  using (private.has_privilege('S.P Members'))
  with check (private.has_privilege('S.P Members'));
drop policy if exists "privileged can delete" on public.terms;
create policy "privileged can delete" on public.terms
  for delete to authenticated using (private.has_privilege('S.P Members'));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'terms'
  ) then
    alter publication supabase_realtime add table public.terms;
  end if;
end
$$;

alter table public.officials
  add column if not exists term_id uuid references public.terms (id) on delete set null;
alter table public.committees
  add column if not exists term_id uuid references public.terms (id) on delete set null;
create index if not exists officials_term_id_idx on public.officials (term_id);
create index if not exists committees_term_id_idx on public.committees (term_id);

-- Carry existing free-text terms over as terms, link them, then drop the old columns.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'officials' and column_name = 'term'
  ) then
    insert into public.terms (name)
    select distinct trim(o.term)
    from public.officials o
    where trim(coalesce(o.term, '')) <> ''
      and trim(o.term) not in (select t.name from public.terms t where t.name is not null);
    update public.officials o
    set term_id = t.id
    from public.terms t
    where o.term_id is null and t.name = trim(o.term);
    alter table public.officials drop column term;
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'committees' and column_name = 'batch'
  ) then
    insert into public.terms (name)
    select distinct trim(c.batch)
    from public.committees c
    where trim(coalesce(c.batch, '')) <> ''
      and trim(c.batch) not in (select t.name from public.terms t where t.name is not null);
    update public.committees c
    set term_id = t.id
    from public.terms t
    where c.term_id is null and t.name = trim(c.batch);
    alter table public.committees drop column batch;
  end if;
end
$$;

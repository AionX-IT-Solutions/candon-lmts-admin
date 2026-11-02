-- =============================================================================
-- Candon LMTS — initial Supabase schema (candon-lmts-admin + candon-app)
--
-- Run this once in the Supabase dashboard → SQL Editor (or `supabase db push`).
-- It is safe to run again: every statement is idempotent.
--
-- Layout
--   • public.users             one row per account: username, role, privileges (login itself is Supabase Auth)
--   • public.<module tables>    one table per legislative module (was a laoag_* Firestore collection)
--   • storage bucket documents  private; files are opened through short-lived signed URLs
--   • private.*                 helper functions used by the security policies (not exposed by the API)
--
-- Columns are snake_case versions of the app's field names (ordinanceNumber → ordinance_number).
-- Fields the apps write that have no column of their own are kept in each table's `extra` jsonb.
-- GENERATED together with lib/db/schema.ts in both apps — add new columns in a NEW migration and
-- mirror them in TABLE_COLUMNS of both apps.
-- =============================================================================

create schema if not exists private;
grant usage on schema private to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Users — every account with its role; change a role from the dropdown in the Table Editor.
-- 'Pending' = no access yet (every new login starts here until a role is given).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'user_role'
  ) then
    create type public.user_role as enum (
      'Admin', 'Secretary', 'Staff', 'View Only', 'S.P MEMBER', 'Pending'
    );
  end if;
end
$$;

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  username text collate "C" not null,
  role public.user_role not null default 'Pending',
  privileges text[] not null default '{}',
  first_name text collate "C",
  middle_name text collate "C",
  last_name text collate "C",
  suffix text collate "C",
  contact_number text collate "C",
  birthday text collate "C",
  gender text collate "C",
  address text collate "C",
  file_path text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists users_username_lower_key on public.users (lower(username));

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper functions (security definer, so policies can read users without recursion)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function private.is_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users u
    where u.id = (select auth.uid()) and u.role <> 'Pending'
  );
$$;

create or replace function private.has_privilege(privilege text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.users u
    where u.id = (select auth.uid())
      and (u.role = 'Admin' or (u.role <> 'Pending' and privilege = any (u.privileges)))
  );
$$;

-- Storage folder (first path segment) → privilege needed to upload/replace/delete there.
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
    when 'Judicial' then 'Quasi-Judicial Function'
    when 'Addendum' then 'Addendum and Corrections'
    when 'otherMatters' then 'Other Matters'
    when 'tricycle' then 'Tricycle Franchise'
    when 'Users' then 'Account Management'
    else null
  end;
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- New Auth user → users row. The role always starts as 'Pending'; the admin-users Edge
-- Function (or an admin in the Table Editor) sets the real role and privileges.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, username)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.is_member() from public;
revoke all on function private.has_privilege(text) from public;
revoke all on function private.folder_privilege(text) from public;
grant execute on function private.is_member() to authenticated;
grant execute on function private.has_privilege(text) to authenticated;
grant execute on function private.folder_privilege(text) to authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Logins created before this script ran (e.g. in the dashboard) still get a users row.
insert into public.users (id, username)
select a.id, coalesce(nullif(a.raw_user_meta_data ->> 'username', ''), split_part(a.email, '@', 1))
from auth.users a
on conflict do nothing;

-- Super admin (AionX): its login lives in Supabase Auth. Mark its email as confirmed (no
-- confirmation email needed) and give it the Admin role the first time the script runs after
-- that login exists (a role changed later is left alone).
do $$
begin
  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now())
  where lower(email) = 'adolfotristanjames@gmail.com';
exception when insufficient_privilege then
  raise notice 'Could not confirm the super admin email here: %', sqlerrm;
end
$$;

update public.users u
set role = 'Admin',
    first_name = coalesce(u.first_name, 'Super'),
    last_name = coalesce(u.last_name, 'Admin')
from auth.users a
where a.id = u.id
  and lower(a.email) = 'adolfotristanjames@gmail.com'
  and u.role = 'Pending';

drop trigger if exists set_updated_at on public.users;
create trigger set_updated_at
  before update on public.users
  for each row execute function private.set_updated_at();

alter table public.users enable row level security;
drop policy if exists "read own row or manage accounts" on public.users;
create policy "read own row or manage accounts" on public.users
  for select to authenticated
  using (id = (select auth.uid()) or private.has_privilege('Account Management'));
-- No insert/update/delete policies: from the apps, accounts are written only by the admin-users
-- Edge Function. (The dashboard's Table Editor bypasses these rules, so roles can be set there.)

-- ─────────────────────────────────────────────────────────────────────────────
-- Module tables
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.ordinances (
  id uuid primary key default gen_random_uuid(),
  ordinance_number text collate "C",
  category text collate "C",
  title text collate "C",
  author text collate "C",
  tag text collate "C",
  date_approved_sp text collate "C",
  action_sp text collate "C",
  transmitted_date_mayor text collate "C",
  action_mayor text collate "C",
  transmitted_date_sp text collate "C",
  action_tsp text collate "C",
  date_received text collate "C",
  posting_date text collate "C",
  publication_date text collate "C",
  created text collate "C",
  updated text collate "C",
  size text collate "C",
  file_path text,
  file_type text,
  code_sort_key text collate "C",
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ordinances_category_idx on public.ordinances (category);
create index if not exists ordinances_code_sort_key_idx on public.ordinances (code_sort_key);

create table if not exists public.resolutions (
  id uuid primary key default gen_random_uuid(),
  resolution_number text collate "C",
  category text collate "C",
  title text collate "C",
  author text collate "C",
  tag text collate "C",
  date_approved_sp text collate "C",
  action_sp text collate "C",
  transmitted_date_mayor text collate "C",
  action_mayor text collate "C",
  transmitted_date_sp text collate "C",
  action_tsp text collate "C",
  date_received text collate "C",
  posting_date text collate "C",
  publication_date text collate "C",
  created text collate "C",
  updated text collate "C",
  file_path text,
  file_type text,
  code_sort_key text collate "C",
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists resolutions_category_idx on public.resolutions (category);
create index if not exists resolutions_code_sort_key_idx on public.resolutions (code_sort_key);

create table if not exists public.draft_ordinances (
  id uuid primary key default gen_random_uuid(),
  draft_ordinance_number text collate "C",
  title text collate "C",
  author text collate "C",
  session_no text collate "C",
  tag text collate "C",
  reading text collate "C",
  action_committee text collate "C",
  action_referred text collate "C",
  date_of_reading text collate "C",
  time_of_reading text collate "C",
  file_path text,
  file_type text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists draft_ordinances_session_no_idx on public.draft_ordinances (session_no);

create table if not exists public.draft_resolutions (
  id uuid primary key default gen_random_uuid(),
  draft_resolution_number text collate "C",
  title text collate "C",
  author text collate "C",
  tag text collate "C",
  session_no text collate "C",
  reading text collate "C",
  action_of_officer text collate "C",
  date_received text collate "C",
  date_of_reading text collate "C",
  time_received text collate "C",
  file_path text,
  file_type text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists draft_resolutions_session_no_idx on public.draft_resolutions (session_no);

create table if not exists public.minutes (
  id uuid primary key default gen_random_uuid(),
  session_no text collate "C",
  date text collate "C",
  category text collate "C",
  time text collate "C",
  call_order text collate "C",
  place text collate "C",
  agenda text collate "C",
  tag text collate "C",
  adjournment_time text collate "C",
  prayer text collate "C",
  present text[],
  absent text[],
  file_path text,
  file_type text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists minutes_session_no_idx on public.minutes (session_no);
create index if not exists minutes_category_idx on public.minutes (category);

create table if not exists public.transcripts (
  id uuid primary key default gen_random_uuid(),
  session_no text collate "C",
  session_category text collate "C",
  previous_session_no text collate "C",
  date_of_previous_session text collate "C",
  transcript_no text collate "C",
  transcript_category text collate "C",
  tag text collate "C",
  file_path text,
  file_type text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists transcripts_session_no_idx on public.transcripts (session_no);

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  communication_no text collate "C",
  title text collate "C",
  author text collate "C",
  session_no text collate "C",
  status text collate "C",
  tag text collate "C",
  date_received text collate "C",
  time_received text collate "C",
  file_path text,
  file_type text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists communications_session_no_idx on public.communications (session_no);

create table if not exists public.incoming_communications (
  id uuid primary key default gen_random_uuid(),
  io_number text collate "C",
  incoming_description text collate "C",
  date_received text collate "C",
  time_received text collate "C",
  tags text collate "C",
  remarks text collate "C",
  file_path text,
  file_type text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.brgy_actions (
  id uuid primary key default gen_random_uuid(),
  brgy text collate "C",
  category text collate "C",
  measures_no text collate "C",
  measures_title text collate "C",
  resolution_number text collate "C",
  action text collate "C",
  tag text collate "C",
  date_approved text collate "C",
  date_received text collate "C",
  time_received text collate "C",
  date_released text collate "C",
  time_released text collate "C",
  file_path text,
  file_type text,
  code_sort_key text collate "C",
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists brgy_actions_category_idx on public.brgy_actions (category);

create table if not exists public.brgy_reviews (
  id uuid primary key default gen_random_uuid(),
  review_no text collate "C",
  title text collate "C",
  description text collate "C",
  district_councilor text collate "C",
  session_no text collate "C",
  tag text collate "C",
  date_received text collate "C",
  time_received text collate "C",
  category text collate "C",
  file_path text,
  file_type text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists brgy_reviews_session_no_idx on public.brgy_reviews (session_no);

create table if not exists public.committees (
  id uuid primary key default gen_random_uuid(),
  title text collate "C",
  batch text collate "C",
  description text collate "C",
  chairman text collate "C",
  vice_chairman text collate "C",
  members text[],
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.committee_reports (
  id uuid primary key default gen_random_uuid(),
  committee_reports_no text collate "C",
  committee text collate "C",
  title text collate "C",
  session_no text collate "C",
  tag text collate "C",
  date_received text collate "C",
  time_received text collate "C",
  file_path text,
  file_type text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists committee_reports_session_no_idx on public.committee_reports (session_no);

create table if not exists public.judicial_cases (
  id uuid primary key default gen_random_uuid(),
  case_number text collate "C",
  title text collate "C",
  petitioner text collate "C",
  respondent text collate "C",
  date text collate "C",
  action text collate "C",
  file_path text,
  file_type text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.corrections (
  id uuid primary key default gen_random_uuid(),
  addendum_no text collate "C",
  session_no text collate "C",
  title text collate "C",
  category text collate "C",
  file_path text,
  file_type text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists corrections_session_no_idx on public.corrections (session_no);

create table if not exists public.edited_corrections (
  id uuid primary key default gen_random_uuid(),
  or_no text collate "C",
  session_no text collate "C",
  content text collate "C",
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists edited_corrections_session_no_idx on public.edited_corrections (session_no);
create index if not exists edited_corrections_or_no_idx on public.edited_corrections (or_no);

create table if not exists public.other_matters (
  id uuid primary key default gen_random_uuid(),
  other_matters_no text collate "C",
  title text collate "C",
  session_no text collate "C",
  date_received text collate "C",
  time_received text collate "C",
  status text collate "C",
  author text collate "C",
  tag text collate "C",
  file_path text,
  file_type text,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists other_matters_session_no_idx on public.other_matters (session_no);

create table if not exists public.tricycle_franchises (
  id uuid primary key default gen_random_uuid(),
  name text collate "C",
  address text collate "C",
  make text collate "C",
  motor_no text collate "C",
  chassis_no text collate "C",
  plate_no text collate "C",
  franchise_no text collate "C",
  ordinance_number text collate "C",
  expiration text collate "C",
  date_received text collate "C",
  time_received text collate "C",
  nature_of_franchise text collate "C",
  category text collate "C",
  action text collate "C",
  file_path text,
  file_type text,
  code_sort_key text collate "C",
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.officials (
  id uuid primary key default gen_random_uuid(),
  first_name text collate "C",
  middle_name text collate "C",
  last_name text collate "C",
  suffix text collate "C",
  position text collate "C",
  term text collate "C",
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  name text collate "C",
  activity text collate "C",
  date text collate "C",
  year integer,
  extra jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Row level security + updated_at triggers for every module table
--   read:   any signed-in member (role is not 'Pending')
--   write:  Admin, or a member holding the module's privilege
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t record;
begin
  for t in
    select * from (values
      ('ordinances', 'Ordinances', 'standard'),
      ('resolutions', 'Resolutions', 'standard'),
      ('draft_ordinances', 'Draft Ordinance/s and Draft Resolutions', 'standard'),
      ('draft_resolutions', 'Draft Ordinance/s and Draft Resolutions', 'standard'),
      ('minutes', 'Calendar of Business', 'standard'),
      ('transcripts', 'Transcript of Proceedings', 'standard'),
      ('communications', 'Other Communications', 'standard'),
      ('incoming_communications', 'Incoming', 'standard'),
      ('brgy_actions', 'Barangay Actions', 'standard'),
      ('brgy_reviews', 'Barangay Review', 'standard'),
      ('committees', 'Standing Committees', 'standard'),
      ('committee_reports', 'Committee Reports', 'standard'),
      ('judicial_cases', 'Quasi-Judicial Function', 'standard'),
      ('corrections', 'Addendum and Corrections', 'standard'),
      ('edited_corrections', 'Addendum and Corrections', 'member-update'),
      ('other_matters', 'Other Matters', 'standard'),
      ('tricycle_franchises', 'Tricycle Franchise', 'standard'),
      ('officials', 'S.P Members', 'standard'),
      ('activity_logs', null, 'append-only')
    ) as v(tbl, privilege, mode)
  loop
    execute format('alter table public.%I enable row level security', t.tbl);

    execute format('drop trigger if exists set_updated_at on public.%I', t.tbl);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function private.set_updated_at()',
      t.tbl
    );

    execute format('drop policy if exists "members can read" on public.%I', t.tbl);
    execute format('drop policy if exists "privileged can insert" on public.%I', t.tbl);
    execute format('drop policy if exists "members can insert" on public.%I', t.tbl);
    execute format('drop policy if exists "privileged can update" on public.%I', t.tbl);
    execute format('drop policy if exists "members can update" on public.%I', t.tbl);
    execute format('drop policy if exists "privileged can delete" on public.%I', t.tbl);

    execute format(
      'create policy "members can read" on public.%I for select to authenticated using (private.is_member())',
      t.tbl
    );

    if t.mode = 'append-only' then
      execute format(
        'create policy "members can insert" on public.%I for insert to authenticated with check (private.is_member())',
        t.tbl
      );
      continue;
    end if;

    execute format(
      'create policy "privileged can insert" on public.%I for insert to authenticated with check (private.has_privilege(%L))',
      t.tbl, t.privilege
    );
    if t.mode = 'member-update' then
      execute format(
        'create policy "members can update" on public.%I for update to authenticated using (private.is_member()) with check (private.is_member())',
        t.tbl
      );
    else
      execute format(
        'create policy "privileged can update" on public.%I for update to authenticated using (private.has_privilege(%L)) with check (private.has_privilege(%L))',
        t.tbl, t.privilege, t.privilege
      );
    end if;
    execute format(
      'create policy "privileged can delete" on public.%I for delete to authenticated using (private.has_privilege(%L))',
      t.tbl, t.privilege
    );
  end loop;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime (the mobile app's lists and session view update live)
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array[
    'ordinances',
    'resolutions',
    'draft_ordinances',
    'draft_resolutions',
    'minutes',
    'transcripts',
    'communications',
    'incoming_communications',
    'brgy_actions',
    'brgy_reviews',
    'committees',
    'committee_reports',
    'judicial_cases',
    'corrections',
    'edited_corrections',
    'other_matters',
    'tricycle_franchises',
    'officials'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage: private "documents" bucket
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

drop policy if exists "documents: members can read" on storage.objects;
create policy "documents: members can read" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and private.is_member());

drop policy if exists "documents: privileged can upload" on storage.objects;
create policy "documents: privileged can upload" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'documents'
    and private.has_privilege(private.folder_privilege((storage.foldername(name))[1]))
  );

drop policy if exists "documents: privileged can update" on storage.objects;
create policy "documents: privileged can update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'documents'
    and private.has_privilege(private.folder_privilege((storage.foldername(name))[1]))
  )
  with check (
    bucket_id = 'documents'
    and private.has_privilege(private.folder_privilege((storage.foldername(name))[1]))
  );

drop policy if exists "documents: privileged can delete" on storage.objects;
create policy "documents: privileged can delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'documents'
    and private.has_privilege(private.folder_privilege((storage.foldername(name))[1]))
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- First administrator
--   1. Authentication → Users → Add user → Create new user
--        email: admin@candon-lis.local   (log in to the apps with username "admin")
--        tick "Auto Confirm User"
--   2. Table Editor → users → on the "admin" row pick role = Admin from the dropdown
--      (optionally fill first_name / last_name).
--   3. Authentication → Sign In / Providers → turn OFF "Allow new users to sign up".
-- ─────────────────────────────────────────────────────────────────────────────

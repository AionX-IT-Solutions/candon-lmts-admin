create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  event_id uuid not null,
  title text not null,
  body text not null,
  route text not null,
  module text not null,
  record_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique (user_id, event_id)
);

create index if not exists notifications_user_unread_created_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;
drop policy if exists "read own notifications" on public.notifications;
create policy "read own notifications" on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()));
drop policy if exists "mark own notifications read" on public.notifications;
create policy "mark own notifications read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.notifications from anon, authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant all on public.notifications to service_role;

create table if not exists public.expo_push_tokens (
  user_id uuid not null references public.users (id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now(),
  primary key (user_id, expo_push_token)
);

alter table public.expo_push_tokens enable row level security;
drop policy if exists "manage own Expo push tokens" on public.expo_push_tokens;
create policy "manage own Expo push tokens" on public.expo_push_tokens
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.expo_push_tokens from anon, authenticated;
grant select, insert, delete on public.expo_push_tokens to authenticated;
grant update (platform, updated_at) on public.expo_push_tokens to authenticated;
grant all on public.expo_push_tokens to service_role;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    )
  then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;

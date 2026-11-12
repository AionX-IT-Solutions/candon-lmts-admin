create table if not exists public.user_notification_preferences (
  user_id uuid primary key references public.users (id) on delete cascade,
  app_enabled boolean not null default true,
  messages_enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.user_notification_preferences enable row level security;

drop policy if exists "read own notification preferences" on public.user_notification_preferences;
create policy "read own notification preferences" on public.user_notification_preferences
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "insert own notification preferences" on public.user_notification_preferences;
create policy "insert own notification preferences" on public.user_notification_preferences
  for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "update own notification preferences" on public.user_notification_preferences;
create policy "update own notification preferences" on public.user_notification_preferences
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.user_notification_preferences from anon, authenticated;
grant select, insert, update on public.user_notification_preferences to authenticated;
grant all on public.user_notification_preferences to service_role;

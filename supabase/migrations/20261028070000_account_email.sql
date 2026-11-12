-- =============================================================================
-- Account email
--   • An account can have a real email: it becomes its Supabase Auth (sign-in) email instead
--     of <username>@candon-lis.local. The admin-users Edge Function sets it.
--   • public.users.email mirrors it for the apps (blank = signs in with the username only).
--   • public.sign_in_email(login) gives the login screens the email behind a username, so
--     every account can sign in with its username or its email.
-- Mirror the new column in TABLE_COLUMNS (lib/db/schema.ts) of candon-lmts-admin and candon-app.
-- =============================================================================

alter table public.users add column if not exists email text collate "C";

-- Accounts that already sign in with a real email (e.g. the super admin)
update public.users u
set email = a.email
from auth.users a
where a.id = u.id
  and a.email is not null
  and a.email not ilike '%@candon-lis.local';

-- New logins: copy a real email along with the username
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, username, email)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(new.email, '@', 1)),
    case when new.email ilike '%@candon-lis.local' then null else new.email end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Keep users.email in step when a sign-in email changes (Edge Function or dashboard)
create or replace function private.sync_user_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.users
  set email = case when new.email ilike '%@candon-lis.local' then null else new.email end
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;
create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row execute function private.sync_user_email();

-- Username → the email to sign in with. Called before signing in, so anyone can use it; it
-- reveals an account's email to someone who knows its username, never anything else.
create or replace function public.sign_in_email(login text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select a.email
  from public.users u
  join auth.users a on a.id = u.id
  where lower(u.username) = lower(trim(login))
  limit 1;
$$;

revoke all on function public.sign_in_email(text) from public;
grant execute on function public.sign_in_email(text) to anon, authenticated;

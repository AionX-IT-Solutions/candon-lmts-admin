-- =============================================================================
-- Self-registration name metadata (unique version assigned before deployment).
--   candon-app now lets an S.P Member register themselves (supabase.auth.signUp()); they still
--   land as role='Pending'/privileges='{}' exactly as before — this migration does NOT touch
--   that safety at all. It only extends handle_new_user() to also copy first/middle/last name
--   from the signup's own metadata when present, so an admin approving the account in Account
--   Management doesn't have to type the registrant's name in by hand.
-- =============================================================================

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, username, email, first_name, middle_name, last_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(new.email, '@', 1)),
    case when new.email ilike '%@candon-lis.local' then null else new.email end,
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'middle_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

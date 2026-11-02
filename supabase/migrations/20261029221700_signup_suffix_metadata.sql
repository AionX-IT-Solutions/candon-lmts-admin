-- Copy the optional suffix supplied during candon-app self-registration into the pending user row.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, username, email, first_name, middle_name, last_name, suffix)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(new.email, '@', 1)),
    case when new.email ilike '%@candon-lis.local' then null else new.email end,
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'middle_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', ''),
    nullif(new.raw_user_meta_data ->> 'suffix', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

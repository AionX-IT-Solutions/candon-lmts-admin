drop function if exists public.upcoming_birthday_greetings();

create function public.upcoming_birthday_greetings()
returns table (display_name text, days_until integer, photo_path text)
language sql
stable
security definer
set search_path = ''
set row_security = off
as $$
  select
    trim(concat_ws(
      ' ',
      nullif(trim(u.first_name), ''),
      nullif(trim(u.middle_name), ''),
      nullif(trim(u.last_name), ''),
      nullif(trim(u.suffix), '')
    )) as display_name,
    days.days_until::integer,
    coalesce(o.file_path, u.file_path) as photo_path
  from public.users as u
  left join public.officials as o on o.id = u.official_id
  cross join generate_series(0, 3) as days(days_until)
  where auth.uid() is not null
    and u.role::text <> 'Pending'
    and u.birthday ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    and to_char(current_date + days.days_until, 'MM-DD') = substring(u.birthday from 6 for 5)
  order by days.days_until, display_name;
$$;

revoke all on function public.upcoming_birthday_greetings() from public, anon;
grant execute on function public.upcoming_birthday_greetings() to authenticated;

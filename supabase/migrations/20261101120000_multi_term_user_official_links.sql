create table if not exists public.user_official_links (
  user_id uuid not null references public.users (id) on delete cascade,
  official_id uuid not null references public.officials (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, official_id)
);

create index if not exists user_official_links_official_id_idx
  on public.user_official_links (official_id);

insert into public.user_official_links (user_id, official_id)
select id, official_id
from public.users
where official_id is not null
on conflict (user_id, official_id) do nothing;

alter table public.user_official_links enable row level security;

drop policy if exists "users can read own official links or account management can read all"
  on public.user_official_links;
create policy "users can read own official links or account management can read all"
  on public.user_official_links
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or private.can('Account Management', 'view')
  );

revoke all on public.user_official_links from public, anon, authenticated;
grant select on public.user_official_links to authenticated;
grant all on public.user_official_links to service_role;

create or replace function public.set_user_official_links(
  p_user_id uuid,
  p_official_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.user_official_links
  where user_id = p_user_id;

  insert into public.user_official_links (user_id, official_id)
  select p_user_id, selected.official_id
  from unnest(coalesce(p_official_ids, '{}'::uuid[]))
    with ordinality as selected(official_id, position)
  where selected.official_id is not null
  order by selected.position
  on conflict (user_id, official_id) do nothing;

  update public.users
  set official_id = (
    select selected.official_id
    from unnest(coalesce(p_official_ids, '{}'::uuid[]))
      with ordinality as selected(official_id, position)
    where selected.official_id is not null
    order by selected.position
    limit 1
  )
  where id = p_user_id;
end;
$$;

revoke all on function public.set_user_official_links(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.set_user_official_links(uuid, uuid[]) to service_role;

alter table public.users
  add column if not exists official_id uuid
  references public.officials (id)
  on delete set null;

create index if not exists users_official_id_idx
  on public.users (official_id)
  where official_id is not null;

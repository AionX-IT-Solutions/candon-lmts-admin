create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  name text,
  is_group boolean not null default false,
  dm_key text unique,
  created_by uuid not null references public.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  constraint chat_conversations_direct_message_shape check (
    (is_group and name is not null and dm_key is null)
    or (not is_group and name is null)
  )
);

create table if not exists public.chat_participants (
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index if not exists chat_participants_user_idx
  on public.chat_participants (user_id, conversation_id);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  sender_id uuid not null references public.users (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conversation_created_idx
  on public.chat_messages (conversation_id, created_at desc);

create or replace function private.is_chat_participant(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.users u
    join public.chat_participants cp on cp.user_id = u.id
    where u.id = (select auth.uid())
      and u.role::text <> 'Pending'
      and cp.conversation_id = p_conversation_id
  );
$$;

revoke all on function private.is_chat_participant(uuid) from public;
grant execute on function private.is_chat_participant(uuid) to authenticated;

alter table public.chat_conversations enable row level security;
alter table public.chat_participants enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "chat members read conversations" on public.chat_conversations;
create policy "chat members read conversations" on public.chat_conversations
  for select to authenticated
  using (private.is_chat_participant(id));

drop policy if exists "chat members read participants" on public.chat_participants;
create policy "chat members read participants" on public.chat_participants
  for select to authenticated
  using (private.is_chat_participant(conversation_id));

drop policy if exists "chat members read messages" on public.chat_messages;
create policy "chat members read messages" on public.chat_messages
  for select to authenticated
  using (private.is_chat_participant(conversation_id));

drop policy if exists "chat members send messages as themselves" on public.chat_messages;
create policy "chat members send messages as themselves" on public.chat_messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and private.is_chat_participant(conversation_id)
  );

revoke all on public.chat_conversations, public.chat_participants, public.chat_messages
  from anon, authenticated;
grant select on public.chat_conversations, public.chat_participants, public.chat_messages
  to authenticated;
grant insert (conversation_id, sender_id, body) on public.chat_messages to authenticated;
grant all on public.chat_conversations, public.chat_participants, public.chat_messages
  to service_role;

create or replace function public.search_chat_users(p_query text default '')
returns table (
  id uuid,
  username text,
  first_name text,
  last_name text,
  file_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select u.id, u.username, u.first_name, u.last_name, u.file_path
  from public.users u
  where u.id <> (select auth.uid())
    and u.role::text <> 'Pending'
    and exists (
      select 1 from public.users self
      where self.id = (select auth.uid()) and self.role::text <> 'Pending'
    )
    and (
      nullif(btrim(p_query), '') is null
        or strpos(
          lower(concat_ws(' ', u.first_name, u.last_name, u.username)),
          lower(btrim(p_query))
        ) > 0
    )
  order by u.last_name nulls last, u.first_name nulls last, u.username
  limit 40;
$$;

create or replace function public.create_chat(
  p_is_group boolean,
  p_name text default null,
  p_participant_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_ids uuid[];
  v_requested_count integer;
  v_approved_count integer;
  v_dm_key text;
  v_conversation_id uuid;
begin
  if p_is_group is null then
    raise exception 'Choose a direct chat or a chatroom';
  end if;

  if v_user_id is null or not exists (
    select 1 from public.users u
    where u.id = v_user_id and u.role::text <> 'Pending'
  ) then
    raise exception 'An active account is required to start a chat';
  end if;

  select array_agg(distinct participant_id order by participant_id)
  into v_ids
  from unnest(coalesce(p_participant_ids, '{}'::uuid[]) || array[v_user_id])
    as requested(participant_id);

  v_requested_count := cardinality(v_ids);
  if v_requested_count > 51 then
    raise exception 'A chat can have no more than 50 invited users';
  end if;
  select count(*) into v_approved_count
  from public.users u
  where u.id = any(v_ids) and u.role::text <> 'Pending';

  if v_requested_count <> v_approved_count then
    raise exception 'One or more selected users are unavailable';
  end if;

  if p_is_group then
    if v_requested_count < 3 then
      raise exception 'A chatroom needs at least two other members';
    end if;
    if nullif(btrim(p_name), '') is null or char_length(btrim(p_name)) > 80 then
      raise exception 'Enter a room name between 1 and 80 characters';
    end if;
    insert into public.chat_conversations (name, is_group, created_by)
    values (btrim(p_name), true, v_user_id)
    returning id into v_conversation_id;
  else
    if v_requested_count <> 2 then
      raise exception 'A direct chat must have exactly one other user';
    end if;
    select array_to_string(array_agg(participant_id::text order by participant_id::text), ':')
    into v_dm_key
    from unnest(v_ids) as selected(participant_id);

    insert into public.chat_conversations (is_group, dm_key, created_by)
    values (false, v_dm_key, v_user_id)
    on conflict (dm_key) do nothing
    returning id into v_conversation_id;

    if v_conversation_id is null then
      select c.id into v_conversation_id
      from public.chat_conversations c
      where c.dm_key = v_dm_key;
    end if;
  end if;

  insert into public.chat_participants (conversation_id, user_id)
  select v_conversation_id, participant_id
  from unnest(v_ids) as selected(participant_id)
  on conflict (conversation_id, user_id) do nothing;

  return v_conversation_id;
end;
$$;

create or replace function public.get_chat_members(p_conversation_id uuid)
returns table (
  user_id uuid,
  username text,
  first_name text,
  last_name text,
  file_path text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_chat_participant(p_conversation_id) then
    raise exception 'You are not a member of this chat';
  end if;

  return query
  select u.id, u.username, u.first_name, u.last_name, u.file_path
  from public.chat_participants cp
  join public.users u on u.id = cp.user_id
  where cp.conversation_id = p_conversation_id
  order by u.last_name nulls last, u.first_name nulls last, u.username;
end;
$$;

create or replace function public.mark_chat_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_chat_participant(p_conversation_id) then
    raise exception 'You are not a member of this chat';
  end if;

  update public.chat_participants
  set last_read_at = now()
  where conversation_id = p_conversation_id
    and user_id = (select auth.uid());
end;
$$;

create or replace function public.get_chat_inbox()
returns table (
  conversation_id uuid,
  name text,
  is_group boolean,
  title text,
  participants jsonb,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    c.id,
    c.name,
    c.is_group,
    case
      when c.is_group then c.name
      else coalesce(
        nullif(btrim(concat_ws(' ', peer.first_name, peer.last_name)), ''),
        peer.username,
        'Direct chat'
      )
    end,
    (
      select jsonb_agg(jsonb_build_object(
        'id', u.id,
        'username', u.username,
        'first_name', u.first_name,
        'last_name', u.last_name,
        'file_path', u.file_path
      ) order by u.last_name nulls last, u.first_name nulls last, u.username)
      from public.chat_participants cp
      join public.users u on u.id = cp.user_id
      where cp.conversation_id = c.id
    ),
    latest.body,
    c.last_message_at,
    (
      select count(*)
      from public.chat_messages m
      join public.chat_participants cp
        on cp.conversation_id = m.conversation_id
       and cp.user_id = (select auth.uid())
      where m.conversation_id = c.id
        and m.sender_id <> (select auth.uid())
        and m.created_at > cp.last_read_at
    )
  from public.chat_conversations c
  join public.chat_participants mine
    on mine.conversation_id = c.id and mine.user_id = (select auth.uid())
  join public.users active_user
    on active_user.id = (select auth.uid()) and active_user.role::text <> 'Pending'
  left join lateral (
    select u.username, u.first_name, u.last_name
    from public.chat_participants cp
    join public.users u on u.id = cp.user_id
    where cp.conversation_id = c.id and cp.user_id <> (select auth.uid())
    order by u.last_name nulls last, u.first_name nulls last, u.username
    limit 1
  ) peer on true
  left join lateral (
    select m.body
    from public.chat_messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) latest on true
  order by c.last_message_at desc;
$$;

create or replace function public.get_chat_unread_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from public.chat_messages m
  join public.chat_participants cp
    on cp.conversation_id = m.conversation_id
   and cp.user_id = (select auth.uid())
  where m.sender_id <> (select auth.uid())
    and m.created_at > cp.last_read_at
    and exists (
      select 1 from public.users active_user
      where active_user.id = (select auth.uid()) and active_user.role::text <> 'Pending'
    );
$$;

revoke all on function public.search_chat_users(text) from public, anon;
revoke all on function public.create_chat(boolean, text, uuid[]) from public, anon;
revoke all on function public.get_chat_members(uuid) from public, anon;
revoke all on function public.mark_chat_read(uuid) from public, anon;
revoke all on function public.get_chat_inbox() from public, anon;
revoke all on function public.get_chat_unread_count() from public, anon;
grant execute on function public.search_chat_users(text) to authenticated;
grant execute on function public.create_chat(boolean, text, uuid[]) to authenticated;
grant execute on function public.get_chat_members(uuid) to authenticated;
grant execute on function public.mark_chat_read(uuid) to authenticated;
grant execute on function public.get_chat_inbox() to authenticated;
grant execute on function public.get_chat_unread_count() to authenticated;

create or replace function private.update_chat_last_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chat_conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists chat_messages_update_conversation on public.chat_messages;
create trigger chat_messages_update_conversation
  after insert on public.chat_messages
  for each row execute function private.update_chat_last_message();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'chat_messages'
    ) then
      alter publication supabase_realtime add table public.chat_messages;
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'chat_participants'
    ) then
      alter publication supabase_realtime add table public.chat_participants;
    end if;
  end if;
end
$$;

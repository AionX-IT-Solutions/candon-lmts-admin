alter table public.chat_participants
  add column if not exists hidden_at timestamptz;

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

  update public.chat_participants
  set hidden_at = null
  where conversation_id = v_conversation_id
    and user_id = any(v_ids);

  return v_conversation_id;
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
        and cp.hidden_at is null
        and m.sender_id <> (select auth.uid())
        and m.created_at > cp.last_read_at
    )
  from public.chat_conversations c
  join public.chat_participants mine
    on mine.conversation_id = c.id
   and mine.user_id = (select auth.uid())
   and mine.hidden_at is null
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
   and cp.hidden_at is null
  where m.sender_id <> (select auth.uid())
    and m.created_at > cp.last_read_at
    and exists (
      select 1 from public.users active_user
      where active_user.id = (select auth.uid()) and active_user.role::text <> 'Pending'
    );
$$;

create or replace function public.hide_chat_for_me(p_conversation_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null or not private.is_chat_participant(p_conversation_id) then
    raise exception 'You are not a member of this chat';
  end if;

  update public.chat_participants
  set hidden_at = coalesce(hidden_at, now())
  where conversation_id = p_conversation_id and user_id = v_user_id;

  if not exists (
    select 1
    from public.chat_participants cp
    where cp.conversation_id = p_conversation_id and cp.hidden_at is null
  ) then
    delete from public.chat_conversations where id = p_conversation_id;
    return true;
  end if;

  return false;
end;
$$;

revoke all on function public.create_chat(boolean, text, uuid[]) from public, anon;
revoke all on function public.get_chat_inbox() from public, anon;
revoke all on function public.get_chat_unread_count() from public, anon;
revoke all on function public.hide_chat_for_me(uuid) from public, anon;
grant execute on function public.create_chat(boolean, text, uuid[]) to authenticated;
grant execute on function public.get_chat_inbox() to authenticated;
grant execute on function public.get_chat_unread_count() to authenticated;
grant execute on function public.hide_chat_for_me(uuid) to authenticated;

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

  update public.chat_participants
  set hidden_at = null
  where conversation_id = new.conversation_id and hidden_at is not null;

  return new;
end;
$$;

notify pgrst, 'reload schema';

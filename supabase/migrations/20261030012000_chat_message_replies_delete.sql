alter table public.chat_messages
  add column if not exists reply_to_message_id uuid
    references public.chat_messages (id) on delete set null;

drop policy if exists "chat members delete own messages" on public.chat_messages;
create policy "chat members delete own messages" on public.chat_messages
  for delete to authenticated
  using (
    sender_id = (select auth.uid())
    and private.is_chat_participant(conversation_id)
  );

grant delete on public.chat_messages to authenticated;
grant insert (conversation_id, sender_id, body, reply_to_message_id)
  on public.chat_messages to authenticated;

notify pgrst, 'reload schema';

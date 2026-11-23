-- Michat 000006 FIXED: only read OLD on UPDATE

create or replace function public.messages_guard()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and auth.role() <> 'service_role' then
    if new.sender_id is distinct from old.sender_id
    or new.sender is distinct from old.sender
    or new.chat_name is distinct from old.chat_name
    or new.group_id is distinct from old.group_id
    or new.created_at is distinct from old.created_at
    then
      raise exception 'message identity and routing fields are immutable';
    end if;

    if auth.uid() is distinct from old.sender_id
    and (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status')
    then
      raise exception 'recipients may only update message status';
    end if;
  end if;

  if tg_op = 'INSERT'
  and auth.role() <> 'service_role'
  and (select count(*) from public.messages where sender_id = auth.uid() and created_at > now() - interval '60 seconds') >= 30
  then
    raise exception 'rate limit: slow down';
  end if;

  return new;
end
$$;

drop trigger if exists messages_guard_t on public.messages;

create trigger messages_guard_t
before insert or update
on public.messages
for each row
execute function public.messages_guard();
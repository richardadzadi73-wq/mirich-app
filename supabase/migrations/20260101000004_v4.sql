-- MICHAT v4
-- (run after supabase-v3.sql):
-- channels

alter table groups
  add column if not exists
  is_channel boolean default false;

create or replace function browse_channels()
returns table(
  id text,
  name text,
  created_by text,
  members bigint
)
language sql
security definer
set search_path = public
as $$
  select
    g.id::text,
    g.name,
    g.created_by,
    (
      select count(*)
      from group_members m
      where m.group_id = g.id
    )
  from groups g
  where g.is_channel
  order by 4 desc
  limit 50
$$;
create or replace function join_channel(
  p_id text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into group_members(
    group_id,
    member_name
  )
  select
    g.id,
    my_name()
  from groups g
  where g.id::text = p_id
  and g.is_channel
  and not exists(
    select 1
    from group_members m
    where m.group_id = g.id
    and m.member_name = my_name()
  )
$$;

create policy gm_leave
  on group_members
  for delete
  to authenticated
  using (member_name = my_name());
-- only the channel owner
-- may post in a channel

drop policy if exists
  msg_insert on messages;

create policy msg_insert
  on messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and (
      sender = my_name()
      or (
        sender = 'Mirich AI'
        and chat_name = my_name()
      )
    )
    and (
      group_id is null
      or not exists(
        select 1
        from groups g
        where g.id = group_id
        and g.is_channel
        and g.created_by <> my_name()
      )
    )
  );
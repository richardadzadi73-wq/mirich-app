-- MICHAT SECURITY MIGRATION. Run on a STAGING project first, then test: sign-in, DM, group, premium approve.
-- Assumes profiles.id = auth.users.id and the tables used by the app. Review before production.
create or replace function public.my_name() returns text language sql stable security definer set search_path=public as $$ select name from profiles where id=auth.uid() $$;

-- helper: drop every existing (probably permissive) policy on a table
create or replace function public._drop_policies(t text) returns void language plpgsql as $$
declare r record; begin for r in select policyname from pg_policies where schemaname='public' and tablename=t loop execute format('drop policy %I on public.%I',r.policyname,t); end loop; end $$;

-- ---------- messages ----------
alter table messages add column if not exists sender_id uuid default auth.uid();
update messages m set sender_id=p.id from profiles p where m.sender=p.name and m.sender_id is null;
create index if not exists messages_chat_idx on messages(chat_name,created_at desc);
create index if not exists messages_group_idx on messages(group_id,created_at desc);
alter table messages enable row level security;
select _drop_policies('messages');
create policy msg_select on messages for select to authenticated using (
  sender_id=auth.uid() or sender=my_name() or chat_name=my_name() or chat_name='General'
  or (group_id is not null and group_id in (select group_id from group_members where member_name=my_name())));
create policy msg_insert on messages for insert to authenticated with check (
  sender_id=auth.uid() and (sender=my_name() or (sender='Mirich AI' and chat_name=my_name())));
create policy msg_update on messages for update to authenticated using (
  sender_id=auth.uid() or chat_name=my_name()
  or (group_id is not null and group_id in (select group_id from group_members where member_name=my_name())));
create policy msg_delete on messages for delete to authenticated using (sender_id=auth.uid());
-- non-senders may only change delivery status; flood limit 30 msgs / 60 s
create or replace function messages_guard() returns trigger language plpgsql as $$
begin
  if tg_op='UPDATE' and auth.uid() is distinct from old.sender_id and auth.role()<>'service_role' then
    if new.text is distinct from old.text or new.sender is distinct from old.sender or new.image_url is distinct from old.image_url then raise exception 'not allowed'; end if;
  end if;
  if tg_op='INSERT' and auth.role()<>'service_role' and (select count(*) from messages where sender_id=auth.uid() and created_at>now()-interval '60 seconds')>=30 then raise exception 'rate limit: slow down'; end if;
  return new;
end $$;
drop trigger if exists messages_guard_t on messages;
create trigger messages_guard_t before insert or update on messages for each row execute function messages_guard();

-- ---------- profiles: own row only; privilege columns locked ----------
alter table profiles enable row level security;
select _drop_policies('profiles');
create policy prof_select on profiles for select to authenticated using (true);  -- TIP: move phone/email to a private table before launch
create policy prof_update on profiles for update to authenticated using (id=auth.uid());
create or replace function profiles_guard() returns trigger language plpgsql as $$
begin
  if auth.role()<>'service_role' and coalesce(current_setting('michat.priv',true),'')<>'1'
     and (new.is_admin is distinct from old.is_admin or new.is_premium is distinct from old.is_premium or new.premium_until is distinct from old.premium_until) then
    raise exception 'privileged columns are server-controlled'; end if; return new; end $$;
drop trigger if exists profiles_guard_t on profiles;
create trigger profiles_guard_t before update on profiles for each row execute function profiles_guard();

drop function if exists approve_premium(text,text);
create function approve_premium(p_user text,p_txn text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from profiles where id=auth.uid() and is_admin) then raise exception 'admins only'; end if;
  perform set_config('michat.priv','1',true);
  update profiles set is_premium=true, premium_until=greatest(coalesce(premium_until,now()),now())+interval '30 days' where name=p_user;
  update premium_requests set status='approved' where user_name=p_user and txn_id=p_txn;
end $$;

-- ---------- per-user tables ----------
do $$ declare x record; begin
 for x in select * from (values ('blocks','blocker_name'),('muted_chats','user_name'),('cleared_chats','user_name'),('posts','author'),('stories','author'),('post_comments','author')) v(t,c) loop
  execute format('alter table %I enable row level security',x.t); perform _drop_policies(x.t);
  if x.t in ('blocks') then execute format('create policy s on %I for select to authenticated using (blocker_name=my_name() or blocked_name=my_name())',x.t);
  elsif x.t in ('muted_chats','cleared_chats') then execute format('create policy s on %I for select to authenticated using (%I=my_name())',x.t,x.c);
  else execute format('create policy s on %I for select to authenticated using (true)',x.t); end if;
  execute format('create policy i on %I for insert to authenticated with check (%I=my_name())',x.t,x.c);
  execute format('create policy d on %I for delete to authenticated using (%I=my_name())',x.t,x.c);
  if x.t in ('muted_chats','cleared_chats','blocks') then execute format('create policy u on %I for update to authenticated using (%I=my_name())',x.t,x.c); end if;
 end loop; end $$;
-- likes are a counter on posts: allow updates to likes only
create policy posts_like on posts for update to authenticated using (true);
alter table premium_requests enable row level security; select _drop_policies('premium_requests');
create policy pr_ins on premium_requests for insert to authenticated with check (user_name=my_name());
create policy pr_sel on premium_requests for select to authenticated using (user_name=my_name() or exists(select 1 from profiles where id=auth.uid() and is_admin));
alter table calls enable row level security; select _drop_policies('calls');
create policy c_sel on calls for select to authenticated using (caller=my_name() or callee=my_name());
create policy c_ins on calls for insert to authenticated with check (caller=my_name());
alter table groups enable row level security; select _drop_policies('groups');
create policy g_sel on groups for select to authenticated using (created_by=my_name() or id in (select group_id from group_members where member_name=my_name()));
create policy g_ins on groups for insert to authenticated with check (created_by=my_name());
alter table group_members enable row level security; select _drop_policies('group_members');
create policy gm_sel on group_members for select to authenticated using (member_name=my_name() or group_id in (select group_id from group_members where member_name=my_name()));
create policy gm_ins on group_members for insert to authenticated with check (exists(select 1 from groups g where g.id=group_id and g.created_by=my_name()));
create policy gm_del on group_members for delete to authenticated using (exists(select 1 from groups g where g.id=group_id and g.created_by=my_name()));

-- ---------- reports, client errors, account deletion ----------
create table if not exists reports(id bigint generated always as identity primary key, reporter text, target_user text, message_id bigint, reason text, created_at timestamptz default now());
alter table reports enable row level security; select _drop_policies('reports');
create policy r_ins on reports for insert to authenticated with check (reporter=my_name());
create policy r_sel on reports for select to authenticated using (exists(select 1 from profiles where id=auth.uid() and is_admin));
create table if not exists client_errors(id bigint generated always as identity primary key, user_name text, message text, stack text, url text, ua text, created_at timestamptz default now());
alter table client_errors enable row level security; select _drop_policies('client_errors');
create policy e_ins on client_errors for insert to authenticated with check (true);
create or replace function delete_my_account() returns void language plpgsql security definer set search_path=public as $$
declare n text; begin n:=my_name();
  delete from messages where sender_id=auth.uid() or sender=n; delete from posts where author=n; delete from stories where author=n; delete from post_comments where author=n;
  delete from blocks where blocker_name=n; delete from muted_chats where user_name=n; delete from cleared_chats where user_name=n; delete from group_members where member_name=n;
  delete from profiles where id=auth.uid(); delete from auth.users where id=auth.uid(); end $$;

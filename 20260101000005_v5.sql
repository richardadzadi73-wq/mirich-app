-- MICHAT v5 (run after supabase-v4.sql): moderation, feedback, referrals, contact discovery
alter table profiles add column if not exists banned boolean default false;
create or replace function profiles_guard() returns trigger language plpgsql as $$
begin
  if auth.role()<>'service_role' and coalesce(current_setting('michat.priv',true),'')<>'1'
     and (new.is_admin is distinct from old.is_admin or new.is_premium is distinct from old.is_premium or new.premium_until is distinct from old.premium_until or new.banned is distinct from old.banned) then
    raise exception 'privileged columns are server-controlled'; end if; return new; end $$;
create or replace function not_banned() returns boolean language sql stable security definer set search_path=public as $$ select not coalesce((select banned from profiles where id=auth.uid()),false) $$;
drop policy if exists msg_insert on messages;
create policy msg_insert on messages for insert to authenticated with check (
  not_banned() and sender_id=auth.uid() and (sender=my_name() or (sender='Mirich AI' and chat_name=my_name()))
  and (group_id is null or not exists(select 1 from groups g where g.id=group_id and g.is_channel and g.created_by<>my_name())));
create or replace function admin_ban(p_user text,p_ban boolean) returns void language plpgsql security definer set search_path=public as $$
begin if not exists(select 1 from profiles where id=auth.uid() and is_admin) then raise exception 'admins only'; end if;
  perform set_config('michat.priv','1',true); update profiles set banned=p_ban where name=p_user and not is_admin; end $$;
-- admins may dismiss reports
drop policy if exists r_del on reports;
create policy r_del on reports for delete to authenticated using (exists(select 1 from profiles where id=auth.uid() and is_admin));

create table if not exists feedback(id bigint generated always as identity primary key,user_name text,message text,ua text,version text,created_at timestamptz default now());
alter table feedback enable row level security; select _drop_policies('feedback');
create policy fb_ins on feedback for insert to authenticated with check (user_name=my_name());
create policy fb_sel on feedback for select to authenticated using (exists(select 1 from profiles where id=auth.uid() and is_admin));

-- referrals: both sides get 7 days Premium; max 12 rewards per referrer; one claim per new user
create table if not exists referrals(invitee uuid primary key,referrer text,created_at timestamptz default now());
alter table referrals enable row level security;  -- no policies: functions only
create or replace function claim_referral(p_ref text) returns boolean language plpgsql security definer set search_path=public as $$
declare r profiles%rowtype; begin
  if exists(select 1 from referrals where invitee=auth.uid()) then return false; end if;
  select * into r from profiles where name=p_ref and id<>auth.uid(); if not found then return false; end if;
  if (select created_at from profiles where id=auth.uid()) < now()-interval '3 days' then return false; end if;  -- new users only
  insert into referrals(invitee,referrer) values(auth.uid(),p_ref);
  perform set_config('michat.priv','1',true);
  update profiles set is_premium=true,premium_until=greatest(coalesce(premium_until,now()),now())+interval '7 days' where id=auth.uid();
  if (select count(*) from referrals where referrer=p_ref)<=12 then
    update profiles set is_premium=true,premium_until=greatest(coalesce(premium_until,now()),now())+interval '7 days' where id=r.id; end if;
  return true; end $$;

-- contact discovery by SHA-256 of E.164 numbers (needs pgcrypto; max 500 per call)
create extension if not exists pgcrypto with schema extensions;
create or replace function find_by_phone_hashes(p_hashes text[]) returns table(name text) language plpgsql security definer set search_path=public,extensions as $$
begin if coalesce(array_length(p_hashes,1),0)>500 then raise exception 'too many'; end if;
  return query select p.name from profiles p where p.phone is not null and p.id<>auth.uid()
   and encode(digest(regexp_replace(p.phone,'[^0-9+]','','g'),'sha256'),'hex')=any(p_hashes); end $$;

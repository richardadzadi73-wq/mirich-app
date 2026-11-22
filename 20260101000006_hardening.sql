-- Michat security hardening (v6). Apply after migrations 000001–000005.
-- Test on staging before production.

-- 1) Messages: identity/routing fields are immutable. A recipient may only
-- update delivery status; the sender may edit content but cannot reassign it.
create or replace function public.messages_guard() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  if auth.role() <> 'service_role' then
    if new.sender_id is distinct from old.sender_id
       or new.sender is distinct from old.sender
       or new.chat_name is distinct from old.chat_name
       or new.group_id is distinct from old.group_id
       or new.created_at is distinct from old.created_at then
      raise exception 'message identity and routing fields are immutable';
    end if;
    if auth.uid() is distinct from old.sender_id
       and (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
      raise exception 'recipients may only update message status';
    end if;
  end if;
  if tg_op = 'INSERT' and auth.role() <> 'service_role'
     and (select count(*) from public.messages
          where sender_id=auth.uid() and created_at>now()-interval '60 seconds') >= 30 then
    raise exception 'rate limit: slow down';
  end if;
  return new;
end $$;

-- 2) Replace the unrestricted posts UPDATE policy with a server-side toggle.
-- The client cannot directly change likes or other post columns anymore.
drop policy if exists posts_like on public.posts;
create table if not exists public.post_likes (
  post_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(post_id,user_id)
);
alter table public.post_likes enable row level security;
drop policy if exists post_likes_read on public.post_likes;
-- No client table policies: likes change only through the authenticated RPC.
create or replace function public.toggle_post_like(p_post_id text)
returns boolean language plpgsql security definer set search_path=public as $$
declare liked boolean;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if p_post_id is null or length(p_post_id)>100 then raise exception 'invalid post id'; end if;
  if not exists(select 1 from public.posts where id::text=p_post_id) then raise exception 'post not found'; end if;
  delete from public.post_likes where post_id=p_post_id and user_id=auth.uid();
  if found then
    liked := false;
    update public.posts set likes=greatest(0,coalesce(likes,0)-1) where id::text=p_post_id;
  else
    insert into public.post_likes(post_id,user_id) values(p_post_id,auth.uid()) on conflict do nothing;
    if found then
      liked := true;
      update public.posts set likes=coalesce(likes,0)+1 where id::text=p_post_id;
    else
      liked := true;
    end if;
  end if;
  return liked;
end $$;
revoke all on function public.toggle_post_like(text) from public;
grant execute on function public.toggle_post_like(text) to authenticated;

-- 3) Atomic AI quota reservation. Only the service role can call this RPC.
create or replace function public.consume_ai_quota(p_user_id uuid,p_daily_limit integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare allowed boolean;
begin
  if auth.role() <> 'service_role' then raise exception 'service role required'; end if;
  if p_user_id is null or p_daily_limit < 1 or p_daily_limit > 1000 then raise exception 'invalid quota'; end if;
  insert into public.ai_usage(user_id,day,n) values(p_user_id,(now() at time zone 'utc')::date,1)
  on conflict(user_id,day) do update set n=ai_usage.n+1
    where public.ai_usage.n < p_daily_limit
  returning true into allowed;
  return coalesce(allowed,false);
end $$;
revoke all on function public.consume_ai_quota(uuid,integer) from public, anon, authenticated;
grant execute on function public.consume_ai_quota(uuid,integer) to service_role;


-- 4) Expand self-service account deletion to remove account-owned auxiliary data.
-- Reports about this user are intentionally retained for moderation/audit; reports
-- submitted by this user are removed. Group records are retained to avoid deleting
-- conversations belonging to other members.
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path=public as $$
declare n text; uid uuid;
begin
  uid := auth.uid();
  if uid is null then raise exception 'authentication required'; end if;
  select name into n from public.profiles where id=uid;
  if n is null then raise exception 'profile not found'; end if;

  delete from public.message_reactions where user_name=n;
  delete from public.post_likes where user_id=uid;
  delete from public.poll_votes where user_name=n;
  delete from public.messages where sender_id=uid or (sender_id is null and sender=n);
  delete from public.posts where author=n;
  delete from public.stories where author=n;
  delete from public.post_comments where author=n;
  delete from public.blocks where blocker_name=n;
  delete from public.muted_chats where user_name=n;
  delete from public.cleared_chats where user_name=n;
  delete from public.group_members where member_name=n;
  delete from public.calls where caller=n or callee=n;
  delete from public.reports where reporter=n;
  delete from public.feedback where user_name=n;
  delete from public.premium_requests where user_name=n;
  delete from public.referrals where invitee=uid;
  delete from public.push_subscriptions where user_id=uid;
  delete from public.key_backups where user_id=uid;
  delete from public.ai_usage where user_id=uid;
  delete from public.profiles where id=uid;
  delete from auth.users where id=uid;
end $$;
revoke all on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

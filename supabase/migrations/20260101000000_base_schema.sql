-- Michat 000000: base schema

create table if not exists public.profiles(
id uuid primary key references auth.users(id) on delete cascade,
name text not null unique,
phone text,
email text,
avatar_url text,
avatar text,
handle text,
theme text default 'blue',
bio text,
is_admin boolean default false,
is_premium boolean default false,
premium_until timestamptz,
banned boolean default false,
public_key text,
last_seen timestamptz,
is_online boolean default false,
created_at timestamptz default now()
);

create table if not exists public.messages(
id bigint generated always as identity primary key,
sender text not null,
sender_id uuid default auth.uid(),
sender_name text,
chat_name text,
group_id bigint,
text text,
image_url text,
status text default 'sent',
reply_to_id bigint,
reply_to_text text,
reply_to_sender text,
deleted_for_all boolean default false,
forwarded boolean default false,
edited boolean default false,
created_at timestamptz default now()
);

create index if not exists messages_chat_idx
on public.messages(chat_name, created_at desc);

create index if not exists messages_group_idx
on public.messages(group_id, created_at desc);

create table if not exists public.groups(
id bigint generated always as identity primary key,
name text not null,
created_by text not null,
created_at timestamptz default now()
);

create table if not exists public.group_members(
id bigint generated always as identity primary key,
group_id bigint not null,
member_name text not null,
unique(group_id, member_name)
);

create table if not exists public.posts(
id bigint generated always as identity primary key,
author text not null,
text text,
image_url text,
likes integer default 0,
created_at timestamptz default now()
);

create table if not exists public.stories(
id bigint generated always as identity primary key,
author text not null,
image_url text,
text text,
created_at timestamptz default now()
);

create table if not exists public.post_comments(
id bigint generated always as identity primary key,
post_id bigint not null,
author text not null,
text text,
created_at timestamptz default now()
);

create table if not exists public.blocks(
id bigint generated always as identity primary key,
blocker_name text not null,
blocked_name text not null,
unique(blocker_name, blocked_name)
);

create table if not exists public.muted_chats(
id bigint generated always as identity primary key,
user_name text not null,
chat_name text not null,
unique(user_name, chat_name)
);

create table if not exists public.cleared_chats(
id bigint generated always as identity primary key,
user_name text not null,
chat_name text not null,
cleared_at timestamptz default now(),
unique(user_name, chat_name)
);

create table if not exists public.premium_requests(
id bigint generated always as identity primary key,
user_name text not null,
phone text,
txn_id text,
amount numeric,
status text default 'pending',
created_at timestamptz default now()
);

create table if not exists public.calls(
id bigint generated always as identity primary key,
caller text not null,
callee text not null,
kind text default 'voice',
status text default 'ringing',
created_at timestamptz default now()
);

create or replace function public.ensure_profile(
p_name text,
p_handle text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me public.profiles;
  v_name text;
  v_handle text;
begin
  select * into v_me from public.profiles where id = auth.uid();
  if found then return v_me; end if;

  v_name := nullif(trim(coalesce(p_name, '')), '');
  if v_name is null then raise exception 'NAME_REQUIRED'; end if;
  if length(v_name) > 30 or v_name ~ '["'',\[\]]' then raise exception 'NAME_INVALID'; end if;
  if exists(select 1 from public.profiles where name = v_name) then raise exception 'NAME_TAKEN'; end if;

  v_handle := nullif(trim(coalesce(p_handle, '')), '');

  insert into public.profiles(id, name, handle)
  values (auth.uid(), v_name, v_handle)
  returning * into v_me;
  return v_me;
end
$$;

alter table public.profiles enable row level security;
alter table public.messages enable row level security;
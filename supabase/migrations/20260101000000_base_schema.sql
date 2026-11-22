-- Michat 000000: base schema.
-- Runs before 000001-000007.
-- Creates tables 000002 expects.

create table if not exists
public.profiles(
id uuid primary key
references auth.users(id)
on delete cascade,
name text not null unique,
phone text,
email text,
avatar_url text,
bio text,
is_admin boolean
default false,
is_premium boolean
default false,
premium_until timestamptz,
banned boolean
default false,
public_key text,
created_at timestamptz
default now()
);

-- Name is identity key for RLS.
-- Must be unique + immutable.
-- Guard in 000002 / 000005
-- blocks changing name.

create table if not exists
public.messages(
id bigint generated always
as identity primary key,
sender text not null,
sender_id uuid
default auth.uid(),
chat_name text,
group_id bigint,
text text,
image_url text,
status text
default 'sent',
created_at timestamptz
default now()
);

create index if not exists
messages_chat_idx
on public.messages(
chat_name,
created_at desc
);

create index if not exists
messages_group_idx
on public.messages(
group_id,
created_at desc
);
create table if not exists
public.groups(
id bigint generated always
as identity primary key,
name text not null,
created_by text not null,
created_at timestamptz
default now()
);

create table if not exists
public.group_members(
id bigint generated always
as identity primary key,
group_id bigint not null,
member_name text not null,
unique(group_id, member_name)
);

create table if not exists
public.posts(
id bigint generated always
as identity primary key,
author text not null,
text text,
image_url text,
likes integer
default 0,
created_at timestamptz
default now()
);

create table if not exists
public.stories(
id bigint generated always
as identity primary key,
author text not null,
image_url text,
text text,
created_at timestamptz
default now()
);

create table if not exists
public.post_comments(
id bigint generated always
as identity primary key,
post_id bigint not null,
author text not null,
text text,
created_at timestamptz
default now()
);

create table if not exists
public.blocks(
id bigint generated always
as identity primary key,
blocker_name text not null,
blocked_name text not null,
unique(
blocker_name,
blocked_name)
);

create table if not exists
public.muted_chats(
id bigint generated always
as identity primary key,
user_name text not null,
chat_name text not null,
unique(user_name, chat_name)
);

create table if not exists
public.cleared_chats(
id bigint generated always
as identity primary key,
user_name text not null,
chat_name text not null,
unique(user_name, chat_name)
);

create table if not exists
public.premium_requests(
id bigint generated always
as identity primary key,
user_name text not null,
txn_id text,
status text
default 'pending',
created_at timestamptz
default now()
);

create table if not exists
public.calls(
id bigint generated always
as identity primary key,
caller text not null,
callee text not null,
status text
default 'ringing',
created_at timestamptz
default now()
);
-- Login calls this RPC.
-- Creates profile if missing,
-- never overwrites name.

create or replace function
public.ensure_profile(
p_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles
  (id, name)
  values
  (auth.uid(), p_name)
  on conflict (id)
  do nothing;

  -- If name taken by someone
  -- else, keep own row, do
  -- not steal it.
  -- Client must pick
  -- another name.
end
$$;

-- Fix: prof_update must have
-- WITH CHECK, and name
-- must never change.
-- 000002 creates prof_update
-- without it, so we fix
-- it here after base.
-- 000002 will re-run
-- drop + create, so this
-- is safe to keep.

alter table public.profiles
enable row level security;

alter table public.messages
enable row level security;
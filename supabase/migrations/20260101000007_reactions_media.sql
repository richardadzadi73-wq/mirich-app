-- Michat 000007: reactions + media.
-- From old supabase-setup.sql.
-- Run after 000001-000006.

create table if not exists
public.message_reactions(
id bigint generated always
as identity primary key,
message_id bigint not null,
user_name text not null,
emoji text not null,
created_at timestamptz
default now(),
unique(
message_id,
user_name,
emoji)
);

alter table
public.message_reactions
enable row level security;
drop policy if exists
"read reactions"
on public.message_reactions;

create policy "read reactions"
on public.message_reactions
for select
using (
auth.role() = 'authenticated'
);

drop policy if exists
"add reactions"
on public.message_reactions;

create policy "add reactions"
on public.message_reactions
for insert
with check (
auth.role() = 'authenticated'
);

drop policy if exists
"remove reactions"
on public.message_reactions;

create policy "remove reactions"
on public.message_reactions
for delete
using (
auth.role() = 'authenticated'
);
-- Public bucket for photos /
-- voice notes. App falls back
-- to inline data if missing.

insert into storage.buckets
(id, name, public)
values (
'media',
'media',
true
)
on conflict do nothing;

drop policy if exists
"upload media"
on storage.objects;

create policy "upload media"
on storage.objects
for insert
with check (
bucket_id = 'media'
and auth.role() = 'authenticated'
);

drop policy if exists
"read media"
on storage.objects;

create policy "read media"
on storage.objects
for select
using (
bucket_id = 'media'
);
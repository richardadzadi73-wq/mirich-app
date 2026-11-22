-- Run once in Supabase SQL editor.
-- Adds reactions + media storage.
create table if not exists message_reactions(
  id bigint generated always as identity
    primary key,
  message_id bigint not null,
  user_name text not null,
  emoji text not null,
  created_at timestamptz default now(),
  unique(message_id,user_name,emoji)
);
alter table message_reactions
  enable row level security;

create policy "read reactions"
  on message_reactions
  for select
  using (auth.role()='authenticated');

create policy "add reactions"
  on message_reactions
  for insert
  with check (auth.role()='authenticated');

create policy "remove reactions"
  on message_reactions
  for delete
  using (auth.role()='authenticated');
-- Public bucket for photos / voice notes
-- (app falls back to inline data if missing)
insert into storage.buckets(id,name,public)
values('media','media',true)
on conflict do nothing;

create policy "upload media"
  on storage.objects
  for insert
  with check (
    bucket_id='media'
    and auth.role()='authenticated'
  );

create policy "read media"
  on storage.objects
  for select
  using (bucket_id='media');
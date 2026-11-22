-- MICHAT v3 MIGRATION (run AFTER supabase-security.sql, on staging first)
alter table profiles add column if not exists public_key text;
-- private contact data: other users read the view, never the table
do $$ declare cols text; begin
  select string_agg(quote_ident(column_name),',') into cols from information_schema.columns where table_schema='public' and table_name='profiles' and column_name not in ('phone','email','is_admin');
  execute 'create or replace view public.public_profiles as select '||cols||' from public.profiles'; end $$;
grant select on public.public_profiles to authenticated;
drop policy if exists prof_select on profiles;
create policy prof_select_own on profiles for select to authenticated using (id=auth.uid());

create table if not exists key_backups(user_id uuid primary key, salt text, iv text, blob text, updated_at timestamptz default now());
alter table key_backups enable row level security; select _drop_policies('key_backups');
create policy kb_own on key_backups for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create table if not exists push_subscriptions(endpoint text primary key, user_id uuid, user_name text, sub jsonb, created_at timestamptz default now());
alter table push_subscriptions enable row level security; select _drop_policies('push_subscriptions');
create policy ps_own on push_subscriptions for all to authenticated using (user_id=auth.uid()) with check (user_id=auth.uid());
create table if not exists poll_votes(message_id bigint, user_name text, opt int, primary key(message_id,user_name));
alter table poll_votes enable row level security; select _drop_policies('poll_votes');
create policy pv_sel on poll_votes for select to authenticated using (true);
create policy pv_ins on poll_votes for insert to authenticated with check (user_name=my_name());
create policy pv_upd on poll_votes for update to authenticated using (user_name=my_name());
create table if not exists ai_usage(user_id uuid, day date, n int default 0, primary key(user_id,day));
alter table ai_usage enable row level security;  -- no policies: only the Edge Function (service role) touches it

-- private call channels (set privateCalls:true in config.js after running this)
create policy call_inbox_read on realtime.messages for select to authenticated using (realtime.topic() = 'call-in-'||public.my_name());
create policy call_send on realtime.messages for insert to authenticated with check (realtime.topic() like 'call-in-%');
-- Dashboard → Database → Webhooks: create TWO webhooks calling Edge Function send-push on INSERT of public.messages and public.calls,
-- with HTTP header  x-webhook-secret: <your WEBHOOK_SECRET>

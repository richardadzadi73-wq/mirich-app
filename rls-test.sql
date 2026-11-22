-- RLS regression tests. Run on STAGING with two existing users:
--   psql "$STAGING_DB_URL" -v a="'<uuid of user A>'" -v b="'<uuid of user B>'" -v an="'<A name>'" -f tests/rls-test.sql
-- Each block must print NOTICE 'PASS ...'; any EXCEPTION means a security rule is broken. Everything rolls back.
begin;
create or replace function pg_temp.as_user(u text) returns void language plpgsql as $$ begin
  perform set_config('request.jwt.claims', json_build_object('sub',u,'role','authenticated')::text, true); set local role authenticated; end $$;
-- 1. B cannot read A's key backup or push subscriptions
select pg_temp.as_user(:b);
do $$ begin if exists(select 1 from key_backups where user_id=:a::uuid) then raise exception 'FAIL key_backups readable'; end if;
  if exists(select 1 from push_subscriptions where user_id=:a::uuid) then raise exception 'FAIL push_subscriptions readable'; end if; raise notice 'PASS private tables'; end $$;
-- 2. B cannot grant themselves Premium / admin / unban
do $$ begin begin update profiles set is_premium=true where id=:b::uuid; raise exception 'FAIL premium self-grant'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin update profiles set is_admin=true where id=:b::uuid; raise exception 'FAIL admin self-grant'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  raise notice 'PASS privilege columns'; end $$;
-- 3. B cannot send as A, nor edit A's messages
do $$ begin begin insert into messages(sender,sender_name,chat_name,text,sender_id) values(:an,:an,'General','spoof',:a::uuid); raise exception 'FAIL spoofed insert'; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  begin update messages set text='tampered' where sender_id=:a::uuid; if found then raise exception 'FAIL tamper'; end if; exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  raise notice 'PASS spoof/tamper'; end $$;
-- 4. other users' phone/email are not exposed
do $$ begin if (select count(*) from profiles where id<>:b::uuid)>0 then raise exception 'FAIL profiles of others readable'; end if; raise notice 'PASS profile privacy'; end $$;
rollback;

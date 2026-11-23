-- RLS acceptance tests for news, reads, push and storage. Run as postgres after schema.
\set ON_ERROR_STOP 1
insert into auth.users(id) values
 ('00000000-0000-0000-0000-00000000000a'), -- admin
 ('00000000-0000-0000-0000-00000000000b'), -- active member
 ('00000000-0000-0000-0000-00000000000c'); -- expired member
insert into public.active_devices(user_id,session_id) values
 ('00000000-0000-0000-0000-00000000000a','10000000-0000-0000-0000-00000000000a'),
 ('00000000-0000-0000-0000-00000000000b','10000000-0000-0000-0000-00000000000b'),
 ('00000000-0000-0000-0000-00000000000c','10000000-0000-0000-0000-00000000000c');
insert into public.admin_roles(user_id,role,telegram_user_id) values ('00000000-0000-0000-0000-00000000000a','admin',1);
insert into public.subscriptions(user_id,source,plan_key,status,current_period_end)
 values ('00000000-0000-0000-0000-00000000000b','manual','monthly','active',now()+interval '10 days'),
        ('00000000-0000-0000-0000-00000000000c','manual','monthly','active',now()-interval '1 day');
insert into public.gym_news(id,title,body,category,published,is_members_only,is_pinned) values
 ('20000000-0000-0000-0000-000000000001','Ommaviy','Hamma uchun','general',true,false,false),
 ('20000000-0000-0000-0000-000000000002','Azolar','Faqat azolar','promo',true,true,true),
 ('20000000-0000-0000-0000-000000000003','Qoralama','Hali chiqmagan','general',false,false,false);

create or replace function pg_temp.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  perform set_config('request.jwt.claims', json_build_object('sub',uid,'session_id','1'||substr(uid,2))::text, false);
end $$;

-- Guest
set role anon;
do $$ declare n int; begin select count(*) into n from public.gym_news;
  if n<>1 then raise exception 'guest should see 1 public news, saw %', n; end if; end $$;
do $$ begin begin perform created_by from public.gym_news; raise exception 'anon read created_by';
  exception when insufficient_privilege then null; end; end $$;
reset role;

-- Active member
select pg_temp.as_user('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$ declare n int; begin select count(*) into n from public.gym_news;
  if n<>2 then raise exception 'active member should see 2, saw %', n; end if; end $$;
insert into public.news_reads(news_id) values ('20000000-0000-0000-0000-000000000002');
do $$ begin begin insert into public.news_reads(news_id) values ('20000000-0000-0000-0000-000000000003'); raise exception 'read on draft allowed';
  exception when insufficient_privilege then null; end; end $$;
do $$ begin begin insert into public.gym_news(title,body) values ('Hack','Hack body'); raise exception 'member inserted news';
  exception when insufficient_privilege then null; end; end $$;
do $$ declare n int; begin update public.gym_news set title='x' where true; get diagnostics n=row_count;
  if n<>0 then raise exception 'member updated news'; end if; end $$;
do $$ declare n int; begin delete from public.gym_news where true; get diagnostics n=row_count;
  if n<>0 then raise exception 'member deleted news'; end if; end $$;
do $$ begin begin insert into storage.objects(bucket_id,name) values ('news-images','news/30000000-0000-0000-0000-000000000001.webp'); raise exception 'member uploaded image';
  exception when insufficient_privilege then null; end; end $$;
do $$ begin begin insert into public.push_subscriptions(user_id,endpoint,p256dh,auth) values ('00000000-0000-0000-0000-00000000000b','https://push.example/x','k','a'); raise exception 'push without consent allowed';
  exception when insufficient_privilege then null; end; end $$;
insert into public.push_subscriptions(user_id,endpoint,p256dh,auth,consented_at) values ('00000000-0000-0000-0000-00000000000b','https://push.example/b','k','a',now());
do $$ begin begin insert into public.push_subscriptions(user_id,endpoint,p256dh,auth,consented_at) values ('00000000-0000-0000-0000-00000000000c','https://push.example/spoof','k','a',now()); raise exception 'push for other user allowed';
  exception when insufficient_privilege then null; end; end $$;
do $$ begin begin perform * from public.news_push_targets(false); raise exception 'targets callable by member';
  exception when insufficient_privilege then null; end; end $$;
reset role;

-- Expired member
select pg_temp.as_user('00000000-0000-0000-0000-00000000000c');
set role authenticated;
do $$ declare n int; begin select count(*) into n from public.gym_news;
  if n<>1 then raise exception 'expired member should see 1, saw %', n; end if; end $$;
do $$ declare n int; begin select count(*) into n from public.news_reads;
  if n<>0 then raise exception 'reads leak across users'; end if; end $$;
insert into public.push_subscriptions(user_id,endpoint,p256dh,auth,consented_at) values ('00000000-0000-0000-0000-00000000000c','https://push.example/c','k','a',now());
reset role;

-- Admin
select pg_temp.as_user('00000000-0000-0000-0000-00000000000a');
set role authenticated;
do $$ declare n int; begin select count(*) into n from public.gym_news;
  if n<>3 then raise exception 'admin should see 3, saw %', n; end if; end $$;
insert into public.gym_news(id,title,body,category) values ('20000000-0000-0000-0000-000000000004','Admin yangiligi','Matn matn','equipment');
update public.gym_news set published=true where id='20000000-0000-0000-0000-000000000004';
do $$ declare r record; begin select created_by,publish_at into r from public.gym_news where id='20000000-0000-0000-0000-000000000004';
  if r.created_by is distinct from '00000000-0000-0000-0000-00000000000a' or r.publish_at is null then raise exception 'created_by/publish_at not set'; end if; end $$;
insert into storage.objects(bucket_id,name) values ('news-images','news/30000000-0000-0000-0000-000000000001.webp');
do $$ begin begin insert into storage.objects(bucket_id,name) values ('news-images','news/evil.svg'); raise exception 'bad path accepted';
  exception when insufficient_privilege then null; end; end $$;
do $$ begin begin update public.gym_news set image_path='news/30000000-0000-0000-0000-000000000001.webp', image_bucket='news-images' where id='20000000-0000-0000-0000-000000000002'; raise exception 'members news with public image accepted';
  exception when check_violation then null; end; end $$;
delete from public.gym_news where id='20000000-0000-0000-0000-000000000003';
reset role;

do $$ declare n int; begin select count(*) into n from public.admin_audit_log where target_table='gym_news';
  if n<3 then raise exception 'audit log missing entries (%).', n; end if; end $$;
do $$ declare n int; begin select count(*) into n from public.news_push_targets(true);
  if n<>1 then raise exception 'members push targets should be 1, got %', n; end if; end $$;
do $$ declare n int; begin select count(*) into n from public.news_push_targets(false);
  if n<>2 then raise exception 'public push targets should be 2, got %', n; end if; end $$;
select 'ALL RLS TESTS PASSED' as result;

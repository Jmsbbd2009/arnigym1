-- ArniyGym Supabase schema. Apply once in the Supabase SQL editor.
create extension if not exists pgcrypto;

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete cascade,
  phone_e164 text unique not null,
  telegram_user_id bigint unique,
  display_name text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.admin_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check(role in ('admin')),
  telegram_user_id bigint unique not null,
  created_at timestamptz not null default now()
);
create table if not exists public.admin_login_challenges (
  id uuid primary key default gen_random_uuid(), token_hash text unique not null,
  user_id uuid not null references auth.users(id) on delete cascade, telegram_user_id bigint not null,
  code_hash text, status text not null default 'waiting_bot' check(status in ('waiting_bot','issued','consumed','expired')),
  attempts smallint not null default 0, device_label text not null default '', notified_at timestamptz,
  expires_at timestamptz not null, created_at timestamptz not null default now()
);
create table if not exists public.otp_challenges (
  id uuid primary key default gen_random_uuid(),
  token_hash text unique not null,
  phone_e164 text not null,
  telegram_user_id bigint,
  code_hash text,
  status text not null default 'waiting_contact' check(status in ('waiting_contact','issued','consumed','expired')),
  attempts smallint not null default 0,
  device_label text not null default '',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists otp_challenges_phone_recent on public.otp_challenges(phone_e164,created_at desc);
create table if not exists public.active_devices (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session_id uuid not null,
  device_label text not null default '',
  updated_at timestamptz not null default now()
);
create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  muscle_group text not null check(muscle_group in ('shoulders','biceps','triceps','back','chest','legs')),
  title text not null,
  sets smallint not null default 3 check(sets between 1 and 20),
  reps text not null default '8–12',
  technique text not null default '',
  has_video boolean not null default false,
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- Keep provider video IDs in a separate table so the public exercise catalog can never expose them.
create table if not exists public.exercise_media (
  exercise_id uuid primary key references public.exercises(id) on delete cascade,
  stream_video_id text unique not null,
  created_at timestamptz not null default now()
);
alter table public.exercises add column if not exists has_video boolean not null default false;
do $$ begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='exercises' and column_name='stream_video_id') then
    execute 'insert into public.exercise_media(exercise_id,stream_video_id) select id,stream_video_id from public.exercises where stream_video_id is not null on conflict(exercise_id) do nothing';
    execute 'update public.exercises set has_video=true where stream_video_id is not null';
    alter table public.exercises drop column stream_video_id;
  end if;
end $$;
create table if not exists public.diet_plans (
  id uuid primary key default gen_random_uuid(), goal text not null check(goal in ('gain','cut')),
  title text not null, content jsonb not null default '{}'::jsonb,
  published boolean not null default false, updated_at timestamptz not null default now()
);
-- Diet lesson videos stay in a private mapping table; public menus never expose Stream IDs.
create table if not exists public.diet_plan_media (
  id uuid primary key default gen_random_uuid(),
  diet_plan_id uuid not null references public.diet_plans(id) on delete cascade,
  stream_video_id text unique not null,
  title text not null,
  description text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists diet_plan_media_plan_created on public.diet_plan_media(diet_plan_id,created_at desc);
create table if not exists public.plan_prices (
  id uuid primary key default gen_random_uuid(), plan_key text unique not null check(plan_key in ('monthly','yearly')),
  title text not null, amount_usd numeric(10,2) not null check(amount_usd>=0), amount_uzs bigint not null check(amount_uzs>=0),
  lemon_variant_id text not null, active boolean not null default true, updated_at timestamptz not null default now()
);
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check(source in ('lemon_squeezy','p2p','manual')), provider_subscription_id text unique,
  plan_key text not null check(plan_key in ('monthly','yearly')), status text not null check(status in ('active','cancelled','expired','past_due')),
  current_period_end timestamptz, updated_at timestamptz not null default now(), created_at timestamptz not null default now()
);
alter table public.subscriptions drop constraint if exists subscriptions_source_check;
alter table public.subscriptions add constraint subscriptions_source_check check(source in ('lemon_squeezy','p2p','manual'));
alter table public.subscriptions add column if not exists provider_updated_at timestamptz;
alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check check(status in ('active','cancelled','expired','past_due','paused','on_trial','refunded'));
update public.subscriptions set status='past_due',updated_at=now() where status='active' and current_period_end is null;
create index if not exists subscriptions_user_active on public.subscriptions(user_id,status,current_period_end desc);
create table if not exists public.p2p_payments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  amount_uzs bigint not null check(amount_uzs>0), receipt_path text not null,
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  plan_key text not null check(plan_key in ('monthly','yearly')), reviewer_id uuid references auth.users(id),
  admin_note text, notified_at timestamptz, created_at timestamptz not null default now(), reviewed_at timestamptz
);
alter table public.p2p_payments add column if not exists receipt_sha256 text;
create unique index if not exists p2p_receipt_hash_once on public.p2p_payments(receipt_sha256) where receipt_sha256 is not null;
create table if not exists public.webhook_events (
  event_id text primary key, event_name text not null, processed_at timestamptz not null default now()
);
create table if not exists public.weight_logs (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  weight_kg numeric(5,2) not null check(weight_kg between 20 and 350), logged_on date not null default current_date,
  created_at timestamptz not null default now(), unique(user_id,logged_on)
);
alter table public.weight_logs alter column logged_on set default ((now() at time zone 'Asia/Tashkent')::date);
create table if not exists public.water_logs (
  user_id uuid not null references auth.users(id) on delete cascade, logged_on date not null default current_date,
  glasses smallint not null default 0 check(glasses between 0 and 30), updated_at timestamptz not null default now(),
  primary key(user_id,logged_on)
);
alter table public.water_logs alter column logged_on set default ((now() at time zone 'Asia/Tashkent')::date);
create table if not exists public.steps_logs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  logged_on date not null default ((now() at time zone 'Asia/Tashkent')::date),
  steps integer not null default 0 check(steps between 0 and 100000),
  updated_at timestamptz not null default now()
);
create table if not exists public.about_content (
  id integer primary key default 1 check(id=1), content jsonb not null default '{}'::jsonb, updated_at timestamptz not null default now()
);
create table if not exists public.payment_info (
  id integer primary key default 1 check(id=1), card_number text not null default '', cardholder text not null default '',
  instructions text not null default '', updated_at timestamptz not null default now()
);
create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key, bucket_key text not null, created_at timestamptz not null default now()
);
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_table text not null,
  target_id text,
  changed_fields text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_recent on public.admin_audit_log(created_at desc);
create index if not exists rate_limit_bucket_time on public.rate_limit_events(bucket_key,created_at desc);

-- Calorie dashboard. AI logs can only be written by the server function.
create table if not exists public.calorie_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  base_goal smallint check(base_goal between 800 and 8000),
  updated_at timestamptz not null default now()
);
alter table public.calorie_settings alter column base_goal drop not null;
alter table public.calorie_settings alter column base_goal drop default;
create table if not exists public.calorie_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  meal_name text not null check(char_length(meal_name)<=100),
  calories integer not null check(calories between 0 and 10000),
  protein_g numeric(6,1) not null default 0 check(protein_g>=0),
  fat_g numeric(6,1) not null default 0 check(fat_g>=0),
  carbs_g numeric(6,1) not null default 0 check(carbs_g>=0),
  source text not null check(source in ('manual','exercise','ai_scan')),
  ai_response_hash text,
  logged_at timestamptz not null default now()
);
create index if not exists calorie_logs_user_day on public.calorie_logs(user_id,logged_at desc);

-- Member workout history and favorites.
create table if not exists public.exercise_favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(user_id,exercise_id)
);
create table if not exists public.workout_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  set_count smallint not null check(set_count between 1 and 30),
  reps_count smallint not null check(reps_count between 1 and 200),
  weight_kg numeric(7,2) not null check(weight_kg between 0 and 1000),
  performed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists workout_logs_user_recent on public.workout_logs(user_id,performed_at desc);
alter table public.exercise_favorites enable row level security;
alter table public.workout_logs enable row level security;
grant select,insert,delete on public.exercise_favorites to authenticated;
grant select,insert,delete on public.workout_logs to authenticated;
create table if not exists public.ai_usage_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  used_on date not null default current_date,
  scan_count smallint not null default 0 check(scan_count between 0 and 5),
  primary key(user_id,used_on)
);
alter table public.ai_usage_logs alter column used_on set default ((now() at time zone 'Asia/Tashkent')::date);
create table if not exists public.ai_scan_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text unique not null,
  disclosure_accepted boolean not null default false,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ai_scan_sessions_expiry on public.ai_scan_sessions(expires_at);
create table if not exists public.privacy_consents (
  id bigint generated always as identity primary key,
  phone_hash text not null,
  terms_version text not null,
  consented_at timestamptz not null default now()
);
create index if not exists privacy_consents_phone_recent on public.privacy_consents(phone_hash,consented_at desc);
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text unique not null, p256dh text not null, auth text not null,
  user_agent text not null default '', updated_at timestamptz not null default now()
);
create table if not exists public.workout_categories (
  id uuid primary key default gen_random_uuid(), slug text unique not null check(slug ~ '^[a-z0-9-]{2,60}$'),
  name text not null check(char_length(name) between 2 and 80), description text not null default '',
  display_order smallint not null default 100, published boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.gym_news (
  id uuid primary key default gen_random_uuid(),
  title text not null check(char_length(title) between 3 and 140),
  body text not null check(char_length(body) between 3 and 3000),
  category text not null default 'general' check(category in ('general','schedule','promo','equipment')),
  cover_image_url text check(cover_image_url is null or cover_image_url ~ '^https://'),
  published boolean not null default false,
  is_pinned boolean not null default false,
  is_members_only boolean not null default false,
  publish_at timestamptz,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check(expires_at is null or publish_at is null or expires_at > publish_at)
);
-- Feed index is defined in the 202611230005 news section below.
alter table public.exercises add column if not exists category_id uuid references public.workout_categories(id) on delete set null;
alter table public.exercises drop constraint if exists exercises_muscle_group_check;

create or replace function public.is_arniy_admin()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(
  select 1 from public.admin_roles r join public.active_devices d on d.user_id=r.user_id
  where r.user_id=(select auth.uid()) and r.role='admin' and d.session_id::text=(select auth.jwt()->>'session_id')
); $$;
create or replace function public.has_active_subscription()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.subscriptions s join public.active_devices d on d.user_id=s.user_id where s.user_id=(select auth.uid()) and d.session_id::text=(select auth.jwt()->>'session_id') and s.status in ('active','on_trial','cancelled') and s.current_period_end>now()); $$;
create or replace function public.is_active_device()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.active_devices d where d.user_id=(select auth.uid()) and d.session_id::text=(select auth.jwt()->>'session_id')); $$;
create or replace function public.admin_dashboard_summary()
returns jsonb language sql stable security definer set search_path=''
as $$
  select case when (select public.is_arniy_admin()) then jsonb_build_object(
    'subscription_total',(select count(*) from public.subscriptions),
    'active_memberships',(select count(*) from public.subscriptions s where s.status in ('active','on_trial','cancelled') and s.current_period_end>now()),
    'cancelled_subscriptions',(select count(*) from public.subscriptions where status='cancelled'),
    'cancelled_30d',(select count(*) from public.subscriptions where status='cancelled' and updated_at>=now()-interval '30 days'),
    'pending_payments',(select count(*) from public.p2p_payments where status='pending'),
    'approved_p2p_uzs',(select coalesce(sum(amount_uzs),0) from public.p2p_payments where status='approved')
  ) else null end;
$$;
create or replace function public.check_rate_limit(p_key text,p_limit int,p_window_seconds int)
returns boolean language plpgsql security definer set search_path=''
as $$ declare n int; begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_key,0));
  delete from public.rate_limit_events where created_at < now()-interval '2 days';
  select count(*) into n from public.rate_limit_events where bucket_key=p_key and created_at>now()-make_interval(secs=>p_window_seconds);
  if n>=p_limit then return false; end if;
  insert into public.rate_limit_events(bucket_key) values(p_key); return true;
end; $$;
drop function if exists public.consume_ai_scan(uuid,int);
create or replace function public.consume_ai_scan(p_user_id uuid,p_limit int default 5,p_today date default ((now() at time zone 'Asia/Tashkent')::date))
returns table(scan_count smallint) language plpgsql security definer set search_path=''
as $$ begin return query insert into public.ai_usage_logs(user_id,used_on,scan_count) values(p_user_id,p_today,1)
 on conflict(user_id,used_on) do update set scan_count=public.ai_usage_logs.scan_count+1 where public.ai_usage_logs.scan_count<p_limit
 returning public.ai_usage_logs.scan_count; end; $$;
create or replace function public.release_ai_scan(p_user_id uuid,p_today date)
returns void language plpgsql security definer set search_path=''
as $$ begin
  update public.ai_usage_logs set scan_count=scan_count-1 where user_id=p_user_id and used_on=p_today and scan_count>0;
  delete from public.ai_usage_logs where user_id=p_user_id and used_on=p_today and scan_count=0;
end; $$;
create or replace function public.consume_telegram_otp(p_token_hash text,p_code_hash text)
returns table(phone_e164 text,telegram_user_id bigint)
language plpgsql security definer set search_path=''
as $$ begin
  return query update public.otp_challenges c set status='consumed',attempts=c.attempts+1
    where c.token_hash=p_token_hash and c.code_hash=p_code_hash and c.status='issued' and c.expires_at>now() and c.attempts<5
    returning c.phone_e164,c.telegram_user_id;
  if not found then
    update public.otp_challenges c set attempts=c.attempts+1 where c.token_hash=p_token_hash and c.status='issued' and c.expires_at>now() and c.attempts<5;
  end if;
end; $$;
create or replace function public.consume_admin_otp(p_token_hash text,p_code_hash text)
returns table(user_id uuid)
language plpgsql security definer set search_path=''
as $$ begin
  return query update public.admin_login_challenges c set status='consumed',attempts=c.attempts+1
    where c.token_hash=p_token_hash and c.code_hash=p_code_hash and c.status='issued' and c.expires_at>now() and c.attempts<5
    returning c.user_id;
  if not found then update public.admin_login_challenges c set attempts=c.attempts+1 where c.token_hash=p_token_hash and c.status='issued' and c.expires_at>now() and c.attempts<5; end if;
end; $$;
create or replace function public.apply_lemonsqueezy_event(
  p_event_id text, p_event_name text, p_provider_subscription_id text, p_user_id uuid,
  p_plan_key text, p_status text, p_period_end timestamptz, p_event_updated_at timestamptz
) returns text language plpgsql security definer set search_path=''
as $$
declare effective_end timestamptz; result_id uuid; prior public.subscriptions%rowtype;
begin
  if coalesce(length(p_event_id),0)=0 or coalesce(length(p_event_name),0)=0 then raise exception 'invalid event'; end if;
  insert into public.webhook_events(event_id,event_name) values(left(p_event_id,200),left(p_event_name,100)) on conflict(event_id) do nothing;
  if not found then return 'duplicate'; end if;
  if p_provider_subscription_id is null or p_status is null or p_event_updated_at is null then return 'ignored'; end if;
  if p_status not in ('active','on_trial','paused','cancelled','expired','past_due','refunded') then return 'ignored'; end if;
  if p_user_id is null or p_plan_key is null or p_plan_key not in ('monthly','yearly') then return 'ignored'; end if;
  effective_end:=coalesce(p_period_end,now()+case when p_plan_key='yearly' then interval '365 days' else interval '30 days' end);
  select * into prior from public.subscriptions where provider_subscription_id=p_provider_subscription_id for update;
  if found then
    if prior.user_id<>p_user_id then raise exception 'subscription owner mismatch'; end if;
    if coalesce(prior.provider_updated_at,prior.updated_at,prior.created_at)>=p_event_updated_at then return 'stale'; end if;
    if p_event_name in ('subscription_payment_success','subscription_payment_recovered') then
      effective_end:=greatest(coalesce(prior.current_period_end,now()),now())+case when p_plan_key='yearly' then interval '365 days' else interval '30 days' end;
    else
      effective_end:=coalesce(p_period_end,prior.current_period_end,effective_end);
    end if;
    update public.subscriptions set plan_key=p_plan_key,status=p_status,current_period_end=effective_end,
      provider_updated_at=p_event_updated_at,updated_at=now() where id=prior.id;
    return 'updated';
  end if;
  insert into public.subscriptions(user_id,source,provider_subscription_id,plan_key,status,current_period_end,provider_updated_at,updated_at)
  values(p_user_id,'lemon_squeezy',left(p_provider_subscription_id,100),p_plan_key,p_status,effective_end,p_event_updated_at,now())
  on conflict(provider_subscription_id) do nothing returning id into result_id;
  if result_id is null then return 'stale'; end if;
  return 'inserted';
end; $$;
create or replace function public.review_p2p_payment(p_payment_id uuid,p_status text,p_reviewer_id uuid,p_note text default '')
returns table(user_id uuid,telegram_user_id bigint)
language plpgsql security definer set search_path=''
as $$ declare p public.p2p_payments%rowtype; tg bigint; finish timestamptz; begin
  if p_status not in ('approved','rejected') then raise exception 'invalid status'; end if;
  if p_reviewer_id is null or not exists(select 1 from public.admin_roles r where r.user_id=p_reviewer_id and r.role='admin') then raise exception 'admin reviewer required'; end if;
  select * into p from public.p2p_payments where id=p_payment_id and status='pending' for update;
  if not found then raise exception 'payment already reviewed'; end if;
  select m.telegram_user_id into tg from public.members m where m.auth_user_id=p.user_id;
  perform set_config('app.admin_user_id',p_reviewer_id::text,true);
  update public.p2p_payments set status=p_status,reviewer_id=p_reviewer_id,admin_note=left(p_note,500),reviewed_at=now() where id=p_payment_id;
  if p_status='approved' then
    if not exists(select 1 from public.plan_prices q where q.plan_key=p.plan_key and q.amount_uzs=p.amount_uzs and q.active) then raise exception 'payment amount mismatch'; end if;
    select greatest(coalesce(max(current_period_end),now()),now()) into finish from public.subscriptions where user_id=p.user_id and status in ('active','on_trial','cancelled') and current_period_end>now();
    finish=finish+case when p.plan_key='yearly' then interval '365 days' else interval '30 days' end;
    insert into public.subscriptions(user_id,source,provider_subscription_id,plan_key,status,current_period_end)
      values(p.user_id,'p2p','p2p:'||p.id::text,p.plan_key,'active',finish)
      on conflict(provider_subscription_id) do nothing;
  end if;
  return query select p.user_id,tg;
end; $$;
create or replace function public.audit_admin_mutation()
returns trigger language plpgsql security definer set search_path=''
as $$
declare actor uuid; before_row jsonb; after_row jsonb; changed text[]; target text;
begin
  actor:=coalesce((select auth.uid()),nullif(current_setting('app.admin_user_id',true),'')::uuid);
  if actor is null or not exists(select 1 from public.admin_roles r where r.user_id=actor and r.role='admin') then return new; end if;
  before_row:=case when tg_op='INSERT' then '{}'::jsonb else to_jsonb(old) end;
  after_row:=case when tg_op='DELETE' then '{}'::jsonb else to_jsonb(new) end;
  select coalesce(array_agg(k.key order by k.key),'{}') into changed from jsonb_each(after_row) k
    where before_row->k.key is distinct from after_row->k.key;
  target:=coalesce(after_row->>'id',before_row->>'id',after_row->>'user_id',before_row->>'user_id',after_row->>'plan_key',before_row->>'plan_key');
  insert into public.admin_audit_log(admin_user_id,action,target_table,target_id,changed_fields)
  values(actor,tg_op,tg_table_name,target,changed);
  if tg_op='DELETE' then return old; end if;
  return new;
end; $$;
drop trigger if exists audit_admin_plan_prices on public.plan_prices;
create trigger audit_admin_plan_prices after insert or update or delete on public.plan_prices for each row execute function public.audit_admin_mutation();
drop trigger if exists audit_admin_payment_info on public.payment_info;
create trigger audit_admin_payment_info after insert or update or delete on public.payment_info for each row execute function public.audit_admin_mutation();
drop trigger if exists audit_admin_subscriptions on public.subscriptions;
create trigger audit_admin_subscriptions after insert or update or delete on public.subscriptions for each row execute function public.audit_admin_mutation();
drop trigger if exists audit_admin_p2p_payments on public.p2p_payments;
create trigger audit_admin_p2p_payments after update or delete on public.p2p_payments for each row execute function public.audit_admin_mutation();
drop trigger if exists audit_admin_diets on public.diet_plans;
create trigger audit_admin_diets after insert or update or delete on public.diet_plans for each row execute function public.audit_admin_mutation();
drop trigger if exists audit_admin_exercises on public.exercises;
create trigger audit_admin_exercises after insert or update or delete on public.exercises for each row execute function public.audit_admin_mutation();
drop trigger if exists audit_admin_news on public.gym_news;
create trigger audit_admin_news after insert or update or delete on public.gym_news for each row execute function public.audit_admin_mutation();
drop trigger if exists audit_admin_about on public.about_content;
create trigger audit_admin_about after insert or update or delete on public.about_content for each row execute function public.audit_admin_mutation();
revoke all on function public.apply_lemonsqueezy_event(text,text,text,uuid,text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_lemonsqueezy_event(text,text,text,uuid,text,text,timestamptz,timestamptz) to service_role;
revoke all on function public.consume_telegram_otp(text,text) from public,anon,authenticated;
revoke all on function public.consume_admin_otp(text,text) from public,anon,authenticated;
revoke all on function public.review_p2p_payment(uuid,text,uuid,text) from public,anon,authenticated;
revoke all on function public.check_rate_limit(text,int,int) from public,anon,authenticated;
grant execute on function public.consume_telegram_otp(text,text) to service_role;
grant execute on function public.consume_admin_otp(text,text) to service_role;
grant execute on function public.review_p2p_payment(uuid,text,uuid,text) to service_role;
grant execute on function public.check_rate_limit(text,int,int) to service_role;
revoke all on function public.admin_dashboard_summary() from public,anon;
grant execute on function public.admin_dashboard_summary() to authenticated;
grant execute on function public.consume_ai_scan(uuid,int,date) to service_role;
revoke all on function public.release_ai_scan(uuid,date) from public,anon,authenticated;
grant execute on function public.release_ai_scan(uuid,date) to service_role;
revoke all on public.ai_scan_sessions,public.privacy_consents from public,anon,authenticated;
grant all on public.ai_scan_sessions,public.privacy_consents to service_role;

alter table public.members enable row level security;
alter table public.admin_roles enable row level security;
alter table public.admin_login_challenges enable row level security;
alter table public.otp_challenges enable row level security;
alter table public.active_devices enable row level security;
alter table public.exercises enable row level security;
alter table public.diet_plans enable row level security;
alter table public.diet_plan_media enable row level security;
alter table public.plan_prices enable row level security;
alter table public.subscriptions enable row level security;
alter table public.p2p_payments enable row level security;
alter table public.webhook_events enable row level security;
alter table public.weight_logs enable row level security;
alter table public.water_logs enable row level security;
alter table public.steps_logs enable row level security;
alter table public.about_content enable row level security;
alter table public.payment_info enable row level security;
alter table public.rate_limit_events enable row level security;
alter table public.calorie_settings enable row level security;
alter table public.calorie_logs enable row level security;
alter table public.ai_usage_logs enable row level security;
alter table public.ai_scan_sessions enable row level security;
alter table public.privacy_consents enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.workout_categories enable row level security;
alter table public.exercise_media enable row level security;
alter table public.gym_news enable row level security;
alter table public.admin_audit_log enable row level security;

drop policy if exists "member reads self" on public.members;
create policy "member reads self" on public.members for select to authenticated using(auth_user_id=(select auth.uid()) and (select public.is_active_device()));
drop policy if exists "admin reads members" on public.members;
create policy "admin reads members" on public.members for select to authenticated using((select public.is_arniy_admin()));
drop policy if exists "user sees own admin role" on public.admin_roles;
create policy "user sees own admin role" on public.admin_roles for select to authenticated using(user_id=(select auth.uid()) and (select public.is_active_device()));
drop policy if exists "admin sees roles" on public.admin_roles;
create policy "admin sees roles" on public.admin_roles for select to authenticated using((select public.is_arniy_admin()));
drop policy if exists "published exercises are public" on public.exercises;
create policy "published exercises are public" on public.exercises for select to anon,authenticated using(published or (select public.is_arniy_admin()));
revoke select on public.exercises from anon,authenticated;
grant select(id,muscle_group,title,sets,reps,technique,has_video,published,created_at,updated_at,category_id) on public.exercises to anon,authenticated;
grant insert,update,delete on public.exercises to authenticated;
grant select,insert,update,delete on public.exercise_media to authenticated;
drop policy if exists "admin manages exercises" on public.exercises;
create policy "admin manages exercises" on public.exercises for all to authenticated using((select public.is_arniy_admin())) with check((select public.is_arniy_admin()));
drop policy if exists "subscribers and admins read exercise media" on public.exercise_media;
create policy "subscribers and admins read exercise media" on public.exercise_media for select to authenticated using((select public.has_active_subscription()) or (select public.is_arniy_admin()));
drop policy if exists "admins manage exercise media" on public.exercise_media;
create policy "admins manage exercise media" on public.exercise_media for all to authenticated using((select public.is_arniy_admin())) with check((select public.is_arniy_admin()));
drop policy if exists "published diets are public" on public.diet_plans;
create policy "published diets are public" on public.diet_plans for select to anon,authenticated using(published or (select public.is_arniy_admin()));
drop policy if exists "admin manages diets" on public.diet_plans;
create policy "admin manages diets" on public.diet_plans for all to authenticated using((select public.is_arniy_admin())) with check((select public.is_arniy_admin()));
grant select,insert,update,delete on public.diet_plan_media to authenticated;
drop policy if exists "subscribers read published diet media" on public.diet_plan_media;
create policy "subscribers read published diet media" on public.diet_plan_media for select to authenticated using((select public.is_arniy_admin()) or ((select public.has_active_subscription()) and (select public.is_active_device()) and exists(select 1 from public.diet_plans p where p.id=diet_plan_id and p.published)));
drop policy if exists "admins manage diet media" on public.diet_plan_media;
create policy "admins manage diet media" on public.diet_plan_media for all to authenticated using((select public.is_arniy_admin())) with check((select public.is_arniy_admin()));
drop policy if exists "active plans visible" on public.plan_prices;
create policy "active plans visible" on public.plan_prices for select to anon,authenticated using(active or (select public.is_arniy_admin()));
drop policy if exists "admin manages plans" on public.plan_prices;
create policy "admin manages plans" on public.plan_prices for all to authenticated using((select public.is_arniy_admin())) with check((select public.is_arniy_admin()));
drop policy if exists "member reads own subscription" on public.subscriptions;
create policy "member reads own subscription" on public.subscriptions for select to authenticated using(user_id=(select auth.uid()) and (select public.is_active_device()));
drop policy if exists "admin reads subscriptions" on public.subscriptions;
create policy "admin reads subscriptions" on public.subscriptions for select to authenticated using((select public.is_arniy_admin()));
drop policy if exists "admin manages subscriptions" on public.subscriptions;
create policy "admin manages subscriptions" on public.subscriptions for all to authenticated using((select public.is_arniy_admin())) with check((select public.is_arniy_admin()));
drop policy if exists "member reads own p2p payments" on public.p2p_payments;
create policy "member reads own p2p payments" on public.p2p_payments for select to authenticated using(user_id=(select auth.uid()) and (select public.is_active_device()));
drop policy if exists "member submits own p2p payment" on public.p2p_payments;
create policy "member submits own p2p payment" on public.p2p_payments for insert to authenticated with check(user_id=(select auth.uid()) and status='pending' and amount_uzs>0 and receipt_sha256 ~ '^[0-9a-f]{64}$' and (storage.foldername(receipt_path))[1]=(select auth.uid())::text and receipt_path !~ '(^|/)\.\.?(\/|$)' and (select public.is_active_device()) and exists(select 1 from public.plan_prices p where p.plan_key=p2p_payments.plan_key and p.amount_uzs=p2p_payments.amount_uzs and p.active) and exists(select 1 from public.about_content a where a.id=1 and a.content #>> '{legal,ready}'='true'));
drop policy if exists "admin manages p2p" on public.p2p_payments;
create policy "admin manages p2p" on public.p2p_payments for all to authenticated using((select public.is_arniy_admin())) with check((select public.is_arniy_admin()));
drop policy if exists "member manages own weights" on public.weight_logs;
create policy "member manages own weights" on public.weight_logs for all to authenticated using(user_id=(select auth.uid()) and (select public.is_active_device())) with check(user_id=(select auth.uid()) and (select public.is_active_device()));
drop policy if exists "member manages own water" on public.water_logs;
create policy "member manages own water" on public.water_logs for all to authenticated using(user_id=(select auth.uid()) and (select public.is_active_device())) with check(user_id=(select auth.uid()) and (select public.is_active_device()));
drop policy if exists "public reads about" on public.about_content;
create policy "public reads about" on public.about_content for select to anon,authenticated using(true);
drop policy if exists "public reads current gym news" on public.gym_news;
create policy "public reads current gym news" on public.gym_news for select to anon,authenticated using(published and (publish_at is null or publish_at<=now()) and (expires_at is null or expires_at>now()));
drop policy if exists "admins manage gym news" on public.gym_news;
create policy "admins manage gym news" on public.gym_news for all to authenticated using((select public.is_arniy_admin())) with check((select public.is_arniy_admin()));
grant select on public.gym_news to anon,authenticated;
grant insert,update,delete on public.gym_news to authenticated;
drop policy if exists "admin manages about" on public.about_content;
create policy "admin manages about" on public.about_content for all to authenticated using((select public.is_arniy_admin())) with check((select public.is_arniy_admin()));
drop policy if exists "admin reads active devices" on public.active_devices;
create policy "admin reads active devices" on public.active_devices for select to authenticated using((select public.is_arniy_admin()));

revoke select on public.payment_info from anon;
grant select on public.payment_info to authenticated;
drop policy if exists "members read payment details" on public.payment_info;
create policy "members read payment details" on public.payment_info for select to authenticated using((select public.is_active_device()));
drop policy if exists "admin manages payment details" on public.payment_info;
create policy "admin manages payment details" on public.payment_info for all to authenticated using((select public.is_arniy_admin())) with check((select public.is_arniy_admin()));
grant select on public.admin_audit_log to authenticated;
drop policy if exists "admins read audit log" on public.admin_audit_log;
create policy "admins read audit log" on public.admin_audit_log for select to authenticated using((select public.is_arniy_admin()));
grant select,insert,update,delete on public.steps_logs to authenticated;
drop policy if exists "members manage own step logs" on public.steps_logs;
create policy "members manage own step logs" on public.steps_logs for all to authenticated using(user_id=(select auth.uid()) and (select public.is_active_device())) with check(user_id=(select auth.uid()) and (select public.is_active_device()));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('p2p-receipts','p2p-receipts',false,10485760,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict(id) do nothing;
drop policy if exists "member uploads own receipt" on storage.objects;
create policy "member uploads own receipt" on storage.objects for insert to authenticated
with check(bucket_id='p2p-receipts' and (storage.foldername(name))[1]=(select auth.uid())::text and (select public.is_active_device()));
drop policy if exists "member sees own receipt" on storage.objects;
create policy "member sees own receipt" on storage.objects for select to authenticated
using(bucket_id='p2p-receipts' and (storage.foldername(name))[1]=(select auth.uid())::text and (select public.is_active_device()));
drop policy if exists "admin sees receipts" on storage.objects;
create policy "admin sees receipts" on storage.objects for select to authenticated
using(bucket_id='p2p-receipts' and (select public.is_arniy_admin()));

drop policy if exists "member manages calorie settings" on public.calorie_settings;
create policy "member manages calorie settings" on public.calorie_settings for all to authenticated using(user_id=(select auth.uid()) and (select public.is_active_device())) with check(user_id=(select auth.uid()) and (select public.is_active_device()));
drop policy if exists "member reads own calorie logs" on public.calorie_logs;
create policy "member reads own calorie logs" on public.calorie_logs for select to authenticated using(user_id=(select auth.uid()) and (select public.is_active_device()));
drop policy if exists "member adds manual calorie logs" on public.calorie_logs;
create policy "member adds manual calorie logs" on public.calorie_logs for insert to authenticated with check(user_id=(select auth.uid()) and source in ('manual','exercise') and (select public.is_active_device()));
drop policy if exists "member deletes own non-ai logs" on public.calorie_logs;
create policy "member deletes own non-ai logs" on public.calorie_logs for delete to authenticated using(user_id=(select auth.uid()) and source in ('manual','exercise') and (select public.is_active_device()));
drop policy if exists "member manages own push subscriptions" on public.push_subscriptions;
create policy "member manages own push subscriptions" on public.push_subscriptions for all to authenticated using(user_id=(select auth.uid()) and (select public.is_active_device())) with check(user_id=(select auth.uid()) and (select public.is_active_device()));
drop policy if exists "member reads own AI scan usage" on public.ai_usage_logs;
create policy "member reads own AI scan usage" on public.ai_usage_logs for select to authenticated using(user_id=(select auth.uid()) and (select public.is_active_device()));
drop policy if exists "member manages own exercise favorites" on public.exercise_favorites;
create policy "member manages own exercise favorites" on public.exercise_favorites for all to authenticated using(user_id=(select auth.uid()) and (select public.is_active_device())) with check(user_id=(select auth.uid()) and (select public.is_active_device()));
drop policy if exists "member manages own workout history" on public.workout_logs;
create policy "member manages own workout history" on public.workout_logs for all to authenticated using(user_id=(select auth.uid()) and (select public.is_active_device())) with check(user_id=(select auth.uid()) and (select public.is_active_device()) and exists(select 1 from public.exercises e where e.id=workout_logs.exercise_id and e.published));
drop policy if exists "public reads workout categories" on public.workout_categories;
create policy "public reads workout categories" on public.workout_categories for select to anon,authenticated using(published or (select public.is_arniy_admin()));
drop policy if exists "admin manages workout categories" on public.workout_categories;
create policy "admin manages workout categories" on public.workout_categories for all to authenticated using((select public.is_arniy_admin())) with check((select public.is_arniy_admin()));

insert into public.workout_categories(slug,name,description,display_order) values
 ('shoulders','Yelka','Barqarorlik, kuch va nazorat.',1),('biceps','Qo‘l oldi','Nazoratli harakat, aniq natija.',2),('triceps','Qo‘l orqa','Kuchli itarish harakatlari.',3),('back','Qanot','Orqa mushaklar uchun asosiy mashqlar.',4),('chest','Ko‘krak','Texnika birinchi o‘rinda.',5),('legs','Oyoq','Kuchli poydevor shu yerdan.',6)
on conflict(slug) do nothing;

-- Remove legacy demo access objects from earlier iterations; ArniyGym has no demo account.
drop function if exists public.consume_demo_ai_scan(text,int);
drop table if exists public.demo_ai_usage;

-- Bootstrap admin only after verifying the account. Replace with its real auth.users UUID.
-- insert into public.admin_roles(user_id,role,telegram_user_id) values ('AUTH_USER_UUID','admin',123456789);

-- Production gym operations, payment ledger, and safer provider event handling.
create extension if not exists pgcrypto;

alter table public.subscriptions drop constraint if exists subscriptions_source_check;
alter table public.subscriptions add constraint subscriptions_source_check
  check(source in ('lemon_squeezy','payme','p2p','manual'));

create table if not exists public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check(provider in ('lemon_squeezy','payme')),
  provider_order_id text not null unique,
  provider_order_reference text,
  provider_payment_id text,
  provider_subscription_id text,
  source_event_id text unique,
  plan_key text not null check(plan_key in ('monthly','yearly')),
  amount_uzs bigint check(amount_uzs is null or amount_uzs > 0),
  amount_usd numeric(10,2),
  refunded_amount_usd numeric(10,2) not null default 0 check(refunded_amount_usd>=0 and (amount_usd is null or refunded_amount_usd<=amount_usd)),
  currency text not null default 'UZS' check(currency in ('UZS','USD')),
  status text not null default 'pending' check(status in ('pending','paid','failed','refunded')),
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  check((currency='UZS' and amount_uzs>0) or (currency='USD' and amount_usd>0))
);
alter table public.payment_orders add column if not exists provider_order_reference text;
alter table public.payment_orders add column if not exists refunded_amount_usd numeric(10,2) not null default 0;
alter table public.payment_orders drop constraint if exists payment_orders_refunded_amount_usd_check;
alter table public.payment_orders add constraint payment_orders_refunded_amount_usd_check
  check(refunded_amount_usd>=0 and (amount_usd is null or refunded_amount_usd<=amount_usd));
create unique index if not exists payment_orders_provider_payment_once
  on public.payment_orders(provider,provider_payment_id) where provider_payment_id is not null;
create index if not exists payment_orders_user_recent on public.payment_orders(user_id,created_at desc);
alter table public.payment_orders enable row level security;
revoke all on public.payment_orders from anon,authenticated;
grant select on public.payment_orders to authenticated;
drop policy if exists "member reads own payment orders" on public.payment_orders;
create policy "member reads own payment orders" on public.payment_orders for select to authenticated
  using(user_id=(select auth.uid()) and (select public.is_active_device()));
drop policy if exists "admin reads payment orders" on public.payment_orders;
create policy "admin reads payment orders" on public.payment_orders for select to authenticated
  using((select public.is_arniy_admin()));
grant all on public.payment_orders to service_role;
revoke insert on public.p2p_payments from anon,authenticated;
grant all on public.p2p_payments to service_role;

create table if not exists public.gym_classes (
  id uuid primary key default gen_random_uuid(),
  title text not null check(length(trim(title)) between 2 and 120),
  coach_name text not null default '' check(length(coach_name)<=120),
  starts_at timestamptz not null,
  duration_minutes smallint not null default 60 check(duration_minutes between 15 and 240),
  capacity smallint not null check(capacity between 1 and 200),
  location text not null default '' check(length(location)<=200),
  status text not null default 'scheduled' check(status in ('scheduled','cancelled','completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gym_classes_upcoming on public.gym_classes(starts_at) where status='scheduled';
alter table public.gym_classes enable row level security;
grant select on public.gym_classes to anon,authenticated;
grant insert,update,delete on public.gym_classes to authenticated;
drop policy if exists "public reads upcoming gym classes" on public.gym_classes;
create policy "public reads upcoming gym classes" on public.gym_classes for select to anon,authenticated
  using(status='scheduled' and starts_at>now() or (select public.is_arniy_admin()));
drop policy if exists "admin manages gym classes" on public.gym_classes;
create policy "admin manages gym classes" on public.gym_classes for all to authenticated
  using((select public.is_arniy_admin())) with check((select public.is_arniy_admin()));

create table if not exists public.gym_class_bookings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.gym_classes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'booked' check(status in ('booked','waitlisted','cancelled','attended','no_show')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reminder_sent_at timestamptz,
  unique(class_id,user_id)
);
create index if not exists gym_bookings_waitlist on public.gym_class_bookings(class_id,created_at) where status='waitlisted';
create index if not exists gym_bookings_member on public.gym_class_bookings(user_id,created_at desc);
alter table public.gym_class_bookings enable row level security;
grant select on public.gym_class_bookings to authenticated;
drop policy if exists "member reads own class bookings" on public.gym_class_bookings;
create policy "member reads own class bookings" on public.gym_class_bookings for select to authenticated
  using(user_id=(select auth.uid()) and (select public.is_active_device()));
drop policy if exists "admin reads class bookings" on public.gym_class_bookings;
create policy "admin reads class bookings" on public.gym_class_bookings for select to authenticated
  using((select public.is_arniy_admin()));
revoke insert,update,delete on public.gym_class_bookings from anon,authenticated;
grant all on public.gym_class_bookings to service_role;

create table if not exists public.membership_freeze_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  days smallint not null check(days between 1 and 30),
  reason text not null default '' check(length(reason)<=500),
  status text not null default 'pending' check(status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  freeze_started_at timestamptz,
  freeze_until timestamptz
);
create index if not exists membership_freeze_user on public.membership_freeze_requests(user_id,requested_at desc);
alter table public.membership_freeze_requests enable row level security;
grant select,insert on public.membership_freeze_requests to authenticated;
drop policy if exists "member reads own freezes" on public.membership_freeze_requests;
create policy "member reads own freezes" on public.membership_freeze_requests for select to authenticated
  using(user_id=(select auth.uid()) and (select public.is_active_device()));
drop policy if exists "member requests own freeze" on public.membership_freeze_requests;
create policy "member requests own freeze" on public.membership_freeze_requests for insert to authenticated
  with check(user_id=(select auth.uid()) and status='pending' and reviewed_by is null and freeze_started_at is null and (select public.is_active_device())
    and exists(select 1 from public.subscriptions s where s.user_id=(select auth.uid()) and s.status in ('active','on_trial','cancelled') and s.current_period_end>now())
    and not exists(select 1 from public.membership_freeze_requests f where f.user_id=(select auth.uid()) and f.status='pending'));
drop policy if exists "admin reads freeze requests" on public.membership_freeze_requests;
create policy "admin reads freeze requests" on public.membership_freeze_requests for select to authenticated
  using((select public.is_arniy_admin()));
revoke update,delete on public.membership_freeze_requests from authenticated;
grant all on public.membership_freeze_requests to service_role;

create table if not exists public.gym_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scanned_by uuid not null references auth.users(id),
  ticket_nonce uuid not null unique,
  checked_in_at timestamptz not null default now()
);
create index if not exists gym_checkins_member_recent on public.gym_checkins(user_id,checked_in_at desc);
alter table public.gym_checkins enable row level security;
grant select on public.gym_checkins to authenticated;
drop policy if exists "member reads own checkins" on public.gym_checkins;
create policy "member reads own checkins" on public.gym_checkins for select to authenticated
  using(user_id=(select auth.uid()) and (select public.is_active_device()));
drop policy if exists "admin reads checkins" on public.gym_checkins;
create policy "admin reads checkins" on public.gym_checkins for select to authenticated
  using((select public.is_arniy_admin()));
grant all on public.gym_checkins to service_role;

create table if not exists public.gym_intro_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check(length(trim(full_name)) between 2 and 120),
  phone_e164 text not null check(phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  note text not null default '' check(length(note)<=500),
  notification_status text not null default 'pending' check(notification_status in ('pending','sent','failed')),
  created_at timestamptz not null default now()
);
create index if not exists gym_intro_requests_recent on public.gym_intro_requests(created_at desc);
alter table public.gym_intro_requests enable row level security;
revoke all on public.gym_intro_requests from anon,authenticated;
grant select,update on public.gym_intro_requests to authenticated;
grant all on public.gym_intro_requests to service_role;
drop policy if exists "admin manages intro requests" on public.gym_intro_requests;
create policy "admin manages intro requests" on public.gym_intro_requests for all to authenticated
  using((select public.is_arniy_admin())) with check((select public.is_arniy_admin()));

create table if not exists public.subscription_reminders (
  subscription_id uuid not null references public.subscriptions(id) on delete cascade,
  period_end timestamptz not null,
  status text not null default 'pending' check(status in ('pending','sent','failed')),
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(subscription_id,period_end)
);
alter table public.subscription_reminders enable row level security;
revoke all on public.subscription_reminders from public,anon,authenticated;
grant all on public.subscription_reminders to service_role;

create or replace function public.has_active_subscription()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(
  select 1 from public.subscriptions s join public.active_devices d on d.user_id=s.user_id
  where s.user_id=(select auth.uid()) and d.session_id::text=(select auth.jwt()->>'session_id')
    and s.status in ('active','on_trial','cancelled') and s.current_period_end>now()
    and not exists(select 1 from public.membership_freeze_requests f where f.user_id=s.user_id
      and f.status='approved' and f.freeze_started_at<=now() and f.freeze_until>now())
); $$;

create or replace function public.book_gym_class(p_class_id uuid)
returns table(booking_status text,"position" integer)
language plpgsql security definer set search_path=''
as $$
declare cls public.gym_classes%rowtype; current_status text; wait_position integer;
begin
  if auth.uid() is null or not (select public.is_active_device()) then raise exception 'active device required'; end if;
  if not (select public.has_active_subscription()) then raise exception 'active membership required'; end if;
  select * into cls from public.gym_classes where id=p_class_id for update;
  if not found or cls.status<>'scheduled' or cls.starts_at<=now() then raise exception 'class unavailable'; end if;
  select b.status into current_status from public.gym_class_bookings b where b.class_id=p_class_id and b.user_id=auth.uid() for update;
  if current_status in ('booked','waitlisted','attended') then
    if current_status='waitlisted' then select count(*)::int into wait_position from public.gym_class_bookings where class_id=p_class_id and status='waitlisted' and created_at<=(select created_at from public.gym_class_bookings where class_id=p_class_id and user_id=auth.uid()); else wait_position:=0; end if;
    return query select current_status,wait_position; return;
  end if;
  if (select count(*) from public.gym_class_bookings where class_id=p_class_id and status='booked') < cls.capacity then current_status:='booked'; wait_position:=0;
  else current_status:='waitlisted'; select count(*)::int+1 into wait_position from public.gym_class_bookings where class_id=p_class_id and status='waitlisted'; end if;
  insert into public.gym_class_bookings(class_id,user_id,status,updated_at) values(p_class_id,auth.uid(),current_status,now())
    on conflict(class_id,user_id) do update set status=excluded.status,updated_at=now(),reminder_sent_at=null;
  return query select current_status,wait_position;
end; $$;

create or replace function public.cancel_gym_class_booking(p_user_id uuid,p_class_id uuid)
returns table(booking_status text,promoted_user_id uuid)
language plpgsql security definer set search_path=''
as $$
declare current_status text; promoted uuid;
begin
  if p_user_id is null then raise exception 'member required'; end if;
  perform 1 from public.gym_classes where id=p_class_id for update;
  select status into current_status from public.gym_class_bookings where class_id=p_class_id and user_id=p_user_id for update;
  if current_status is null or current_status='cancelled' then raise exception 'booking not found'; end if;
  update public.gym_class_bookings set status='cancelled',updated_at=now() where class_id=p_class_id and user_id=p_user_id;
  if current_status='booked' then
    select user_id into promoted from public.gym_class_bookings where class_id=p_class_id and status='waitlisted' order by created_at,id for update skip locked limit 1;
    if promoted is not null then update public.gym_class_bookings set status='booked',updated_at=now() where class_id=p_class_id and user_id=promoted; end if;
  end if;
  return query select 'cancelled'::text,promoted;
end; $$;

create or replace function public.review_membership_freeze(p_request_id uuid,p_approve boolean,p_reviewer_id uuid)
returns public.membership_freeze_requests language plpgsql security definer set search_path=''
as $$
declare req public.membership_freeze_requests%rowtype; finish timestamptz;
begin
  if p_reviewer_id is null or not exists(select 1 from public.admin_roles r where r.user_id=p_reviewer_id and r.role='admin') then raise exception 'admin reviewer required'; end if;
  select * into req from public.membership_freeze_requests where id=p_request_id and status='pending' for update;
  if not found then raise exception 'freeze request already reviewed'; end if;
  perform set_config('app.admin_user_id',p_reviewer_id::text,true);
  if p_approve then
    select greatest(max(current_period_end),now()) into finish from public.subscriptions where user_id=req.user_id and status in ('active','on_trial','cancelled') and current_period_end>now();
    if finish is null then raise exception 'active membership required'; end if;
    update public.subscriptions set current_period_end=finish+(req.days||' days')::interval,updated_at=now()
      where id=(select id from public.subscriptions where user_id=req.user_id and status in ('active','on_trial','cancelled') and current_period_end>now() order by current_period_end desc limit 1);
    update public.membership_freeze_requests set status='approved',reviewed_by=p_reviewer_id,reviewed_at=now(),freeze_started_at=now(),freeze_until=now()+(req.days||' days')::interval where id=req.id returning * into req;
  else
    update public.membership_freeze_requests set status='rejected',reviewed_by=p_reviewer_id,reviewed_at=now() where id=req.id returning * into req;
  end if;
  return req;
end; $$;

create or replace function public.record_membership_checkin(p_user_id uuid,p_nonce uuid,p_expires_at timestamptz,p_scanned_by uuid)
returns timestamptz language plpgsql security definer set search_path=''
as $$ declare stamp timestamptz:=now(); begin
  if p_expires_at<=stamp or p_expires_at>stamp+interval '2 minutes' then raise exception 'ticket expired'; end if;
  if p_scanned_by is null or not exists(select 1 from public.admin_roles r where r.user_id=p_scanned_by and r.role='admin') then raise exception 'admin scanner required'; end if;
  if not exists(select 1 from public.subscriptions s where s.user_id=p_user_id and s.status in ('active','on_trial','cancelled') and s.current_period_end>stamp)
    or exists(select 1 from public.membership_freeze_requests f where f.user_id=p_user_id and f.status='approved' and f.freeze_started_at<=stamp and f.freeze_until>stamp) then raise exception 'membership inactive'; end if;
  perform set_config('app.admin_user_id',p_scanned_by::text,true);
  insert into public.gym_checkins(user_id,scanned_by,ticket_nonce) values(p_user_id,p_scanned_by,p_nonce);
  return stamp;
end; $$;

create or replace function public.apply_payme_payment(p_order_id text,p_payment_id text,p_order_status text,p_amount_tiyin bigint)
returns text language plpgsql security definer set search_path=''
as $$
declare ord public.payment_orders%rowtype; finish timestamptz;
begin
  if p_order_status not in ('approved','declined','expired','reversed','refunded') then raise exception 'invalid Payme status'; end if;
  select * into ord from public.payment_orders where provider='payme' and provider_order_id=p_order_id for update;
  if not found then raise exception 'payment order not found'; end if;
  if p_amount_tiyin<>ord.amount_uzs*100 then raise exception 'payment amount mismatch'; end if;
  if ord.status='paid' and p_order_status='approved' and ord.provider_payment_id=p_payment_id then return 'duplicate'; end if;
  if ord.status='refunded' and p_order_status in ('refunded','reversed') then return 'duplicate'; end if;
  if p_order_status='approved' then
    if ord.status<>'pending' then return 'stale'; end if;
    select greatest(coalesce(max(current_period_end),now()),now()) into finish
      from public.subscriptions where user_id=ord.user_id and status in ('active','on_trial','cancelled') and current_period_end>now();
    finish:=finish+case when ord.plan_key='yearly' then interval '365 days' else interval '30 days' end;
    update public.payment_orders set status='paid',provider_payment_id=left(p_payment_id,160),paid_at=now(),updated_at=now() where id=ord.id;
    insert into public.subscriptions(user_id,source,provider_subscription_id,plan_key,status,current_period_end)
      values(ord.user_id,'payme','payme:'||ord.provider_order_id,ord.plan_key,'active',finish)
      on conflict(provider_subscription_id) do nothing;
    return 'paid';
  elsif p_order_status in ('refunded','reversed') then
    update public.payment_orders set status='refunded',provider_payment_id=coalesce(left(p_payment_id,160),provider_payment_id),updated_at=now() where id=ord.id;
    update public.subscriptions set status='refunded',current_period_end=now(),updated_at=now()
      where provider_subscription_id='payme:'||ord.provider_order_id and status in ('active','on_trial','cancelled');
    return 'refunded';
  else
    update public.payment_orders set status='failed',provider_payment_id=coalesce(left(p_payment_id,160),provider_payment_id),updated_at=now()
      where id=ord.id and status='pending';
    return 'failed';
  end if;
end; $$;

create or replace function public.admin_dashboard_summary()
returns jsonb language sql stable security definer set search_path=''
as $$
select case when (select public.is_arniy_admin()) then jsonb_build_object(
  'subscription_total',(select count(*) from public.subscriptions),
  'active_memberships',(select count(distinct s.user_id) from public.subscriptions s where s.status in ('active','on_trial','cancelled') and s.current_period_end>now()
    and not exists(select 1 from public.membership_freeze_requests f where f.user_id=s.user_id and f.status='approved' and f.freeze_started_at<=now() and f.freeze_until>now())),
  'cancelled_subscriptions',(select count(*) from public.subscriptions where status='cancelled'),
  'cancelled_30d',(select count(*) from public.subscriptions where status='cancelled' and updated_at>=now()-interval '30 days'),
  'pending_payments',(select count(*) from public.p2p_payments where status='pending'),
  'approved_p2p_uzs',(select coalesce(sum(amount_uzs),0) from public.p2p_payments where status='approved'),
  'automated_paid_uzs',(select coalesce(sum(amount_uzs),0) from public.payment_orders where provider='payme' and status='paid'),
  'automated_paid_usd',(select coalesce(sum(amount_usd-refunded_amount_usd),0) from public.payment_orders where provider='lemon_squeezy' and status in ('paid','refunded')),
  'pending_automated_payments',(select count(*) from public.payment_orders where status='pending'),
  'scheduled_classes',(select count(*) from public.gym_classes where status='scheduled' and starts_at>now()),
  'pending_freeze_requests',(select count(*) from public.membership_freeze_requests where status='pending')
) else null end; $$;

create or replace function public.apply_lemonsqueezy_event(
  p_event_id text,p_event_name text,p_provider_subscription_id text,p_user_id uuid,
  p_plan_key text,p_status text,p_period_end timestamptz,p_event_updated_at timestamptz
) returns text language plpgsql security definer set search_path=''
as $$
declare result_id uuid; prior public.subscriptions%rowtype;
begin
  if coalesce(length(p_event_id),0)=0 or coalesce(length(p_event_name),0)=0 then raise exception 'invalid event'; end if;
  insert into public.webhook_events(event_id,event_name) values(left(p_event_id,200),left(p_event_name,100)) on conflict(event_id) do nothing;
  if not found then return 'duplicate'; end if;
  if p_provider_subscription_id is null or p_status is null or p_event_updated_at is null then return 'ignored'; end if;
  if p_status not in ('active','on_trial','paused','cancelled','expired','past_due','refunded') then return 'ignored'; end if;
  if p_user_id is null or p_plan_key is null or p_plan_key not in ('monthly','yearly') then return 'ignored'; end if;
  if p_status in ('active','on_trial') and p_period_end is null then return 'ignored'; end if;
  select * into prior from public.subscriptions where provider_subscription_id=p_provider_subscription_id for update;
  if found then
    if prior.user_id<>p_user_id then raise exception 'subscription owner mismatch'; end if;
    if coalesce(prior.provider_updated_at,prior.updated_at,prior.created_at)>=p_event_updated_at then return 'stale'; end if;
    update public.subscriptions set plan_key=p_plan_key,status=p_status,
      current_period_end=case when p_period_end is not null then p_period_end else prior.current_period_end end,
      provider_updated_at=p_event_updated_at,updated_at=now() where id=prior.id;
    return 'updated';
  end if;
  if p_status in ('paused','cancelled','expired','past_due','refunded') then return 'ignored'; end if;
  insert into public.subscriptions(user_id,source,provider_subscription_id,plan_key,status,current_period_end,provider_updated_at,updated_at)
  values(p_user_id,'lemon_squeezy',left(p_provider_subscription_id,100),p_plan_key,p_status,p_period_end,p_event_updated_at,now())
  on conflict(provider_subscription_id) do nothing returning id into result_id;
  if result_id is null then return 'stale'; end if;
  return 'inserted';
end; $$;

create or replace function public.record_lemonsqueezy_payment(
  p_event_id text,p_invoice_id text,p_order_id text,p_subscription_id text,p_user_id uuid,p_plan_key text,p_status text,
  p_total_usd numeric,p_refunded_usd numeric,p_refund_all boolean default false
)
returns text language plpgsql security definer set search_path=''
as $$
declare subscription_row public.subscriptions%rowtype; result_id uuid; refund_value numeric(10,2);
begin
  if p_event_id is null or p_invoice_id is null or p_subscription_id is null or p_user_id is null or p_plan_key not in ('monthly','yearly') then return 'ignored'; end if;
  select * into subscription_row from public.subscriptions where provider_subscription_id=p_subscription_id and user_id=p_user_id;
  if not found then return 'ignored'; end if;
  if p_status='paid' then
    if p_total_usd is null or p_total_usd<=0 then return 'ignored'; end if;
    insert into public.payment_orders(user_id,provider,provider_order_id,provider_order_reference,provider_payment_id,provider_subscription_id,source_event_id,plan_key,amount_usd,currency,status,paid_at)
    values(p_user_id,'lemon_squeezy','lemon-event:'||left(p_event_id,160),left(p_order_id,160),left(p_invoice_id,160),p_subscription_id,left(p_event_id,200),p_plan_key,round(p_total_usd,2),'USD','paid',now())
    on conflict(provider,provider_payment_id) where provider_payment_id is not null do nothing returning id into result_id;
    if result_id is null then return 'duplicate'; end if;
    return 'recorded';
  elsif p_status='refunded' then
    if p_refund_all then
      select id,amount_usd into result_id,refund_value from public.payment_orders
        where provider='lemon_squeezy' and provider_order_reference=left(coalesce(p_order_id,''),160)
          and provider_subscription_id=p_subscription_id for update;
      if result_id is null then return 'ignored'; end if;
      refund_value:=least(coalesce(nullif(p_refunded_usd,0),refund_value),refund_value);
      update public.payment_orders set refunded_amount_usd=refund_value,
        status=case when refund_value>=amount_usd then 'refunded' else 'paid' end,updated_at=now() where id=result_id;
      return 'refunded';
    end if;
    select id,amount_usd into result_id,refund_value from public.payment_orders
      where provider='lemon_squeezy' and provider_payment_id=left(p_invoice_id,160) and provider_subscription_id=p_subscription_id for update;
    if result_id is null then return 'ignored'; end if;
    refund_value:=least(coalesce(nullif(p_refunded_usd,0),refund_value),refund_value);
    update public.payment_orders set refunded_amount_usd=refund_value,
      status=case when refund_value>=amount_usd then 'refunded' else 'paid' end,updated_at=now() where id=result_id;
    return 'refunded';
  end if;
  return 'ignored';
end; $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('gym-gallery','gym-gallery',true,10485760,array['image/webp']) on conflict(id) do update set public=true,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "public reads gym gallery" on storage.objects;
create policy "public reads gym gallery" on storage.objects for select to anon,authenticated using(bucket_id='gym-gallery');
drop policy if exists "admin uploads gym gallery" on storage.objects;
create policy "admin uploads gym gallery" on storage.objects for insert to authenticated with check(bucket_id='gym-gallery' and (select public.is_arniy_admin()));
drop policy if exists "admin updates gym gallery" on storage.objects;
create policy "admin updates gym gallery" on storage.objects for update to authenticated using(bucket_id='gym-gallery' and (select public.is_arniy_admin())) with check(bucket_id='gym-gallery' and (select public.is_arniy_admin()));
drop policy if exists "admin deletes gym gallery" on storage.objects;
create policy "admin deletes gym gallery" on storage.objects for delete to authenticated using(bucket_id='gym-gallery' and (select public.is_arniy_admin()));

drop trigger if exists audit_admin_gym_classes on public.gym_classes;
create trigger audit_admin_gym_classes after insert or update or delete on public.gym_classes for each row execute function public.audit_admin_mutation();
drop trigger if exists audit_admin_gym_checkins on public.gym_checkins;
create trigger audit_admin_gym_checkins after insert or update or delete on public.gym_checkins for each row execute function public.audit_admin_mutation();
drop trigger if exists audit_admin_freezes on public.membership_freeze_requests;
create trigger audit_admin_freezes after insert or update or delete on public.membership_freeze_requests for each row execute function public.audit_admin_mutation();
drop trigger if exists audit_admin_intro_requests on public.gym_intro_requests;
create trigger audit_admin_intro_requests after update or delete on public.gym_intro_requests for each row execute function public.audit_admin_mutation();

revoke all on function public.book_gym_class(uuid) from public,anon;
revoke all on function public.cancel_gym_class_booking(uuid,uuid) from public,anon,authenticated;
revoke all on function public.review_membership_freeze(uuid,boolean,uuid) from public,anon,authenticated;
revoke all on function public.record_membership_checkin(uuid,uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.book_gym_class(uuid) to authenticated;
grant execute on function public.cancel_gym_class_booking(uuid,uuid) to service_role;
grant execute on function public.review_membership_freeze(uuid,boolean,uuid) to service_role;
grant execute on function public.record_membership_checkin(uuid,uuid,timestamptz,uuid) to service_role;
revoke all on function public.apply_payme_payment(text,text,text,bigint) from public,anon,authenticated;
grant execute on function public.apply_payme_payment(text,text,text,bigint) to service_role;
revoke all on function public.record_lemonsqueezy_payment(text,text,text,text,uuid,text,text,numeric,numeric,boolean) from public,anon,authenticated;
grant execute on function public.record_lemonsqueezy_payment(text,text,text,text,uuid,text,text,numeric,numeric,boolean) to service_role;
revoke all on function public.apply_lemonsqueezy_event(text,text,text,uuid,text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.apply_lemonsqueezy_event(text,text,text,uuid,text,text,timestamptz,timestamptz) to service_role;

-- Optional Russian counterparts for operator-managed public content.
alter table public.plan_prices
  add column if not exists title_ru text not null default '';

alter table public.diet_plans
  add column if not exists title_ru text not null default '';

alter table public.diet_plan_media
  add column if not exists title_ru text not null default '',
  add column if not exists description_ru text not null default '';

alter table public.gym_news
  add column if not exists title_ru text not null default '',
  add column if not exists body_ru text not null default '';

grant select on public.plan_prices to anon,authenticated;
grant insert,update,delete on public.plan_prices to authenticated;

drop trigger if exists audit_admin_diet_plan_media on public.diet_plan_media;
create trigger audit_admin_diet_plan_media
  after insert or update or delete on public.diet_plan_media
  for each row execute function public.audit_admin_mutation();

-- ArniyGym: zal yangiliklari, o‘qilgan holat, Web Push va yangilik rasmlari.
-- Idempotent: mavjud bazada ham, yangi bazada ham qayta ishga tushirish xavfsiz.
-- Mavjud public.gym_news jadvali qayta ishlatiladi; ikkinchi "news" jadvali yaratilmaydi.

-- 1. gym_news: kategoriya kalitlari, qadalgan va a’zolar uchun belgilar ----------------
do $$
begin
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name='gym_news' and column_name='featured')
     and not exists(select 1 from information_schema.columns where table_schema='public' and table_name='gym_news' and column_name='is_pinned') then
    alter table public.gym_news rename column featured to is_pinned;
  end if;
end $$;

alter table public.gym_news
  add column if not exists is_pinned boolean not null default false,
  add column if not exists is_members_only boolean not null default false,
  add column if not exists title_ru text not null default '',
  add column if not exists body_ru text not null default '',
  add column if not exists image_path text,
  add column if not exists image_bucket text;

alter table public.gym_news drop constraint if exists gym_news_category_check;
update public.gym_news set category = case category
    when 'Zal e’loni' then 'general'
    when 'Ish vaqti' then 'schedule'
    when 'Aksiya' then 'promo'
    when 'Yangi trenajyor' then 'equipment'
    else 'general' end
  where category not in ('general','schedule','promo','equipment');
alter table public.gym_news alter column category set default 'general';
alter table public.gym_news add constraint gym_news_category_check
  check (category in ('general','schedule','promo','equipment'));

alter table public.gym_news drop constraint if exists gym_news_ru_length_check;
alter table public.gym_news add constraint gym_news_ru_length_check
  check (char_length(title_ru) <= 140 and char_length(body_ru) <= 3000);

-- Rasm faqat Edge Function yuklagan WebP fayl bo‘ladi. A’zolar yangiligining rasmi
-- hech qachon ommaviy bucket’da turmaydi.
alter table public.gym_news drop constraint if exists gym_news_image_check;
alter table public.gym_news add constraint gym_news_image_check check (
  (image_path is null and image_bucket is null)
  or (
    image_path ~ '^news/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$'
    and image_bucket in ('news-images','news-images-members')
    and (is_members_only = (image_bucket = 'news-images-members'))
  )
);

drop index if exists public.gym_news_public_feed;
create index if not exists gym_news_feed_order
  on public.gym_news(published, is_pinned desc, publish_at desc nulls last, created_at desc);

-- Yaratgan admin, updated_at va e’lon sanasi serverda belgilanadi.
create or replace function public.gym_news_before_write()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := now();
    new.created_by := coalesce((select auth.uid()), new.created_by);
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
  end if;
  if new.published and new.publish_at is null then new.publish_at := now(); end if;
  return new;
end; $$;
revoke all on function public.gym_news_before_write() from public, anon, authenticated;
drop trigger if exists gym_news_before_write on public.gym_news;
create trigger gym_news_before_write before insert or update on public.gym_news
  for each row execute function public.gym_news_before_write();

-- O‘qish huquqi: ommaviy yangilik hammaga, a’zolar yangiligi faqat serverda tasdiqlangan
-- amaldagi obunaga (frontenddagi is_premium qiymatiga ishonilmaydi).
alter table public.gym_news enable row level security;
drop policy if exists "public reads current gym news" on public.gym_news;
create policy "public reads current gym news" on public.gym_news for select to anon, authenticated
  using (
    published
    and (publish_at is null or publish_at <= now())
    and (expires_at is null or expires_at > now())
    and (not is_members_only or (select public.has_active_subscription()))
  );
drop policy if exists "admins manage gym news" on public.gym_news;
create policy "admins manage gym news" on public.gym_news for all to authenticated
  using ((select public.is_arniy_admin())) with check ((select public.is_arniy_admin()));

-- Mehmonlarga yaratgan admin ID’si ko‘rsatilmaydi.
revoke select on public.gym_news from anon;
grant select (id, title, title_ru, body, body_ru, category, cover_image_url, image_path, image_bucket,
  published, is_pinned, is_members_only, publish_at, expires_at, created_at, updated_at) on public.gym_news to anon;
grant select, insert, update, delete on public.gym_news to authenticated;

drop trigger if exists audit_admin_news on public.gym_news;
create trigger audit_admin_news after insert or update or delete on public.gym_news
  for each row execute function public.audit_admin_mutation();

-- 2. O‘qilgan yangiliklar (har bir foydalanuvchiga alohida) ---------------------------
create table if not exists public.news_reads (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  news_id uuid not null references public.gym_news(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id, news_id)
);
create index if not exists news_reads_news on public.news_reads(news_id);
alter table public.news_reads enable row level security;
revoke all on public.news_reads from public, anon, authenticated;
grant select, insert, delete on public.news_reads to authenticated;
grant all on public.news_reads to service_role;
drop policy if exists "member reads own news reads" on public.news_reads;
create policy "member reads own news reads" on public.news_reads for select to authenticated
  using (user_id = (select auth.uid()) and (select public.is_active_device()));
drop policy if exists "member marks visible news read" on public.news_reads;
create policy "member marks visible news read" on public.news_reads for insert to authenticated
  with check (
    user_id = (select auth.uid()) and (select public.is_active_device())
    and exists (select 1 from public.gym_news n where n.id = news_reads.news_id)
  );
drop policy if exists "member clears own news reads" on public.news_reads;
create policy "member clears own news reads" on public.news_reads for delete to authenticated
  using (user_id = (select auth.uid()) and (select public.is_active_device()));

-- 3. Push obunalari: rozilik, til, xato hisoblagich -----------------------------------
alter table public.push_subscriptions
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists consented_at timestamptz,
  add column if not exists locale text not null default 'uz',
  add column if not exists failure_count smallint not null default 0,
  add column if not exists last_success_at timestamptz;
alter table public.push_subscriptions drop constraint if exists push_subscriptions_locale_check;
alter table public.push_subscriptions add constraint push_subscriptions_locale_check check (locale in ('uz','ru'));
alter table public.push_subscriptions drop constraint if exists push_subscriptions_endpoint_check;
alter table public.push_subscriptions add constraint push_subscriptions_endpoint_check
  check (endpoint ~ '^https://' and char_length(endpoint) <= 2048 and char_length(p256dh) <= 256 and char_length(auth) <= 128);
-- Eski yozuvlar faqat brauzer ruxsatidan keyin yaratilgan, shuning uchun rozilik sanasi tiklanadi.
update public.push_subscriptions set consented_at = coalesce(consented_at, updated_at) where consented_at is null;
create index if not exists push_subscriptions_user on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;
drop policy if exists "member manages own push subscriptions" on public.push_subscriptions;
create policy "member manages own push subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = (select auth.uid()) and (select public.is_active_device()))
  with check (user_id = (select auth.uid()) and (select public.is_active_device()) and consented_at is not null);

-- Push nishonlari faqat service role uchun: obuna holati serverda tekshiriladi.
create or replace function public.news_push_targets(p_members_only boolean)
returns table(id uuid, user_id uuid, endpoint text, p256dh text, auth text, locale text)
language sql stable security definer set search_path=''
as $$
  select p.id, p.user_id, p.endpoint, p.p256dh, p.auth, p.locale
  from public.push_subscriptions p
  where p.consented_at is not null and p.failure_count < 5
    and (not p_members_only or exists(
      select 1 from public.subscriptions s
      where s.user_id = p.user_id and s.status in ('active','on_trial','cancelled') and s.current_period_end > now()
        and not exists(select 1 from public.membership_freeze_requests f
          where f.user_id = s.user_id and f.status = 'approved' and f.freeze_started_at <= now() and f.freeze_until > now())
    ));
$$;
revoke all on function public.news_push_targets(boolean) from public, anon, authenticated;
grant execute on function public.news_push_targets(boolean) to service_role;

-- 4. Push yuborish jurnali -------------------------------------------------------------
create table if not exists public.news_push_log (
  id bigint generated always as identity primary key,
  news_id uuid references public.gym_news(id) on delete set null,
  admin_user_id uuid references auth.users(id) on delete set null,
  audience text not null check (audience in ('public','members')),
  status text not null default 'sending' check (status in ('sending','sent','partial','failed','skipped')),
  targeted integer not null default 0,
  sent integer not null default 0,
  failed integer not null default 0,
  removed integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists news_push_log_news on public.news_push_log(news_id, created_at desc);
alter table public.news_push_log enable row level security;
revoke all on public.news_push_log from public, anon, authenticated;
grant select on public.news_push_log to authenticated;
grant all on public.news_push_log to service_role;
drop policy if exists "admins read news push log" on public.news_push_log;
create policy "admins read news push log" on public.news_push_log for select to authenticated
  using ((select public.is_arniy_admin()));

-- 5. Storage: ommaviy va a’zolar uchun alohida bucket ---------------------------------
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('news-images', 'news-images', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('news-images-members', 'news-images-members', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "members read member news images" on storage.objects;
create policy "members read member news images" on storage.objects for select to authenticated
  using (bucket_id = 'news-images-members'
    and ((select public.has_active_subscription()) or (select public.is_arniy_admin())));
drop policy if exists "admins read news images" on storage.objects;
create policy "admins read news images" on storage.objects for select to authenticated
  using (bucket_id in ('news-images','news-images-members') and (select public.is_arniy_admin()));
drop policy if exists "admins upload news images" on storage.objects;
create policy "admins upload news images" on storage.objects for insert to authenticated
  with check (bucket_id in ('news-images','news-images-members') and (select public.is_arniy_admin())
    and name ~ '^news/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$');
drop policy if exists "admins update news images" on storage.objects;
create policy "admins update news images" on storage.objects for update to authenticated
  using (bucket_id in ('news-images','news-images-members') and (select public.is_arniy_admin()))
  with check (bucket_id in ('news-images','news-images-members') and (select public.is_arniy_admin()));
drop policy if exists "admins delete news images" on storage.objects;
create policy "admins delete news images" on storage.objects for delete to authenticated
  using (bucket_id in ('news-images','news-images-members') and (select public.is_arniy_admin()));

-- Supabase Security Advisor tuzatishlari (idempotent).
-- consume_ai_scan faqat analyze-food Edge Function (service_role) uchun: aks holda istalgan
-- foydalanuvchi boshqa akkauntning kunlik AI limitini tugatishi mumkin edi.
revoke all on function public.consume_ai_scan(uuid,int,date) from public,anon,authenticated;
grant execute on function public.consume_ai_scan(uuid,int,date) to service_role;
-- Trigger funksiyalari REST /rpc orqali chaqirilmasligi kerak.
revoke all on function public.audit_admin_mutation() from public,anon,authenticated;
revoke all on function public.gym_news_before_write() from public,anon,authenticated;
-- Mehmon (anon) push obunalari jadvaliga umuman kira olmasin.
revoke all on public.push_subscriptions from anon;

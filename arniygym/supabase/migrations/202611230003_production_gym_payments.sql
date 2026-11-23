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

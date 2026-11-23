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

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

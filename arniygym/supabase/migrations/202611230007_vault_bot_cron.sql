-- ArniyGym: Vault-backed runtime secrets, Telegram bot as an Edge Function, scheduled jobs.
-- Idempotent. Secret VALUES are never stored in this file: random secrets are generated inside the
-- database, and the Telegram bot token is added separately (see README → "Telegram bot").

create extension if not exists supabase_vault;
create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Edge Functions read "app:*" Vault secrets through this function (service_role only).
create or replace function public.edge_runtime_secrets()
returns jsonb language sql stable security definer set search_path=''
as $$
  select coalesce(jsonb_object_agg(substr(name, 5), decrypted_secret), '{}'::jsonb)
  from vault.decrypted_secrets where name like 'app:%';
$$;
revoke all on function public.edge_runtime_secrets() from public, anon, authenticated;
grant execute on function public.edge_runtime_secrets() to service_role;

-- Creates a random secret once; never overwrites an existing value.
create or replace function public.ensure_app_secret(p_name text, p_bytes int default 32)
returns void language plpgsql security definer set search_path=''
as $$
begin
  if not exists (select 1 from vault.secrets where name = 'app:' || p_name) then
    perform vault.create_secret(encode(extensions.gen_random_bytes(p_bytes), 'hex'), 'app:' || p_name);
  end if;
end; $$;
revoke all on function public.ensure_app_secret(text, int) from public, anon, authenticated;

select public.ensure_app_secret('OTP_PEPPER');
select public.ensure_app_secret('BOT_OTP_SECRET');
select public.ensure_app_secret('BOT_ADMIN_SECRET');
select public.ensure_app_secret('BOT_QUEUE_SECRET');
select public.ensure_app_secret('BOT_P2P_SECRET');
select public.ensure_app_secret('BOT_WEBHOOK_SECRET');
select public.ensure_app_secret('BOT_CRON_SECRET');
select public.ensure_app_secret('PUSH_REMINDER_SECRET');
select public.ensure_app_secret('GYM_QR_SIGNING_SECRET');

-- Pending /start challenges (replaces the Python bot's local SQLite file).
create table if not exists public.bot_pending_challenges (
  telegram_user_id bigint primary key,
  token text not null check (char_length(token) between 20 and 100),
  expires_at timestamptz not null
);
alter table public.bot_pending_challenges enable row level security;
revoke all on public.bot_pending_challenges from public, anon, authenticated;
grant all on public.bot_pending_challenges to service_role;

-- Scheduler helper: POSTs to an Edge Function with a header taken from Vault.
create or replace function public.call_edge_function(p_function text, p_header text, p_secret_name text)
returns bigint language plpgsql security definer set search_path=''
as $$
declare base text; secret text;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'app:SUPABASE_URL';
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'app:' || p_secret_name;
  if base is null or secret is null then return null; end if;
  return net.http_post(base || '/functions/v1/' || p_function, '{}'::jsonb, '{}'::jsonb,
    jsonb_build_object('Content-Type', 'application/json', p_header, secret), 55000);
end; $$;
revoke all on function public.call_edge_function(text, text, text) from public, anon, authenticated;

do $$
begin
  perform cron.unschedule(jobname) from cron.job where jobname in ('arniygym-bot-tick','arniygym-class-reminders','arniygym-expiry-reminders');
  perform cron.schedule('arniygym-bot-tick', '* * * * *', $job$select public.call_edge_function('telegram-bot','x-cron-secret','BOT_CRON_SECRET')$job$);
  perform cron.schedule('arniygym-class-reminders', '*/15 * * * *', $job$select public.call_edge_function('send-class-reminders','x-reminder-secret','PUSH_REMINDER_SECRET')$job$);
  perform cron.schedule('arniygym-expiry-reminders', '0 4 * * *', $job$select public.call_edge_function('send-expiry-reminders','x-reminder-secret','PUSH_REMINDER_SECRET')$job$);
end $$;

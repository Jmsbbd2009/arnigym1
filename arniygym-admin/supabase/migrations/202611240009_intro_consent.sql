-- First-session lead form: record when the visitor consented to processing name + phone.
alter table public.gym_intro_requests add column if not exists consent_at timestamptz;

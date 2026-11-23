-- Preserve daily AI scan quota when Gemini fails after the scan token is claimed.
create or replace function public.release_ai_scan(p_user_id uuid,p_today date)
returns void language plpgsql security definer set search_path=''
as $$ begin
  update public.ai_usage_logs set scan_count=scan_count-1 where user_id=p_user_id and used_on=p_today and scan_count>0;
  delete from public.ai_usage_logs where user_id=p_user_id and used_on=p_today and scan_count=0;
end; $$;

revoke all on function public.release_ai_scan(uuid,date) from public,anon,authenticated;
grant execute on function public.release_ai_scan(uuid,date) to service_role;

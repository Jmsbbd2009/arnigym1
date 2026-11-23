-- Supabase Security Advisor tuzatishlari (idempotent).
-- consume_ai_scan faqat analyze-food Edge Function (service_role) uchun: aks holda istalgan
-- foydalanuvchi boshqa akkauntning kunlik AI limitini tugatishi mumkin edi.
revoke all on function public.consume_ai_scan(uuid,int,date) from public,anon,authenticated;
grant execute on function public.consume_ai_scan(uuid,int,date) to service_role;
-- Trigger funksiyalari REST /rpc orqali chaqirilmasligi kerak.
revoke all on function public.audit_admin_mutation() from public,anon,authenticated;
revoke all on function public.gym_news_before_write() from public,anon,authenticated;

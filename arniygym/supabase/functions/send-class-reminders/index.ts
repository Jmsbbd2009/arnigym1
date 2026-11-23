import webpush from 'npm:web-push@3.6.7';
import { constantTime, json, preflight, service } from '../_shared/base.ts';

Deno.serve(async(req)=>{
 const pf=preflight(req);if(pf)return pf;
 if(req.method!=='POST')return json({error:'Faqat POST so‘rovi qabul qilinadi.'},405,req);
 try{
  const secret=Deno.env.get('PUSH_REMINDER_SECRET')||'';
  if(!secret||!constantTime(req.headers.get('x-reminder-secret')||'',secret))return json({error:'Ruxsat berilmadi.'},401,req);
  const subject=Deno.env.get('VAPID_SUBJECT'),publicKey=Deno.env.get('VAPID_PUBLIC_KEY'),privateKey=Deno.env.get('VAPID_PRIVATE_KEY');
  if(!subject||!publicKey||!privateKey)return json({error:'VAPID kalitlari sozlanmagan.'},503,req);
  webpush.setVapidDetails(subject,publicKey,privateKey);
  const now=Date.now();const {data:bookings,error}=await service.from('gym_class_bookings').select('id,user_id,class_id,gym_classes!inner(id,title,starts_at,location,status)').eq('status','booked').is('reminder_sent_at',null).eq('gym_classes.status','scheduled').gte('gym_classes.starts_at',new Date(now+90*60*1000).toISOString()).lte('gym_classes.starts_at',new Date(now+150*60*1000).toISOString()).limit(200);
  if(error)throw error;
  let sent=0,marked=0;
  for(const booking of bookings||[]){
   const [{data:subscriptions},{data:klass}]=await Promise.all([
    service.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id',booking.user_id),
    service.from('gym_classes').select('title,starts_at,location').eq('id',booking.class_id).maybeSingle(),
   ]);
   let completed=true;
   for(const item of subscriptions||[]){try{await webpush.sendNotification({endpoint:item.endpoint,keys:{p256dh:item.p256dh,auth:item.auth}},JSON.stringify({title:'ArniyGym · Mashg‘ulot eslatmasi',body:`${klass?.title||'Mashg‘ulot'} 2 soat ichida boshlanadi${klass?.location?` · ${klass.location}`:''}.`,url:'/gym'}),{TTL:7200});sent++}catch(error:any){if(error?.statusCode===404||error?.statusCode===410)await service.from('push_subscriptions').delete().eq('id',item.id);else completed=false}}
   if(completed){const {error:updateError}=await service.from('gym_class_bookings').update({reminder_sent_at:new Date().toISOString()}).eq('id',booking.id).is('reminder_sent_at',null);if(!updateError)marked++}
  }
  return json({sent,bookingsMarked:marked},200,req);
 }catch(error){console.error('Class reminder dispatch failed',error);return json({error:'Mashg‘ulot eslatmalari yuborilmadi.'},500,req)}
});

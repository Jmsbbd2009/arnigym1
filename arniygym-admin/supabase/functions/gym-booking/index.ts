import webpush from 'npm:web-push@3.6.7';
import { json, preflight, requireUser, service } from '../_shared/base.ts';

const isUuid=(value:unknown)=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
Deno.serve(async(req)=>{
 const pf=preflight(req);if(pf)return pf;
 if(req.method!=='POST')return json({error:'Faqat POST so‘rovi qabul qilinadi.'},405,req);
 try{
  const {user}=await requireUser(req);
  const {action,classId}=await req.json();
  if(action!=='cancel'||!isUuid(classId))return json({error:'Yozilishni bekor qilish so‘rovi noto‘g‘ri.'},400,req);
  const {data,error}=await service.rpc('cancel_gym_class_booking',{p_user_id:user.id,p_class_id:classId});
  if(error)return json({error:error.message.includes('booking not found')?'Faol yozilish topilmadi.':'Yozilishni bekor qilib bo‘lmadi.'},409,req);
  const promoted=Array.isArray(data)?data[0]?.promoted_user_id:data?.promoted_user_id;
  let notificationSent=false;
  if(promoted){
   const subject=Deno.env.get('VAPID_SUBJECT'),publicKey=Deno.env.get('VAPID_PUBLIC_KEY'),privateKey=Deno.env.get('VAPID_PRIVATE_KEY');
   if(subject&&publicKey&&privateKey){
    webpush.setVapidDetails(subject,publicKey,privateKey);
    const [{data:subscriptions},{data:classInfo}]=await Promise.all([
     service.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id',promoted),
     service.from('gym_classes').select('title,starts_at').eq('id',classId).maybeSingle(),
    ]);
    for(const item of subscriptions||[]){try{await webpush.sendNotification({endpoint:item.endpoint,keys:{p256dh:item.p256dh,auth:item.auth}},JSON.stringify({title:'ArniyGym · Navbat yetdi',body:`${classInfo?.title||'Mashg‘ulot'} uchun joy bo‘shadi. Siz ro‘yxatga o‘tdingiz.`,url:'/gym'}),{TTL:3600});notificationSent=true}catch(error:any){if(error?.statusCode===404||error?.statusCode===410)await service.from('push_subscriptions').delete().eq('id',item.id)}}
   }
  }
  return json({ok:true,promoted:Boolean(promoted),notificationSent},200,req);
 }catch(error){console.error('Class booking cancellation failed',error);return json({error:'Mashg‘ulot yozilishini bekor qilib bo‘lmadi.'},500,req)}
});

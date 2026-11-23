import {createClient} from 'npm:@supabase/supabase-js@2';
import {json,preflight,service,hashHex} from '../_shared/base.ts';
function jwtClaims(token:string){try{return JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}catch{return {}}}
Deno.serve(async req=>{const pf=preflight(req);if(pf)return pf;try{
 const pepper=Deno.env.get('OTP_PEPPER');if(!pepper||pepper.length<32)return json({error:'Kirish xizmati sozlanmagan.'},503,req);
 const {challengeToken,code,deviceLabel=''}=await req.json();if(!/^\d{6}$/.test(String(code||'')))return json({error:'6 xonali kodni kiriting.'},400, req);
 const tokenHash=await hashHex(`${pepper}:${String(challengeToken||'')}`);const {data:challenge,error}=await service.from('otp_challenges').select('id').eq('token_hash',tokenHash).maybeSingle();if(error)throw error;if(!challenge)return json({error:'Kod noto‘g‘ri yoki muddati tugagan.'},400,req);
 const codeHash=await hashHex(`${pepper}:${challenge.id}:${code}`);const {data:consumed,error:consumeError}=await service.rpc('consume_telegram_otp',{p_token_hash:tokenHash,p_code_hash:codeHash});if(consumeError)throw consumeError;if(!consumed?.length)return json({error:'Kod noto‘g‘ri, eskirgan yoki urinishlar limiti tugagan.'},400,req);
 const {phone_e164:phone,telegram_user_id:telegramId}=consumed[0];const phoneHash=await hashHex(phone);const email=`tg-${phoneHash}@login.arniygym.invalid`;
 let {data:member,error:memberError}=await service.from('members').select('auth_user_id,display_name').eq('phone_e164',phone).single();if(memberError&&memberError.code!=='PGRST116')throw memberError;
 let userId=member?.auth_user_id;
 if(!userId){const {data:created,error:createError}=await service.auth.admin.createUser({email,password:randomPassword(),email_confirm:true,user_metadata:{phone_e164:phone,telegram_user_id:telegramId}});if(createError)throw createError;userId=created.user.id;const {error:upsertError}=await service.from('members').upsert({phone_e164:phone,telegram_user_id:telegramId,auth_user_id:userId},{onConflict:'phone_e164'});if(upsertError)throw upsertError}
 const {data:role}=await service.from('admin_roles').select('role').eq('user_id',userId).maybeSingle();await service.auth.admin.updateUserById(userId,{app_metadata:{provider:'telegram',role:role?.role||'member'}});
 const {data:link,error:linkError}=await service.auth.admin.generateLink({type:'magiclink',email});if(linkError)throw linkError;const tokenHashMagic=link.properties?.hashed_token;if(!tokenHashMagic)throw new Error('Supabase Auth magic link xeshini bermadi.');
 const anon=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});const {data:verified,error:verifyError}=await anon.auth.verifyOtp({token_hash:tokenHashMagic,type:'magiclink'});if(verifyError||!verified.session)throw verifyError||new Error('Sessiya yaratilmadi.');
 const claims=jwtClaims(verified.session.access_token);if(!claims.session_id)throw new Error('JWT session_id claim yo‘q. Supabase Auth session claims sozlamasini tekshiring.');
 const {error:deviceError}=await service.from('active_devices').upsert({user_id:userId,session_id:claims.session_id,device_label:String(deviceLabel).slice(0,120),updated_at:new Date().toISOString()},{onConflict:'user_id'});if(deviceError)throw deviceError;
 const {data:refreshed,error:refreshError}=await anon.auth.refreshSession({refresh_token:verified.session.refresh_token});const session=(!refreshError&&refreshed.session)||verified.session;
 return json({accessToken:session.access_token,refreshToken:session.refresh_token,expiresAt:session.expires_at,deviceReplaced:true}, 200, req);
}catch(e){console.error('OTP verification failed',e);return json({error:'Kirishni tasdiqlab bo‘lmadi.'},500,req)}});
function randomPassword(){return `${crypto.randomUUID()}${crypto.randomUUID()}A9!`}

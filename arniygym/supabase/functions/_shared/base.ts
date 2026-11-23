import { createClient } from 'npm:@supabase/supabase-js@2';
export const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
// Runtime secrets: Edge Function secrets (Dashboard) take priority; otherwise values stored in
// Supabase Vault under the "app:" prefix are used. Vault values are readable only by service_role
// through public.edge_runtime_secrets(), never by browsers.
const vaultSecrets:Record<string,string>=await (async()=>{try{const {data,error}=await service.rpc('edge_runtime_secrets');if(error)throw error;return (data||{}) as Record<string,string>}catch(error){console.error('Vault secrets unavailable',error);return {}}})();
const envGet=Deno.env.get.bind(Deno.env);
try{(Deno.env as any).get=(key:string)=>envGet(key)??vaultSecrets[key]}catch(error){console.error('Secret fallback disabled',error)}
const allowedOrigins=new Set([
  ...(Deno.env.get('APP_ORIGINS')||'').split(',').map(value=>value.trim()).filter(Boolean),
  Deno.env.get('APP_ORIGIN')||'',Deno.env.get('ADMIN_APP_ORIGIN')||'',
  'http://localhost:5173','http://localhost:5174','http://127.0.0.1:5173','http://127.0.0.1:5174'
].filter(Boolean));
function corsHeaders(req?:Request){
  const headers:Record<string,string>={
    'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, x-bot-timestamp, x-bot-nonce, x-bot-signature, x-signature',
    'Access-Control-Allow-Methods':'POST, GET, OPTIONS','Vary':'Origin'
  };
  const origin=req?.headers.get('Origin');
  if(origin&&allowedOrigins.has(origin))headers['Access-Control-Allow-Origin']=origin;
  return headers;
}
export function json(data:unknown,status=200,req?:Request){return new Response(JSON.stringify(data),{status,headers:{...corsHeaders(req),'Content-Type':'application/json','Cache-Control':'no-store'}})}
export function preflight(req:Request){if(req.method!=='OPTIONS')return null;const origin=req.headers.get('Origin');if(origin&&!allowedOrigins.has(origin))return new Response('origin not allowed',{status:403,headers:{'Vary':'Origin'}});return new Response(null,{status:204,headers:corsHeaders(req)})}
export function safeFailure(req:Request,error:unknown,message='So‘rovni bajarib bo‘lmadi.',status=500){console.error(error);return json({error:message},status,req)}
export async function requireUser(req:Request){
 const token=req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'');if(!token)throw new Error('Kirish talab qilinadi.');
 const client=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
 const {data,error}=await client.auth.getUser(token);if(error||!data.user)throw new Error('Sessiya yaroqsiz.');
 const claims=JSON.parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(!claims.session_id)throw new Error('Sessiya ID topilmadi.');
 const {data:device}=await service.from('active_devices').select('session_id').eq('user_id',data.user.id).maybeSingle();if(!device||device.session_id!==claims.session_id)throw new Error('Bu qurilma sessiyasi bekor qilingan. Qaytadan kiring.');
 return {user:data.user,token,client};
}
export function hashHex(data:string){return crypto.subtle.digest('SHA-256',new TextEncoder().encode(data)).then(b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join(''))}
export function randomToken(bytes=32){const a=crypto.getRandomValues(new Uint8Array(bytes));return btoa(String.fromCharCode(...a)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
export function constantTime(a:string,b:string){if(a.length!==b.length)return false;let d=0;for(let i=0;i<a.length;i++)d|=a.charCodeAt(i)^b.charCodeAt(i);return d===0}
export async function rateLimit(req:Request,key:string,limit=5,seconds=300,scope:'ip'|'global'='ip'){const ip=req.headers.get('cf-connecting-ip')?.trim()||'unknown';const ipHash=await hashHex(ip);const bucket=scope==='global'?key:`${ipHash}:${key}`;const {data,error}=await service.rpc('check_rate_limit',{p_key:bucket,p_limit:limit,p_window_seconds:seconds});if(error)throw error;return data===true}
export async function botAllowed(req:Request,endpoint:string,body:string){
 const secretName:Record<string,string>={'telegram-contact':'BOT_OTP_SECRET','bot-pending-admins':'BOT_ADMIN_SECRET','bot-pending-payments':'BOT_QUEUE_SECRET','p2p-review':'BOT_P2P_SECRET'};
 const secret=Deno.env.get(secretName[endpoint]||'');
 const timestamp=req.headers.get('x-bot-timestamp')||'',nonce=req.headers.get('x-bot-nonce')||'',signature=req.headers.get('x-bot-signature')||'';
 const stamp=Number(timestamp);if(!secret||secret.length<32||!/^\d{10,13}$/.test(timestamp)||!/^([a-f0-9]{64})$/i.test(nonce)||!Number.isFinite(stamp))return false;
 const millis=timestamp.length===13?stamp:stamp*1000;if(Math.abs(Date.now()-millis)>60_000)return false;
 const digest=await hashHex(body),message=`${timestamp}.${endpoint}.${digest}.${nonce}`;
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const raw=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(message));
 const expected=[...new Uint8Array(raw)].map(value=>value.toString(16).padStart(2,'0')).join('');
 if(!constantTime(signature.toLowerCase(),expected))return false;
 try{return await rateLimit(req,`bot-nonce:${await hashHex(nonce)}`,1,120,'global')}catch(error){console.error('Bot request replay check failed',error);return false}
}
export function otpPepper(){const value=Deno.env.get('OTP_PEPPER');if(!value||value.length<32)throw new Error('OTP_PEPPER must be configured with at least 32 random characters');return value}
export function getBearer(req:Request){return req.headers.get('Authorization')?.replace(/^Bearer\s+/i,'')||''}
export async function requireAdmin(req:Request){
 const ctx=await requireUser(req);
 const {data:role,error}=await service.from('admin_roles').select('role').eq('user_id',ctx.user.id).eq('role','admin').maybeSingle();
 if(error)throw error;
 if(!role){const denied=new Error('Admin ruxsati kerak.');(denied as any).status=403;throw denied}
 return ctx;
}
export async function auditAdmin(adminId:string,action:string,targetTable:string,targetId:string|null,fields:string[]=[]){
 const {error}=await service.from('admin_audit_log').insert({admin_user_id:adminId,action:action.slice(0,40),target_table:targetTable.slice(0,80),target_id:targetId?.slice(0,200)||null,changed_fields:fields.slice(0,20).map(value=>value.slice(0,80))});
 if(error)console.error('Audit log write failed',error);
}
export function authStatus(error:unknown){const status=(error as any)?.status;if(status===403)return 403;const message=error instanceof Error?error.message:'';return /Kirish talab|Sessiya|qurilma sessiyasi/.test(message)?401:0}

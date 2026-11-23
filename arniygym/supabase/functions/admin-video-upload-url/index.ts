import {json,preflight,service,requireUser} from '../_shared/base.ts';
const STORAGE_LIMIT=50*1024*1024;
function b64(text:string){const bytes=new TextEncoder().encode(text);let binary='';bytes.forEach(b=>binary+=String.fromCharCode(b));return btoa(binary)}
Deno.serve(async req=>{const pf=preflight(req);if(pf)return pf;try{const {user}=await requireUser(req);const {data:role}=await service.from('admin_roles').select('role').eq('user_id',user.id).maybeSingle();if(!role)return json({error:'Admin ruxsati kerak.'},403, req);const {size,title,contentType=''}=await req.json();if(!Number.isSafeInteger(size)||size<1||size>2_000_000_000)return json({error:'Video hajmi 2 GB gacha bo‘lishi kerak.'},400, req);const account=Deno.env.get('CF_ACCOUNT_ID'),apiToken=Deno.env.get('CF_STREAM_API_TOKEN');
// Fallback: without Cloudflare Stream keys, videos go to the private Supabase Storage bucket "workout-videos".
if(!account||!apiToken){
 const ext=({'video/mp4':'mp4','video/webm':'webm','video/quicktime':'mov'} as Record<string,string>)[String(contentType)];
 if(!ext)return json({error:'Faqat MP4, WebM yoki MOV video yuklash mumkin.'},400,req);
 if(size>STORAGE_LIMIT)return json({error:`Video ${Math.round(STORAGE_LIMIT/1024/1024)} MB dan katta bo‘lmasin. Videoni siqib (masalan 720p) qayta yuklang.`},413,req);
 const path=`videos/${crypto.randomUUID()}.${ext}`;
 const {data,error}=await service.storage.from('workout-videos').createSignedUploadUrl(path);
 if(error||!data)throw error||new Error('Storage upload manzili yaratilmadi.');
 return json({provider:'supabase',uid:`sb:${path}`,signedUrl:data.signedUrl,path,token:data.token,maxBytes:STORAGE_LIMIT},200,req);
}const expires=new Date(Date.now()+30*60_000).toISOString();const metadata=[`maxDurationSeconds ${b64('1800')}`,'requiresignedurls',`expiry ${b64(expires)}`,`name ${b64(String(title||'ArniyGym mashqi').slice(0,120))}`].join(',');const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/stream?direct_user=true`,{method:'POST',headers:{'Authorization':`Bearer ${apiToken}`,'Tus-Resumable':'1.0.0','Upload-Length':String(size),'Upload-Metadata':metadata}});if(!response.ok){const text=await response.text();throw new Error(`Cloudflare upload URL yaratmadi: ${text.slice(0,250)}`)}const uploadURL=response.headers.get('Location');if(!uploadURL)throw new Error('Cloudflare Tus upload manzilini bermadi.');const uid=response.headers.get('stream-media-id')||new URL(uploadURL).pathname.split('/').filter(Boolean).at(-1);if(!uid)throw new Error('Cloudflare video UID bermadi.');return json({provider:'cloudflare',uploadURL,uid,expiresAt:expires}, 200, req)}catch(e){console.error('Admin video upload URL failed',e);return json({error:'Upload manzilini olib bo‘lmadi.'},500,req)}});

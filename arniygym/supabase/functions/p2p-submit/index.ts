import { json, preflight, rateLimit, requireUser, service } from '../_shared/base.ts';

const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2,'0')).join('');
function validReceiptSignature(bytes: Uint8Array, mime: string) {
  if (mime === 'image/jpeg') return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (mime === 'image/png') return [0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((value,index)=>bytes[index]===value);
  if (mime === 'image/webp') return new TextDecoder().decode(bytes.slice(0,4)) === 'RIFF' && new TextDecoder().decode(bytes.slice(8,12)) === 'WEBP';
  if (mime === 'application/pdf') return new TextDecoder().decode(bytes.slice(0,5)) === '%PDF-';
  return false;
}
async function legalReady() {
  const {data,error}=await service.from('about_content').select('content').eq('id',1).maybeSingle();
  if(error)throw error;
  const legal=data?.content?.legal;
  const required=['operatorName','taxId','address','phone','email','phonePurpose','phoneRetention','healthPurpose','healthRetention','termsText','privacyText','refundText','renewalText'];
  return legal?.ready===true&&required.every(key=>typeof legal[key]==='string'&&legal[key].trim().length>4);
}

Deno.serve(async(req)=>{
 const pf=preflight(req);if(pf)return pf;
 if(req.method!=='POST')return json({error:'Faqat POST so‘rovi qabul qilinadi.'},405,req);
 try{
  const {user}=await requireUser(req);
  if(!await rateLimit(req,`p2p-submit:${user.id}`,3,3600,'global'))return json({error:'Chek yuborish limiti tugadi. Keyinroq qayta urinib ko‘ring.'},429,req);
  const {plan,receiptPath}=await req.json();
  if(!['monthly','yearly'].includes(plan))return json({error:'Tarif noto‘g‘ri.'},400,req);
  if(typeof receiptPath!=='string'||receiptPath.length>260||!receiptPath.startsWith(`${user.id}/`)||receiptPath.split('/').some((part:string)=>!part||part==='.'||part==='..'))return json({error:'Chek fayli hisob papkasiga yuklanmagan.'},400,req);
  if(!await legalReady())return json({error:'To‘lov huquqiy ma’lumotlar kiritilgunga qadar yopiq.'},403,req);
  const [{data:price,error:priceError},{data:file,error:fileError}]=await Promise.all([
   service.from('plan_prices').select('amount_uzs').eq('plan_key',plan).eq('active',true).maybeSingle(),
   service.storage.from('p2p-receipts').download(receiptPath),
  ]);
  if(priceError)throw priceError;
  if(fileError||!file)return json({error:'Chek fayli topilmadi. Uni qayta yuklang.'},404,req);
  if(!price||Number(price.amount_uzs)<=0)return json({error:'Tanlangan tarifning so‘m narxi sozlanmagan.'},409,req);
  if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(file.type))return json({error:'Chek JPG, PNG, WebP yoki PDF formatida bo‘lishi kerak.'},415,req);
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(bytes.length<100||bytes.length>10*1024*1024)return json({error:'Chek fayli bo‘sh yoki 10 MB dan katta.'},413,req);
  if(!validReceiptSignature(bytes,file.type))return json({error:'Yuklangan chek faylining turi tasdiqlanmadi. Rasm yoki PDF faylni qayta yuklang.'},415,req);
  const digest=hex(await crypto.subtle.digest('SHA-256',bytes));
  const {error}=await service.from('p2p_payments').insert({user_id:user.id,amount_uzs:Number(price.amount_uzs),receipt_path:receiptPath,receipt_sha256:digest,plan_key:plan});
  if(error?.code==='23505')return json({error:'Bu chek fayli avval yuborilgan.'},409,req);
  if(error)throw error;
  return json({ok:true,amountUzs:Number(price.amount_uzs)},200,req);
 }catch(error){
  console.error('P2P submission failed',error);
  return json({error:'Chekni yuborib bo‘lmadi. Faylni va hisobingizni tekshiring.'},500,req);
 }
});

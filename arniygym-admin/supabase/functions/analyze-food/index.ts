import { hashHex, json, preflight, rateLimit, requireUser, service, randomToken } from '../_shared/base.ts';

type FoodDraft = { name: string; grams: number; clarification: string };
type IdentifiedFood = { name: string; clarification_required: boolean; clarification_question: string; confidence: number };
type FoodNutrition = { name: string; grams: number; calories: number; protein_g: number; fat_g: number; carbs_g: number; confidence: number };

const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const safeConfidence = (value: unknown) => Math.max(0, Math.min(1, Number(value) || 0));
function imageInput(data: unknown, mediaType: unknown) {
  if (typeof data !== 'string' || data.length < 100 || data.length > 7_000_000) throw new Error('Rasm 5 MB dan kichik bo‘lishi kerak.');
  if (typeof mediaType !== 'string' || !imageTypes.has(mediaType)) throw new Error('JPG, PNG yoki WebP rasm yuboring.');
  return { imageBase64: data, mediaType };
}
async function hasPremium(userId: string) {
  const { data, error } = await service.from('subscriptions').select('id').eq('user_id', userId).in('status', ['active','on_trial']).gt('current_period_end', new Date().toISOString()).limit(1).maybeSingle();
  if (error) throw error;
  return !!data;
}
async function callVision(apiKey: string, prompt: string, schema: Record<string, unknown>, imageBase64: string, mediaType: string) {
  const model = Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [
        { text: prompt },
        { inlineData: { mimeType: mediaType, data: imageBase64 } },
      ] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, temperature: 0.2 },
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result?.error?.message || 'Gemini AI tahlili vaqtincha ishlamadi.');
  const text = result?.candidates?.[0]?.content?.parts?.map((part: any) => part.text || '').join('');
  if (typeof text !== 'string' || !text.trim()) throw new Error('Gemini javobini o‘qib bo‘lmadi.');
  return JSON.parse(text);
}

const identificationSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    is_food: { type: 'boolean' },
    message: { type: 'string' },
    items: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
      name: { type: 'string' }, clarification_required: { type: 'boolean' }, clarification_question: { type: 'string' }, confidence: { type: 'number' },
    }, required: ['name', 'clarification_required', 'clarification_question', 'confidence'] } },
  }, required: ['is_food', 'message', 'items'],
};
const nutritionSchema = {
  type: 'object', additionalProperties: false,
  properties: { items: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
    name: { type: 'string' }, calories: { type: 'number' }, protein_g: { type: 'number' }, fat_g: { type: 'number' }, carbs_g: { type: 'number' }, confidence: { type: 'number' },
  }, required: ['name', 'calories', 'protein_g', 'fat_g', 'carbs_g', 'confidence'] } } }, required: ['items'],
};

function tashkentToday(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tashkent',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const value=Object.fromEntries(parts.map(part=>[part.type,part.value]));return `${value.year}-${value.month}-${value.day}`}
async function reserveScan(userId: string) {
  const { data, error } = await service.rpc('consume_ai_scan', { p_user_id: userId, p_limit: 5, p_today: tashkentToday() });
  if (error) throw error;
  if (!data?.length) throw new Error('Bugungi AI tahlil limiti tugadi. Ertaga yana urinib ko‘ring.');
  return Number(data[0].scan_count);
}
async function consumeScanSession(userId:string,token:unknown){if(typeof token!=='string'||token.length<24)throw new Error('Yangi rasm tahlilini boshlang.');const tokenHash=await hashHex(token);const {data,error}=await service.from('ai_scan_sessions').update({consumed_at:new Date().toISOString()}).eq('user_id',userId).eq('token_hash',tokenHash).is('consumed_at',null).gt('expires_at',new Date().toISOString()).select('id').maybeSingle();if(error)throw error;if(!data)throw new Error('Tahlil muddati tugagan yoki bu urinish ishlatilgan. Yangi rasm tanlang.');return tokenHash}

Deno.serve(async req => {
  const pf = preflight(req); if (pf) return pf;
  let reservedScan: { userId: string; date: string } | null = null;
  let claimedScanSession: { userId: string; tokenHash: string } | null = null;
  try {
    if (req.method !== 'POST') return json({ error: 'Faqat POST so‘rovi qabul qilinadi.' }, 405, req);
    const body = await req.json();
    const action = body.action;
    if (!['identify', 'calculate'].includes(action)) return json({ error: 'So‘rov bosqichi noto‘g‘ri.' }, 400, req);
    if (body.disclosureAccepted !== true) return json({ error: 'AI tahlili va rasm yuborilishi uchun rozilik kerak.' }, 400, req);
    if (!(await rateLimit(req, action === 'identify' ? 'food-identify' : 'food-calculate', 12, 3600))) return json({ error: 'AI so‘rovlari vaqtincha cheklangan.' }, 429, req);

    const { imageBase64, mediaType } = imageInput(body.imageBase64, body.mediaType);
    const { user } = await requireUser(req);
    if (!(await hasPremium(user.id))) return json({ error: 'AI skaner faqat faol Premium obuna uchun ochiq.' }, 403, req);
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) throw new Error('GEMINI_API_KEY Supabase secret sifatida sozlanmagan.');

    if (action === 'identify') {
      const identified = await callVision(apiKey,
        'Siz o‘zbek tilidagi ovqat rasmi tahlilchisisiz. Rasmda ko‘rinib turgan yeyiladigan taomlarni alohida aniqlang (ko‘pi bilan 8 ta). Yashirin ingredientni o‘ylab topmang. Mahsulot yoki muhim ingredient aniq ko‘rinmasa clarification_required=true qilib, foydalanuvchiga bitta qisqa va aniq o‘zbekcha savol bering. Har bir porsiyaning grammi keyingi bosqichda foydalanuvchidan so‘raladi. Rasm ovqat bo‘lmasa is_food=false, items=[] va muloyim xabar qaytaring. Kaloriya hisoblamang.',
        identificationSchema, imageBase64, mediaType);
      const scanDate=tashkentToday();
      const scanCount=await reserveScan(user.id);
      reservedScan={userId:user.id,date:scanDate};
      const items: IdentifiedFood[] = Array.isArray(identified.items) ? identified.items.slice(0, 8).flatMap((item: any) => {
        if (typeof item?.name !== 'string' || !item.name.trim()) return [];
        return [{ name: item.name.trim().slice(0, 100), clarification_required: !!item.clarification_required, clarification_question: typeof item.clarification_question === 'string' ? item.clarification_question.slice(0, 200) : '', confidence: safeConfidence(item.confidence) }];
      }) : [];
      if (!identified.is_food || !items.length) return json({ items: [], message: String(identified.message || 'Taom aniqlanmadi. Yorug‘roq va yaqinroq rasm yuboring.').slice(0, 240),remaining:Math.max(0,5-scanCount),scanToken:'' }, 200, req);
      const scanToken=randomToken();
      const {error:scanError}=await service.from('ai_scan_sessions').insert({user_id:user.id,token_hash:await hashHex(scanToken),expires_at:new Date(Date.now()+10*60_000).toISOString(),disclosure_accepted:true});
      if(scanError)throw scanError;
      reservedScan=null;
      return json({ items,remaining:Math.max(0,5-scanCount),scanToken }, 200, req);
    }

    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 8) return json({ error: 'Taom mahsulotlari ro‘yxati noto‘g‘ri.' }, 400, req);
    const drafts: FoodDraft[] = body.items.map((item: any) => ({
      name: typeof item?.name === 'string' ? item.name.trim().slice(0, 100) : '',
      grams: Number(item?.grams),
      clarification: typeof item?.clarification === 'string' ? item.clarification.trim().slice(0, 240) : '',
    }));
    if (drafts.some(item => !item.name || !Number.isFinite(item.grams) || item.grams < 1 || item.grams > 10000)) return json({ error: 'Har bir taom uchun gramm miqdorini 1–10 000 oralig‘ida kiriting.' }, 400, req);

    const claimedTokenHash=await consumeScanSession(user.id,body.scanToken);
    claimedScanSession={userId:user.id,tokenHash:claimedTokenHash};
    const details = drafts.map((item, i) => `${i + 1}. ${item.name}; porsiya: ${item.grams} g; aniqlashtirish javobi: ${item.clarification || 'berilmagan'}`).join('\n');
    const calculated = await callVision(apiKey,
      `Rasm va foydalanuvchi kiritgan ma'lumotlardan har bir taom uchun ko‘rsatilgan yeyiladigan porsiyaning jami kaloriya va BJU miqdorini hisoblang. Miqdorlar grammda va aniq porsiya uchun jami bo‘lsin, 100 grammga emas. Foydalanuvchining aniqlashtirish javoblarini ingredientni tanlashda ishlating. Tasvirdagi yog‘, guruch, go‘sht, sous va pishirish usulini e'tiborga olib, realistik o‘rtacha qiymat qaytaring. Taomni aniq o‘lchab bo‘lmagani uchun natija taxmin ekanini yodda tuting. Tibbiy tashxis yoki parhez bo‘yicha xavfli maslahat bermang.\nFoydalanuvchi mahsulotlari:\n${details}`,
      nutritionSchema, imageBase64, mediaType);
    if (!Array.isArray(calculated.items) || calculated.items.length !== drafts.length) throw new Error('AI barcha taomlarni hisoblay olmadi. Rasm va gramm miqdorlarini tekshirib qayta urinib ko‘ring.');

    const nutritionItems: FoodNutrition[] = calculated.items.map((item: any, i: number) => ({
      name: drafts[i].name,
      grams: drafts[i].grams,
      calories: Math.max(0, Math.round(Number(item.calories) || 0)),
      protein_g: Math.max(0, Number((Number(item.protein_g) || 0).toFixed(1))),
      fat_g: Math.max(0, Number((Number(item.fat_g) || 0).toFixed(1))),
      carbs_g: Math.max(0, Number((Number(item.carbs_g) || 0).toFixed(1))),
      confidence: safeConfidence(item.confidence),
    }));
    const total = nutritionItems.reduce((sum, item) => ({
      calories: sum.calories + item.calories,
      protein_g: sum.protein_g + item.protein_g,
      fat_g: sum.fat_g + item.fat_g,
      carbs_g: sum.carbs_g + item.carbs_g,
    }), { calories: 0, protein_g: 0, fat_g: 0, carbs_g: 0 });
    if (total.calories > 10000) throw new Error('Jami kaloriya bazadagi ruxsat etilgan qiymatdan oshdi. Porsiya gramm miqdorini tekshiring.');
    const nutrition = {
      name: nutritionItems.map(item => item.name).join(' + ').slice(0, 100),
      calories: total.calories,
      protein_g: Number(total.protein_g.toFixed(1)),
      fat_g: Number(total.fat_g.toFixed(1)),
      carbs_g: Number(total.carbs_g.toFixed(1)),
      confidence: nutritionItems.length ? Math.min(...nutritionItems.map(item => item.confidence)) : 0,
    };
    const {data:usage,error:usageError}=await service.from('ai_usage_logs').select('scan_count').eq('user_id',user.id).eq('used_on',tashkentToday()).maybeSingle();
    if(usageError)throw usageError;
    const remaining=Math.max(0,5-Number(usage?.scan_count||0));
    const responseHash = await hashHex(JSON.stringify({ nutrition, items: nutritionItems }));
    const { error } = await service.from('calorie_logs').insert({ user_id: user.id, meal_name: nutrition.name, calories: nutrition.calories, protein_g: nutrition.protein_g, fat_g: nutrition.fat_g, carbs_g: nutrition.carbs_g, source: 'ai_scan', ai_response_hash: responseHash });
    if (error) throw error;
    claimedScanSession=null;
    return json({ nutrition, items: nutritionItems, remaining }, 200, req);
  } catch (error: any) {
    console.error(error);
    if(claimedScanSession){const {error:releaseError}=await service.from('ai_scan_sessions').update({consumed_at:null}).eq('user_id',claimedScanSession.userId).eq('token_hash',claimedScanSession.tokenHash).not('consumed_at','is',null);if(releaseError)console.error('Could not release AI scan session',releaseError);}
    if(reservedScan){const {error:refundError}=await service.rpc('release_ai_scan',{p_user_id:reservedScan.userId,p_today:reservedScan.date});if(refundError)console.error('Could not refund failed AI scan',refundError);}
    const message=String(error?.message||'');
    if(message.includes('Bugungi AI tahlil limiti'))return json({error:'Bugungi AI tahlil limiti tugadi.'},429,req);
    if(message.includes('Yangi rasm')||message.includes('Tahlil muddati'))return json({error:message},409,req);
    return json({ error: 'AI tahlili bajarilmadi. Rasmni tekshirib, keyinroq qayta urinib ko‘ring.' }, 500, req);
  }
});

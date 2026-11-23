import { constantTime, json, preflight, requireUser, service } from '../_shared/base.ts';

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
function fromB64url(value: string) { const padded = value.replaceAll('-','+').replaceAll('_','/') + '='.repeat((4 - value.length % 4) % 4); return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)); }
async function sign(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message))));
}

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'Faqat POST so‘rovi qabul qilinadi.' }, 405, req);
  try {
    const { user } = await requireUser(req);
    const { data: role } = await service.from('admin_roles').select('user_id').eq('user_id', user.id).eq('role','admin').maybeSingle();
    if (!role) return json({ error: 'Resepshn funksiyasi uchun admin ruxsati kerak.' }, 403, req);
    const secret = Deno.env.get('GYM_QR_SIGNING_SECRET') || '';
    if (secret.length < 32) return json({ error: 'QR_SIGNING_SECRET sozlanmagan.' }, 503, req);
    const { token } = await req.json();
    if (typeof token !== 'string' || token.length > 2048) return json({ error: 'QR kodi noto‘g‘ri.' }, 400, req);
    const [payloadPart, signature, extra] = token.split('.');
    if (!payloadPart || !signature || extra !== undefined || !constantTime(await sign(secret, payloadPart), signature)) return json({ error: 'QR imzosi noto‘g‘ri.' }, 401, req);
    const payload = JSON.parse(new TextDecoder().decode(fromB64url(payloadPart)));
    if (payload?.v !== 1 || typeof payload.uid !== 'string' || typeof payload.nonce !== 'string' || !Number.isInteger(payload.exp)) return json({ error: 'QR formati noto‘g‘ri.' }, 400, req);
    const checkedAt = new Date(Number(payload.exp) * 1000).toISOString();
    if (payload.exp <= Math.floor(Date.now()/1000) || payload.exp > Math.floor(Date.now()/1000) + 120) return json({ error: 'QR kodi muddati tugagan. Yangisini oching.' }, 410, req);
    const { data, error } = await service.rpc('record_membership_checkin', { p_user_id: payload.uid, p_nonce: payload.nonce, p_expires_at: checkedAt, p_scanned_by: user.id });
    if (error) return json({ error: error.message.includes('membership inactive') ? 'A’zolik faol emas yoki muzlatilgan.' : error.message.includes('duplicate key') ? 'Bu QR kodi avval ishlatilgan.' : 'Kirishni qayd etib bo‘lmadi.' }, 409, req);
    const { data: member } = await service.from('members').select('display_name,phone_e164').eq('auth_user_id', payload.uid).maybeSingle();
    return json({ ok: true, checkedAt: data, member: { name: member?.display_name || 'A’zo', phone: member?.phone_e164 || '' } }, 200, req);
  } catch (error) {
    console.error('Membership check-in failed', error);
    return json({ error: 'QR kodini tekshirib bo‘lmadi.' }, 500, req);
  }
});

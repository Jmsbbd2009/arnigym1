import { json, preflight, requireUser, service } from '../_shared/base.ts';

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','');
async function sign(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(message))));
}

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'Faqat POST so‘rovi qabul qilinadi.' }, 405, req);
  try {
    const { user } = await requireUser(req);
    const secret = Deno.env.get('GYM_QR_SIGNING_SECRET') || '';
    if (secret.length < 32) return json({ error: 'QR_SIGNING_SECRET kamida 32 tasodifiy belgidan sozlanishi kerak.' }, 503, req);
    const now = new Date();
    const [{ data: subs, error: subError }, { data: freezes, error: freezeError }] = await Promise.all([
      service.from('subscriptions').select('status,current_period_end').eq('user_id', user.id).in('status', ['active','on_trial','cancelled']).gt('current_period_end', now.toISOString()).order('current_period_end', { ascending: false }).limit(1),
      service.from('membership_freeze_requests').select('id').eq('user_id', user.id).eq('status','approved').lte('freeze_started_at', now.toISOString()).gt('freeze_until', now.toISOString()).limit(1),
    ]);
    if (subError || freezeError) throw subError || freezeError;
    if (!subs?.length || freezes?.length) return json({ error: 'Faol a’zolik yo‘q yoki a’zolik muzlatilgan.' }, 403, req);
    const expiresAt = Math.floor(Date.now() / 1000) + 45;
    const payload = b64url(enc.encode(JSON.stringify({ v: 1, uid: user.id, nonce: crypto.randomUUID(), exp: expiresAt })));
    const token = `${payload}.${await sign(secret, payload)}`;
    return json({ token, expiresAt: new Date(expiresAt * 1000).toISOString(), validForSeconds: 45 }, 200, req);
  } catch (error) {
    console.error('Membership ticket request failed', error);
    return json({ error: 'A’zolik QR kodi yaratilmadi.' }, 500, req);
  }
});

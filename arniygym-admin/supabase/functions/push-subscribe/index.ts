// Stores or removes the caller's own Web Push subscription. Requires an explicit consent flag
// sent only after the browser permission prompt was accepted.
import { authStatus, json, preflight, rateLimit, requireUser, service } from '../_shared/base.ts';

const validKey = (value: unknown, max: number) => typeof value === 'string' && value.length > 0 && value.length <= max && /^[A-Za-z0-9_-]+=*$/.test(value);
function validEndpoint(value: unknown) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'Faqat POST so‘rovi qabul qilinadi.' }, 405, req);
  try {
    const { user } = await requireUser(req);
    if (!await rateLimit(req, `push-subscribe:${user.id}`, 20, 3600, 'global')) return json({ error: 'Juda ko‘p urinish. Keyinroq qayta urinib ko‘ring.' }, 429, req);
    const body = await req.json().catch(() => ({}));
    const subscription = body?.subscription;
    if (body?.action === 'unsubscribe') {
      if (!validEndpoint(body?.endpoint)) return json({ error: 'Push manzili noto‘g‘ri.' }, 400, req);
      const { error } = await service.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', body.endpoint);
      if (error) throw error;
      return json({ ok: true }, 200, req);
    }
    if (body?.consent !== true) return json({ error: 'Bildirishnoma uchun aniq rozilik kerak.' }, 400, req);
    if (!validEndpoint(subscription?.endpoint) || !validKey(subscription?.keys?.p256dh, 256) || !validKey(subscription?.keys?.auth, 128))
      return json({ error: 'Push obunasi noto‘g‘ri.' }, 400, req);
    const stamp = new Date().toISOString();
    const { error } = await service.from('push_subscriptions').upsert({
      user_id: user.id, endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth,
      user_agent: (req.headers.get('user-agent') || '').slice(0, 300), locale: body?.locale === 'ru' ? 'ru' : 'uz',
      consented_at: stamp, failure_count: 0, updated_at: stamp,
    }, { onConflict: 'endpoint' });
    if (error) throw error;
    return json({ ok: true }, 200, req);
  } catch (error) {
    const status = authStatus(error);
    if (status) return json({ error: error instanceof Error ? error.message : 'Ruxsat berilmadi.' }, status, req);
    console.error('Push subscription failed', error);
    return json({ error: 'Bildirishnoma yoqilmadi.' }, 500, req);
  }
});

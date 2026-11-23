// Admin-only Web Push for a saved, published news item. Public news → every consenting device;
// members-only news → only devices of users whose subscription is active on the server.
import webpush from 'npm:web-push@3.6.7';
import { auditAdmin, authStatus, json, preflight, rateLimit, requireAdmin, service } from '../_shared/base.ts';
import { excerpt } from '../_shared/news.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Target = { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; locale: 'uz' | 'ru' };

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'Faqat POST so‘rovi qabul qilinadi.' }, 405, req);
  let logId: number | null = null;
  try {
    const { user } = await requireAdmin(req);
    const { news_id: newsId, force } = await req.json().catch(() => ({}));
    if (typeof newsId !== 'string' || !UUID.test(newsId)) return json({ error: 'Yangilik ID noto‘g‘ri.' }, 400, req);
    if (!await rateLimit(req, `news-push:${user.id}`, 10, 3600, 'global')) return json({ error: 'Push yuborish limiti tugadi (soatiga 10 ta).' }, 429, req);

    const { data: news, error: newsError } = await service.from('gym_news')
      .select('id,title,title_ru,body,body_ru,published,publish_at,expires_at,is_members_only').eq('id', newsId).maybeSingle();
    if (newsError) throw newsError;
    if (!news) return json({ error: 'Yangilik topilmadi.' }, 404, req);
    const now = Date.now();
    if (!news.published || (news.publish_at && Date.parse(news.publish_at) > now) || (news.expires_at && Date.parse(news.expires_at) <= now))
      return json({ error: 'Push faqat saqlangan va e’lon qilingan yangilik uchun yuboriladi.' }, 409, req);

    const { data: prior } = await service.from('news_push_log').select('id,status,created_at').eq('news_id', newsId)
      .in('status', ['sending', 'sent', 'partial']).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (prior && !force) return json({ error: 'Bu yangilik uchun push avval yuborilgan.', already_sent: true }, 409, req);

    const audience = news.is_members_only ? 'members' : 'public';
    const subject = Deno.env.get('VAPID_SUBJECT') || '', publicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '', privateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
    if (!subject || !publicKey || !privateKey) {
      await service.from('news_push_log').insert({ news_id: newsId, admin_user_id: user.id, audience, status: 'failed', error: 'VAPID secrets are not configured', finished_at: new Date().toISOString() });
      return json({ error: 'Push sozlanmagan: VAPID_SUBJECT, VAPID_PUBLIC_KEY va VAPID_PRIVATE_KEY Edge Function secrets’ga kiritilmagan. Yangilik saqlangan.' }, 503, req);
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const { data: targets, error: targetError } = await service.rpc('news_push_targets', { p_members_only: news.is_members_only });
    if (targetError) throw targetError;
    const list = (targets || []) as Target[];
    const { data: log, error: logError } = await service.from('news_push_log')
      .insert({ news_id: newsId, admin_user_id: user.id, audience, status: list.length ? 'sending' : 'skipped', targeted: list.length, finished_at: list.length ? null : new Date().toISOString() })
      .select('id').single();
    if (logError) throw logError;
    logId = log.id;
    if (!list.length) return json({ status: 'skipped', audience, targeted: 0, sent: 0, failed: 0, removed: 0 }, 200, req);

    const payload = (locale: 'uz' | 'ru') => JSON.stringify({
      title: (locale === 'ru' && news.title_ru?.trim()) || news.title,
      body: excerpt((locale === 'ru' && news.body_ru?.trim()) || news.body),
      url: `/news/${news.id}`, tag: `news-${news.id}`, news_id: news.id,
    });
    let sent = 0, failed = 0, removed = 0;
    const succeeded: string[] = [], broken: string[] = [], gone: string[] = [];
    for (let index = 0; index < list.length; index += 50) {
      const batch = list.slice(index, index + 50);
      const results = await Promise.allSettled(batch.map(target => webpush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        payload(target.locale), { TTL: 86400, urgency: 'normal', topic: `news${news.id.replaceAll('-', '').slice(0, 24)}` })));
      results.forEach((result, position) => {
        const target = batch[position];
        if (result.status === 'fulfilled') { sent++; succeeded.push(target.id); return; }
        const code = (result.reason as any)?.statusCode;
        if (code === 404 || code === 410) { removed++; gone.push(target.id); } else { failed++; broken.push(target.id); }
      });
    }
    const stamp = new Date().toISOString();
    if (succeeded.length) await service.from('push_subscriptions').update({ failure_count: 0, last_success_at: stamp }).in('id', succeeded);
    if (gone.length) await service.from('push_subscriptions').delete().in('id', gone);
    for (const id of broken) {
      const { data: row } = await service.from('push_subscriptions').select('failure_count').eq('id', id).maybeSingle();
      if (row) await service.from('push_subscriptions').update({ failure_count: Math.min(32767, Number(row.failure_count || 0) + 1) }).eq('id', id);
    }
    const status = sent === 0 ? 'failed' : failed ? 'partial' : 'sent';
    await service.from('news_push_log').update({ status, sent, failed, removed, finished_at: stamp }).eq('id', logId);
    await auditAdmin(user.id, 'PUSH', 'gym_news', newsId, [`audience:${audience}`, `sent:${sent}`, `failed:${failed}`, `removed:${removed}`]);
    return json({ status, audience, targeted: list.length, sent, failed, removed }, 200, req);
  } catch (error) {
    if (logId) await service.from('news_push_log').update({ status: 'failed', error: 'internal error', finished_at: new Date().toISOString() }).eq('id', logId);
    const status = authStatus(error);
    if (status) return json({ error: error instanceof Error ? error.message : 'Ruxsat berilmadi.' }, status, req);
    console.error('news-push failed', error);
    return json({ error: 'Push yuborilmadi. Yangilik saqlangan; keyinroq qayta urinib ko‘ring.' }, 500, req);
  }
});

import { json, preflight, requireUser, service } from '../_shared/base.ts';

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  try {
    const { user } = await requireUser(req);
    const { subscriptionId } = await req.json();
    if (typeof subscriptionId !== 'string' || !/^\d{1,30}$/.test(subscriptionId)) return json({ error: 'Obuna identifikatori noto‘g‘ri.' }, 400, req);
    const { data: row, error } = await service.from('subscriptions').select('id,status,current_period_end,provider_subscription_id').eq('user_id', user.id).eq('source', 'lemon_squeezy').eq('provider_subscription_id', subscriptionId).maybeSingle();
    if (error) throw error;
    if (!row || !['active', 'on_trial'].includes(row.status) || !row.current_period_end || Date.parse(row.current_period_end) <= Date.now()) return json({ error: 'Bekor qilinadigan faol obuna topilmadi.' }, 404, req);
    const apiKey = Deno.env.get('LEMONSQUEEZY_API_KEY'); if (!apiKey) throw new Error('API key is missing');
    const response = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${subscriptionId}`, { method: 'PATCH', headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' }, body: JSON.stringify({ data: { type: 'subscriptions', id: subscriptionId, attributes: { cancelled: true } } }) });
    if (!response.ok) { console.error('Lemon Squeezy cancellation request failed', response.status); return json({ error: 'To‘lov tizimi obunani bekor qila olmadi.' }, 502, req); }
    const result = await response.json();
    return json({ ok: true, endsAt: result.data?.attributes?.ends_at || row.current_period_end }, 200, req);
  } catch (error) { console.error(error); return json({ error: 'Obunani bekor qilib bo‘lmadi.' }, 500, req); }
});

import { json, preflight, service, constantTime, hashHex } from '../_shared/base.ts';

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  try {
    const raw = await req.text();
    const signature = req.headers.get('x-signature') || '';
    const secret = Deno.env.get('LEMONSQUEEZY_WEBHOOK_SECRET') || '';
    if (!secret || !/^[a-f0-9]{64}$/i.test(signature) || !constantTime(await hmacHex(secret, raw), signature.toLowerCase())) return json({ error: 'Imzo noto‘g‘ri.' }, 401, req);
    const body = JSON.parse(raw);
    const event = String(body.meta?.event_name || req.headers.get('x-event-name') || 'unknown');
    const eventId = String(body.meta?.event_id || await hashHex(raw));
    const attributes = body.data?.attributes || {};
    const custom = body.meta?.custom_data || attributes.custom_data || {};
    const relationshipId = body.data?.relationships?.subscription?.data?.id;
    let providerId = String(body.data?.type === 'subscriptions' ? body.data.id : relationshipId || '');
    let userId = typeof custom.user_id === 'string' ? custom.user_id : null;
    let planKey = custom.plan_key === 'yearly' ? 'yearly' : 'monthly';
    if (!userId && providerId) {
      const { data: current } = await service.from('subscriptions').select('user_id,plan_key').eq('provider_subscription_id', providerId).maybeSingle();
      userId = current?.user_id || null;
      if (current?.plan_key) planKey = current.plan_key;
    }
    const orderReference = String(event === 'order_refunded' ? body.data?.id || '' : attributes.order_id || '');
    if (event === 'order_refunded' && orderReference && (!userId || !providerId)) {
      const { data: payment } = await service.from('payment_orders')
        .select('user_id,provider_subscription_id,plan_key')
        .eq('provider', 'lemon_squeezy')
        .eq('provider_order_reference', orderReference)
        .limit(1)
        .maybeSingle();
      userId ||= payment?.user_id || null;
      if (payment?.provider_subscription_id) providerId = String(payment.provider_subscription_id);
      if (payment?.plan_key) planKey = payment.plan_key;
    }
    const allowed = ['active', 'on_trial', 'paused', 'cancelled', 'expired', 'past_due', 'unpaid'];
    let state = allowed.includes(attributes.status) ? String(attributes.status) : null;
    if (state === 'unpaid') state = 'past_due';
    if (event === 'subscription_payment_success' || event === 'subscription_payment_recovered') state = 'active';
    if (event === 'subscription_payment_refunded' || event === 'order_refunded') state = 'refunded';
    if (event === 'subscription_payment_failed') state = 'past_due';
    const supported = event.startsWith('subscription_') || event === 'order_refunded';
    const changedAt = attributes.updated_at || attributes.created_at || body.meta?.created_at;
    const timestamp = changedAt ? new Date(changedAt).toISOString() : null;
    const endValue = attributes.renews_at || attributes.ends_at || attributes.trial_ends_at || null;
    const periodEnd = endValue ? new Date(endValue).toISOString() : null;
    const { data: result, error } = await service.rpc('apply_lemonsqueezy_event', {
      p_event_id: eventId,
      p_event_name: event,
      p_provider_subscription_id: providerId || null,
      p_user_id: userId,
      p_plan_key: planKey,
      p_status: supported ? state : null,
      p_period_end: periodEnd,
      p_event_updated_at: timestamp,
    });
    if (error) throw error;
    const applied = String(result || 'ignored');
    const isRefund = event === 'subscription_payment_refunded' || event === 'order_refunded';
    const isPaid = event === 'subscription_payment_success' || event === 'subscription_payment_recovered';
    if (isRefund || isPaid) {
      // Keep invoice accounting retryable even when subscription state says duplicate/stale.
      const { error: paymentError } = await service.rpc('record_lemonsqueezy_payment', {
        p_event_id: eventId,
        p_invoice_id: String(body.data?.id || ''),
        p_order_id: orderReference,
        p_subscription_id: providerId,
        p_user_id: userId,
        p_plan_key: planKey,
        p_status: isRefund ? 'refunded' : 'paid',
        p_total_usd: Number.isFinite(Number(attributes.total_usd)) ? Number(attributes.total_usd) / 100 : null,
        p_refunded_usd: Number.isFinite(Number(attributes.refunded_amount_usd)) ? Number(attributes.refunded_amount_usd) / 100 : null,
        p_refund_all: event === 'order_refunded',
      });
      if (paymentError) throw paymentError;
    }
    return json({ ok: true, event, result: applied }, 200, req);
  } catch (error) {
    console.error('Lemon Squeezy webhook rejected', error);
    return json({ error: 'Webhook hodisasi qabul qilinmadi.' }, 400, req);
  }
});

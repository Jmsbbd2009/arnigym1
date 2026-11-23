import { constantTime, json, preflight, service } from '../_shared/base.ts';

const hex = (buffer: ArrayBuffer) => [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, '0')).join('');
async function signature(secret: string, body: Record<string, unknown>) {
  const values = Object.entries(body)
    .filter(([key, value]) => key !== 'signature' && key !== 'response_signature_string' && value !== null && value !== undefined && String(value) !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, value]) => String(value));
  return hex(await crypto.subtle.digest('SHA-1', new TextEncoder().encode([secret, ...values].join('|'))));
}

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, req);
  try {
    const secret = Deno.env.get('PAYME_SECRET_KEY') || '';
    const merchantId = Deno.env.get('PAYME_MERCHANT_ID') || '';
    if (!secret || !merchantId) return json({ error: 'Payme merchant is not configured.' }, 503, req);
    const body = await req.json();
    const response = (body?.response && typeof body.response === 'object' ? body.response : body) as Record<string, unknown>;
    const received = String(response.signature || '').toLowerCase();
    if (!/^[a-f0-9]{40}$/.test(received) || !constantTime(await signature(secret, response), received)) return json({ error: 'Invalid signature.' }, 401, req);
    if (String(response.merchant_id) !== merchantId || response.currency !== 'UZS') return json({ error: 'Merchant or currency mismatch.' }, 400, req);
    const orderId = String(response.order_id || '');
    const paymentId = String(response.payment_id || '');
    const orderStatus = String(response.order_status || '');
    const amount = Number(response.amount);
    if (!/^ag-[0-9a-f-]{36}$/i.test(orderId) || !/^\d{1,30}$/.test(paymentId) || !Number.isSafeInteger(amount) || amount <= 0) return json({ error: 'Invalid payment callback fields.' }, 400, req);
    if (response.response_status !== 'success' && !['approved','declined','expired','reversed','refunded'].includes(orderStatus)) return json({ ok: true, result: 'ignored' }, 200, req);
    const { data, error } = await service.rpc('apply_payme_payment', {
      p_order_id: orderId,
      p_payment_id: paymentId,
      p_order_status: orderStatus,
      p_amount_tiyin: amount,
    });
    if (error) {
      console.error('Payme callback validation failed', error.message);
      return json({ error: 'Payment order could not be applied.' }, 409, req);
    }
    return json({ ok: true, result: data }, 200, req);
  } catch (error) {
    console.error('Payme callback failed', error);
    return json({ error: 'Payment callback was rejected.' }, 400, req);
  }
});

import { json, preflight, requireUser, service, rateLimit } from '../_shared/base.ts';
import type { PaymentCheckoutInput, PaymentProviderAdapter, PaymentProviderName } from '../_shared/payment_provider.ts';

const lsHeaders = (apiKey: string) => ({ Authorization: `Bearer ${apiKey}`, Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' });
const encoder = new TextEncoder();
const toHex = (value: ArrayBuffer) => [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, '0')).join('');

async function sha1Signature(secret: string, values: Record<string, string | number>) {
  const canonical = [secret, ...Object.entries(values).filter(([, value]) => String(value) !== '').sort(([a], [b]) => a.localeCompare(b)).map(([, value]) => String(value))].join('|');
  return toHex(await crypto.subtle.digest('SHA-1', encoder.encode(canonical)));
}

async function legalReady() {
  const { data, error } = await service.from('about_content').select('content').eq('id', 1).maybeSingle();
  if (error) throw error;
  const legal = data?.content?.legal;
  const required = ['operatorName', 'taxId', 'address', 'phone', 'email', 'phonePurpose', 'phoneRetention', 'healthPurpose', 'healthRetention', 'termsText', 'privacyText', 'refundText', 'renewalText'];
  return legal?.ready === true && required.every((key) => typeof legal[key] === 'string' && legal[key].trim().length > 4);
}

const paymeAdapter: PaymentProviderAdapter = {
  name: 'payme',
  async createCheckout(input: PaymentCheckoutInput) {
    const merchantId = Deno.env.get('PAYME_MERCHANT_ID') || '';
    const secret = Deno.env.get('PAYME_SECRET_KEY') || '';
    const appOrigin = Deno.env.get('APP_ORIGIN') || '';
    const apiUrl = Deno.env.get('PAYME_CHECKOUT_URL') || 'https://pay.payme.uz/api/checkout/url';
    if (!/^\d{1,12}$/.test(merchantId) || secret.length < 12) throw new Error('PAYME_MERCHANT_ID va PAYME_SECRET_KEY merchant kabinetida sozlanishi kerak.');
    let apiHost = '';
    try { const parsed = new URL(apiUrl); apiHost = parsed.hostname.toLowerCase(); } catch { /* rejected below */ }
    const validApiHost = apiHost === 'pay.payme.uz' || apiHost === 'sandbox.pay.flitt.dev';
    if (!/^https:\/\//.test(appOrigin) || !validApiHost || !apiUrl.startsWith('https://')) throw new Error('APP_ORIGIN yoki Payme checkout manzili xavfsiz HTTPS bilan sozlanmagan.');
    const amount = Math.round(input.amountUzs * 100);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > 999_999_999_999) throw new Error('Payme uchun tarif summasi noto‘g‘ri.');
    const providerOrderId = `ag-${crypto.randomUUID()}`;
    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/payme-callback`;
    const request: Record<string, string | number> = {
      amount, currency: 'UZS', merchant_id: Number(merchantId), order_desc: `ArniyGym ${input.planKey === 'yearly' ? 'yillik' : 'oylik'} a’zolik`,
      order_id: providerOrderId, response_url: `${appOrigin}/plans?payment=complete`, server_callback_url: callbackUrl,
    };
    request.signature = await sha1Signature(secret, request);
    const { error: insertError } = await service.from('payment_orders').insert({
      user_id: input.userId, provider: 'payme', provider_order_id: providerOrderId, plan_key: input.planKey,
      amount_uzs: input.amountUzs, currency: 'UZS', status: 'pending',
    });
    if (insertError) throw insertError;
    let response: Response;
    try {
      response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request }), signal: AbortSignal.timeout(12_000) });
    } catch (error) {
      await service.from('payment_orders').update({ status: 'failed', error_code: 'provider_unreachable', updated_at: new Date().toISOString() }).eq('provider_order_id', providerOrderId);
      throw error;
    }
    const result = await response.json().catch(() => ({}));
    const checkoutUrl = result?.response?.checkout_url;
    let checkoutHost = '';
    try { checkoutHost = new URL(String(checkoutUrl || '')).hostname.toLowerCase(); } catch { /* rejected below */ }
    const validCheckoutHost = checkoutHost === 'pay.payme.uz' || checkoutHost === 'sandbox.pay.flitt.dev';
    if (!response.ok || result?.response?.response_status !== 'success' || typeof checkoutUrl !== 'string' || !validCheckoutHost) {
      await service.from('payment_orders').update({ status: 'failed', error_code: 'checkout_rejected', updated_at: new Date().toISOString() }).eq('provider_order_id', providerOrderId);
      console.error('Payme checkout rejected', response.status, result?.response?.error_code || 'unknown');
      throw new Error('Payme to‘lov oynasi yaratilmadi. Merchant ID, kalit va tarif sozlamalarini tekshiring.');
    }
    return { provider: 'payme' as const, checkoutUrl };
  },
};

const lemonAdapter: PaymentProviderAdapter = {
  name: 'lemon_squeezy',
  async createCheckout(input: PaymentCheckoutInput) {
    const apiKey = Deno.env.get('LEMONSQUEEZY_API_KEY') || '';
    const storeId = Deno.env.get('LEMONSQUEEZY_STORE_ID') || '';
    const origin = Deno.env.get('APP_ORIGIN') || '';
    if (!apiKey || !/^\d{1,30}$/.test(storeId)) throw new Error('Lemon Squeezy API kaliti va store ID sozlanmagan.');
    if (!/^https:\/\//.test(origin)) throw new Error('APP_ORIGIN HTTPS manzili sozlanmagan.');
    if (!/^\d{1,30}$/.test(input.lemonVariantId) || input.amountUsd <= 0) throw new Error('Lemon Squeezy tarifi sozlanmagan.');
    const [variantResponse, storeResponse] = await Promise.all([
      fetch(`https://api.lemonsqueezy.com/v1/variants/${input.lemonVariantId}`, { headers: lsHeaders(apiKey) }),
      fetch(`https://api.lemonsqueezy.com/v1/stores/${storeId}`, { headers: lsHeaders(apiKey) }),
    ]);
    if (!variantResponse.ok || !storeResponse.ok) throw new Error('Tarif Lemon Squeezy’da tekshirilmadi.');
    const [variant, store] = await Promise.all([variantResponse.json(), storeResponse.json()]);
    const actual = variant.data?.attributes || {};
    const productId = String(actual.product_id || '');
    const productResponse = productId ? await fetch(`https://api.lemonsqueezy.com/v1/products/${productId}`, { headers: lsHeaders(apiKey) }) : null;
    if (!productResponse?.ok) throw new Error('Lemon Squeezy mahsuloti topilmadi.');
    const product = await productResponse.json();
    const interval = input.planKey === 'yearly' ? 'year' : 'month';
    if (String(variant.data?.id) !== input.lemonVariantId || product.data?.attributes?.store_id !== Number(storeId) || !actual.is_subscription || actual.pay_what_you_want || actual.price !== Math.round(input.amountUsd * 100) || String(actual.interval) !== interval || Number(actual.interval_count) !== 1 || store.data?.attributes?.currency !== 'USD') {
      throw new Error('Saytdagi tarif va Lemon Squeezy varianti mos emas.');
    }
    const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST', headers: lsHeaders(apiKey),
      body: JSON.stringify({ data: { type: 'checkouts', attributes: { checkout_options: { embed: true }, checkout_data: { email: input.userEmail, custom: { user_id: input.userId, plan_key: input.planKey } }, product_options: { enabled_variants: [Number(input.lemonVariantId)], redirect_url: `${origin}/plans?payment=success` } }, relationships: { store: { data: { type: 'stores', id: storeId } }, variant: { data: { type: 'variants', id: input.lemonVariantId } } } } }),
    });
    const checkout = await response.json().catch(() => ({}));
    const checkoutUrl = checkout.data?.attributes?.url;
    if (!response.ok || typeof checkoutUrl !== 'string' || !checkoutUrl.startsWith('https://')) throw new Error('Lemon Squeezy checkout yaratilmagan.');
    return { provider: 'lemon_squeezy' as const, checkoutUrl };
  },
};

const providers: Record<PaymentProviderName, PaymentProviderAdapter> = { payme: paymeAdapter, lemon_squeezy: lemonAdapter };

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'Faqat POST so‘rovi qabul qilinadi.' }, 405, req);
  try {
    const { user } = await requireUser(req);
    if (!await rateLimit(req, `checkout:${user.id}`, 4, 900, 'global')) return json({ error: 'Ko‘p checkout so‘rovi yuborildi. Birozdan keyin urinib ko‘ring.' }, 429, req);
    const { plan } = await req.json();
    if (plan !== 'monthly' && plan !== 'yearly') return json({ error: 'Tarif noto‘g‘ri.' }, 400, req);
    if (!await legalReady()) return json({ error: 'To‘lov huquqiy ma’lumotlar to‘ldirilgunga qadar yopiq.' }, 403, req);
    const providerName = Deno.env.get('PAYMENT_PROVIDER') || 'payme';
    if (!(providerName in providers)) return json({ error: 'PAYMENT_PROVIDER faqat payme yoki lemon_squeezy bo‘lishi mumkin.' }, 503, req);
    const { data: price, error } = await service.from('plan_prices').select('amount_usd,amount_uzs,lemon_variant_id').eq('plan_key', plan).eq('active', true).maybeSingle();
    if (error) throw error;
    const configuredPrice = providerName === 'payme' ? Number(price?.amount_uzs) > 0 : Number(price?.amount_usd) > 0;
    if (!price || !configuredPrice) return json({ error: `Tanlangan ${providerName === 'payme' ? 'Payme (UZS)' : 'Lemon Squeezy (USD)'} tarif narxini admin sozlashi kerak.` }, 409, req);
    const adapter = providers[providerName as PaymentProviderName];
    const checkout = await adapter.createCheckout({ userId: user.id, userEmail: user.email || '', planKey: plan, amountUzs: Number(price.amount_uzs), amountUsd: Number(price.amount_usd), lemonVariantId: String(price.lemon_variant_id || '') });
    return json(checkout, 200, req);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const status = /sozlanmagan|kerak\./i.test(message) ? 503 : 500;
    console.error('Payment checkout failed', message || 'unknown error');
    return json({ error: message || 'To‘lov oynasi ochilmadi.' }, status, req);
  }
});

import { json, preflight, service, requireUser } from '../_shared/base.ts';

const lsHeaders = (apiKey: string) => ({ Authorization: `Bearer ${apiKey}`, Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' });

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  try {
    const { user } = await requireUser(req);
    const { plan } = await req.json();
    if (!['monthly', 'yearly'].includes(plan)) return json({ error: 'Tarif noto‘g‘ri.' }, 400, req);
    const { data: about, error: aboutError } = await service.from('about_content').select('content').eq('id', 1).maybeSingle();
    if (aboutError) throw aboutError;
    const legal = about?.content?.legal;
    const required = ['operatorName', 'taxId', 'address', 'phone', 'email', 'phonePurpose', 'phoneRetention', 'healthPurpose', 'healthRetention', 'termsText', 'privacyText', 'refundText', 'renewalText'];
    if (legal?.ready !== true || !required.every((key) => typeof legal?.[key] === 'string' && legal[key].trim().length > 4)) return json({ error: 'To‘lovlar operator va huquqiy ma’lumotlar kiritilgunga qadar yopiq.' }, 403, req);
    const { data: price, error } = await service.from('plan_prices').select('amount_usd,lemon_variant_id').eq('plan_key', plan).eq('active', true).single();
    if (error || !price || Number(price.amount_usd) <= 0 || !/^\d{1,30}$/.test(String(price.lemon_variant_id))) return json({ error: 'Bu tarif to‘lovga sozlanmagan.' }, 409, req);
    const apiKey = Deno.env.get('LEMONSQUEEZY_API_KEY'), storeId = Deno.env.get('LEMONSQUEEZY_STORE_ID');
    if (!apiKey || !storeId) return json({ error: 'To‘lov xizmati sozlanmagan.' }, 503, req);
    const [variantResponse, storeResponse] = await Promise.all([
      fetch(`https://api.lemonsqueezy.com/v1/variants/${price.lemon_variant_id}`, { headers: lsHeaders(apiKey) }),
      fetch(`https://api.lemonsqueezy.com/v1/stores/${storeId}`, { headers: lsHeaders(apiKey) }),
    ]);
    if (!variantResponse.ok || !storeResponse.ok) return json({ error: 'To‘lov tarifi Lemon Squeezy’da tekshirilmadi.' }, 502, req);
    const [variant, store] = await Promise.all([variantResponse.json(), storeResponse.json()]);
    const actual = variant.data?.attributes || {}, storeData = store.data?.attributes || {};
    const productId = String(actual.product_id || '');
    const productResponse = productId ? await fetch(`https://api.lemonsqueezy.com/v1/products/${productId}`, { headers: lsHeaders(apiKey) }) : null;
    if (!productResponse?.ok) return json({ error: 'To‘lov tarifi store bilan mos emas.' }, 409, req);
    const product = await productResponse.json();
    const expectedInterval = plan === 'yearly' ? 'year' : 'month';
    if (String(variant.data?.id) !== String(price.lemon_variant_id) || product.data?.attributes?.store_id !== Number(storeId) || !actual.is_subscription || actual.pay_what_you_want || actual.price !== Math.round(Number(price.amount_usd) * 100) || String(actual.interval) !== expectedInterval || Number(actual.interval_count) !== 1 || String(store.data?.id) !== String(storeId) || storeData.currency !== 'USD') {
      return json({ error: 'Saytdagi tarif va Lemon Squeezy varianti mos emas. Sotuv admin tomonidan vaqtincha yopildi.' }, 409, req);
    }
    const origin = Deno.env.get('APP_ORIGIN');
    if (!origin || !/^https:\/\//.test(origin)) return json({ error: 'Sayt domeni sozlanmagan.' }, 503, req);
    const response = await fetch('https://api.lemonsqueezy.com/v1/checkouts', {
      method: 'POST', headers: lsHeaders(apiKey),
      body: JSON.stringify({ data: { type: 'checkouts', attributes: { checkout_options: { embed: true }, checkout_data: { email: user.email, custom: { user_id: user.id, plan_key: plan } }, product_options: { enabled_variants: [Number(price.lemon_variant_id)], redirect_url: `${origin}/plans?payment=success` } }, relationships: { store: { data: { type: 'stores', id: String(storeId) } }, variant: { data: { type: 'variants', id: String(price.lemon_variant_id) } } } } }),
    });
    const result = await response.json();
    if (!response.ok || !result.data?.attributes?.url) { console.error('Lemon Squeezy checkout rejected', response.status); return json({ error: 'To‘lov oynasi yaratilmadi.' }, 502, req); }
    return json({ checkoutUrl: result.data.attributes.url }, 200, req);
  } catch (error) { console.error('Checkout request failed', error); return json({ error: 'Checkout ochilmadi.' }, 500, req); }
});

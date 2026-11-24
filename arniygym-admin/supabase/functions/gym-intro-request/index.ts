import { json, preflight, rateLimit, service } from '../_shared/base.ts';

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'Faqat POST so‘rovi qabul qilinadi.' }, 405, req);
  try {
    if (!await rateLimit(req, 'gym-intro-request', 5, 3600)) return json({ error: 'Bir soatda ko‘p ariza yuborildi. Keyinroq urinib ko‘ring.' }, 429, req);
    const body = await req.json();
    const fullName = String(body.fullName || '').trim().replace(/\s+/g,' ');
    const phone = String(body.phone || '').replace(/[\s()-]/g,'');
    const note = String(body.note || '').trim().slice(0,500);
    if (body.consent !== true) return json({ error: 'Ma’lumotlarni qayta ishlashga rozilik kerak.' }, 400, req);
    if (fullName.length < 2 || fullName.length > 120 || !/^\+[1-9][0-9]{7,14}$/.test(phone)) return json({ error: 'Ism va telefon raqamini xalqaro formatda kiriting.' }, 400, req);
    const { data, error } = await service.from('gym_intro_requests').insert({ full_name: fullName, phone_e164: phone, note, consent_at: new Date().toISOString() }).select('id').single();
    if (error) throw error;
    const token = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
    const chatId = Deno.env.get('GYM_LEADS_CHAT_ID') || '';
    let notificationPending = true;
    if (token && /^-?\d{1,20}$/.test(chatId)) {
      const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ chat_id: chatId, text: `ARNIYGYM · birinchi mashg‘ulot arizasi\n${fullName}\n${phone}${note ? `\nIzoh: ${note}` : ''}` }), signal: AbortSignal.timeout(8000) }).catch(() => null);
      notificationPending = !response?.ok;
      await service.from('gym_intro_requests').update({ notification_status: notificationPending ? 'failed' : 'sent' }).eq('id', data.id);
    }
    return json({ ok: true, notificationPending }, 200, req);
  } catch (error) {
    console.error('Intro request failed', error);
    return json({ error: 'Arizani yuborib bo‘lmadi. Keyinroq urinib ko‘ring.' }, 500, req);
  }
});

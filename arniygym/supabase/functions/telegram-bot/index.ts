// ArniyGym Telegram bot as a Supabase Edge Function (replaces the separate Python server).
// - Telegram webhook (header X-Telegram-Bot-Api-Secret-Token must equal BOT_WEBHOOK_SECRET):
//   /start <token> → asks for the user's own contact → OTP code; /id → shows the Telegram ID;
//   P2P receipt approve/reject buttons for admins.
// - Scheduler tick (header x-cron-secret must equal BOT_CRON_SECRET): delivers admin login codes
//   and new P2P receipts to admins, polling for ~50 seconds.
// Calls to the bot-facing functions are HMAC-signed exactly like the old Python bot.
import { constantTime, hashHex, json, service } from '../_shared/base.ts';

const env = (name: string) => Deno.env.get(name) || '';
const FUNCTIONS = `${env('SUPABASE_URL')}/functions/v1`;
const SECRET_FOR: Record<string, string> = {
  'telegram-contact': 'BOT_OTP_SECRET', 'bot-pending-admins': 'BOT_ADMIN_SECRET',
  'bot-pending-payments': 'BOT_QUEUE_SECRET', 'p2p-review': 'BOT_P2P_SECRET',
};

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const raw = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return [...new Uint8Array(raw)].map(v => v.toString(16).padStart(2, '0')).join('');
}
async function callFunction(name: string, payload: unknown = {}) {
  const body = JSON.stringify(payload);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const nonce = [...crypto.getRandomValues(new Uint8Array(32))].map(v => v.toString(16).padStart(2, '0')).join('');
  const signature = await hmacHex(env(SECRET_FOR[name]), `${timestamp}.${name}.${await hashHex(body)}.${nonce}`);
  const response = await fetch(`${FUNCTIONS}/${name}`, {
    method: 'POST', body, signal: AbortSignal.timeout(20_000),
    headers: { 'content-type': 'application/json', 'x-bot-timestamp': timestamp, 'x-bot-nonce': nonce, 'x-bot-signature': signature },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data?.error || `HTTP ${response.status}`), { status: response.status });
  return data;
}
async function tg(method: string, params: Record<string, unknown>) {
  const response = await fetch(`https://api.telegram.org/bot${env('TELEGRAM_BOT_TOKEN')}/${method}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params), signal: AbortSignal.timeout(15_000),
  });
  const data = await response.json().catch(() => ({}));
  if (!data.ok) console.error(`Telegram ${method} failed`, data?.description);
  return data;
}
const send = (chat_id: number | string, text: string, extra: Record<string, unknown> = {}) => tg('sendMessage', { chat_id, text, parse_mode: 'HTML', ...extra });

async function adminTelegramIds(): Promise<string[]> {
  const { data } = await service.from('admin_roles').select('telegram_user_id').eq('role', 'admin');
  return (data || []).map(row => String(row.telegram_user_id));
}

async function onMessage(message: any) {
  const chatId = message.chat?.id, from = message.from;
  if (!chatId || !from || message.chat?.type !== 'private') return;
  const text: string = message.text || '';
  if (text === '/id' || text.startsWith('/id ')) {
    await send(chatId, `Sizning Telegram ID raqamingiz: <code>${from.id}</code>`);
    return;
  }
  if (text.startsWith('/start')) {
    const token = text.split(/\s+/, 2)[1] || '';
    if (!token || !/^[A-Za-z0-9_-]{20,100}$/.test(token)) {
      await send(chatId, 'ArniyGym’ga xush kelibsiz. Kirishni saytdagi “Kirish” tugmasi orqali boshlang.\nTelegram ID raqamingizni bilish uchun /id yuboring.');
      return;
    }
    const { error } = await service.from('bot_pending_challenges').upsert({
      telegram_user_id: from.id, token, expires_at: new Date(Date.now() + 180_000).toISOString(),
    }, { onConflict: 'telegram_user_id' });
    if (error) throw error;
    await send(chatId, 'Kirishni tasdiqlash uchun ArniyGym’da kiritgan telefon raqamingizni o‘zingizning Telegram kontaktingiz sifatida yuboring.', {
      reply_markup: { keyboard: [[{ text: '📱 Raqamni yuborish', request_contact: true }]], resize_keyboard: true, one_time_keyboard: true },
    });
    return;
  }
  if (message.contact) {
    const remove = { reply_markup: { remove_keyboard: true } };
    const { data: pending } = await service.from('bot_pending_challenges').select('token,expires_at').eq('telegram_user_id', from.id).maybeSingle();
    if (!pending || Date.parse(pending.expires_at) < Date.now()) { await send(chatId, 'Avval saytdan kirish so‘rovini boshlang.', remove); return; }
    if (message.contact.user_id !== from.id) { await send(chatId, 'Faqat o‘zingizning Telegram kontaktingizni yuboring.'); return; }
    let phone = String(message.contact.phone_number || '').trim();
    if (!phone.startsWith('+')) phone = `+${phone}`;
    try {
      const result = await callFunction('telegram-contact', {
        challengeToken: pending.token, phone, telegramUserId: from.id, contactUserId: message.contact.user_id,
        displayName: [from.first_name, from.last_name].filter(Boolean).join(' ').slice(0, 120),
      });
      await service.from('bot_pending_challenges').delete().eq('telegram_user_id', from.id);
      await send(chatId, `ArniyGym kirish kodingiz: <code>${result.code}</code>\nKod 3 daqiqa amal qiladi. Uni faqat ArniyGym sahifasiga kiriting.`, remove);
    } catch (error) {
      console.warn('OTP request rejected', (error as Error).message);
      await send(chatId, 'Raqam mos kelmadi yoki kirish so‘rovi eskirdi. Saytga qaytib, yangi urinish boshlang.', remove);
    }
  }
}

async function onCallback(query: any) {
  const data: string = query.data || '';
  if (!data.startsWith('p2p:')) return;
  const answer = (text: string, alert = false) => tg('answerCallbackQuery', { callback_query_id: query.id, text, show_alert: alert });
  if (!(await adminTelegramIds()).includes(String(query.from.id))) { await answer('Bu amal faqat tasdiqlangan admin uchun.', true); return; }
  const [, action, paymentId] = data.split(':', 3);
  const status = action === 'yes' ? 'approved' : 'rejected';
  try {
    const result = await callFunction('p2p-review', { paymentId, status, note: 'Telegram orqali ko‘rib chiqildi', reviewerTelegramId: String(query.from.id) });
    if (query.message) await tg('editMessageReplyMarkup', { chat_id: query.message.chat.id, message_id: query.message.message_id, reply_markup: { inline_keyboard: [] } });
    await send(query.from.id, `✅ Chek #${String(paymentId).slice(0, 8)} ${status === 'approved' ? 'tasdiqlandi' : 'rad etildi'}.`);
    if (result.telegramUserId) await send(result.telegramUserId, status === 'approved' ? 'To‘lovingiz tasdiqlandi. Obunangiz faollashtirildi.' : 'Chekingiz rad etildi. Tafsilot uchun qo‘llab-quvvatlashga yozing.');
    await answer(result.message || 'Saqlandi');
  } catch (error) {
    console.error('P2P review failed', error);
    await answer('Chekni yangilab bo‘lmadi.', true);
  }
}

async function tickOnce() {
  const admins = await adminTelegramIds();
  if (admins.length) {
    const result = await callFunction('bot-pending-payments');
    for (const payment of result.payments || []) {
      const caption = `ArniyGym P2P chek\n#${payment.id.slice(0, 8)} · ${Number(payment.amount_uzs).toLocaleString('en-US')} UZS\nTarif: ${payment.plan_key}\nTelegram ID: ${payment.telegramUserId || 'noma’lum'}`;
      const reply_markup = { inline_keyboard: [[{ text: '✅ Tasdiqlash', callback_data: `p2p:yes:${payment.id}` }, { text: '❌ Rad etish', callback_data: `p2p:no:${payment.id}` }]] };
      for (const chat_id of admins) {
        if (payment.receiptUrl && String(payment.receipt_path || '').toLowerCase().endsWith('.pdf')) await tg('sendDocument', { chat_id, document: payment.receiptUrl, caption, reply_markup });
        else if (payment.receiptUrl) await tg('sendPhoto', { chat_id, photo: payment.receiptUrl, caption, reply_markup });
        else await tg('sendMessage', { chat_id, text: `${caption}\nChek fayli topilmadi.`, reply_markup });
      }
    }
  }
  const adminCodes = await callFunction('bot-pending-admins');
  for (const challenge of adminCodes.challenges || []) {
    await send(challenge.telegramUserId, `ArniyGym admin kirish kodi: <code>${challenge.code}</code>\nKod 3 daqiqa amal qiladi.`);
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ ok: true, service: 'arniygym-telegram-bot' }, 200, req);
  const webhookSecret = env('BOT_WEBHOOK_SECRET'), cronSecret = env('BOT_CRON_SECRET');
  const telegramHeader = req.headers.get('x-telegram-bot-api-secret-token') || '';
  const cronHeader = req.headers.get('x-cron-secret') || '';
  try {
    if (webhookSecret.length >= 32 && telegramHeader && constantTime(telegramHeader, webhookSecret)) {
      const update = await req.json();
      if (update.message) await onMessage(update.message);
      else if (update.callback_query) await onCallback(update.callback_query);
      return json({ ok: true }, 200, req);
    }
    if (cronSecret.length >= 32 && cronHeader && constantTime(cronHeader, cronSecret)) {
      // One scheduler call per minute; poll every 10 s so admin codes arrive quickly.
      for (let round = 0; round < 5; round++) {
        try { await tickOnce(); } catch (error) { console.error('Bot tick failed', error); }
        if (round < 4) await new Promise(resolve => setTimeout(resolve, 10_000));
      }
      return json({ ok: true }, 200, req);
    }
    return json({ error: 'Ruxsat yo‘q' }, 401, req);
  } catch (error) {
    console.error('telegram-bot failed', error);
    // Always 200 for Telegram so a single bad update is not retried forever.
    return json({ ok: false }, telegramHeader ? 200 : 500, req);
  }
});

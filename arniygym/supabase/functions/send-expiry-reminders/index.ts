import webpush from 'npm:web-push@3.6.7';
import { constantTime, json, preflight, service } from '../_shared/base.ts';

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'Faqat POST so‘rovi qabul qilinadi.' }, 405, req);
  try {
    const secret = Deno.env.get('PUSH_REMINDER_SECRET') || '';
    if (!secret || !constantTime(req.headers.get('x-reminder-secret') || '', secret)) return json({ error: 'Ruxsat berilmadi.' }, 401, req);

    const now = new Date();
    const deadline = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const { data: rows, error } = await service.from('subscriptions')
      .select('id,user_id,plan_key,source,current_period_end')
      .in('status', ['active', 'on_trial', 'cancelled'])
      .gt('current_period_end', now.toISOString())
      .lte('current_period_end', deadline.toISOString())
      .order('current_period_end').limit(300);
    if (error) throw error;

    const subject = Deno.env.get('VAPID_SUBJECT') || '';
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY') || '';
    const pushEnabled = Boolean(subject && publicKey && privateKey);
    if (pushEnabled) webpush.setVapidDetails(subject, publicKey, privateKey);
    const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN') || '';
    let sent = 0, skipped = 0, failed = 0;

    for (const row of rows || []) {
      const periodEnd = new Date(row.current_period_end).toISOString();
      const { data: prior, error: priorError } = await service.from('subscription_reminders')
        .select('status').eq('subscription_id', row.id).eq('period_end', periodEnd).maybeSingle();
      if (priorError) throw priorError;
      if (prior?.status === 'sent') { skipped++; continue; }
      if (!prior) {
        const { error: insertError } = await service.from('subscription_reminders')
          .insert({ subscription_id: row.id, period_end: periodEnd, status: 'pending' });
        if (insertError?.code === '23505') { skipped++; continue; }
        if (insertError) throw insertError;
      } else {
        await service.from('subscription_reminders').update({ status: 'pending', last_error: null, updated_at: new Date().toISOString() })
          .eq('subscription_id', row.id).eq('period_end', periodEnd).neq('status', 'sent');
      }

      const [{ data: endpoints, error: pushError }, { data: member, error: memberError }] = await Promise.all([
        service.from('push_subscriptions').select('id,endpoint,p256dh,auth').eq('user_id', row.user_id),
        service.from('members').select('telegram_user_id').eq('auth_user_id', row.user_id).maybeSingle(),
      ]);
      if (pushError || memberError) throw pushError || memberError;
      const endDate = new Date(periodEnd).toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent', day: 'numeric', month: 'long' });
      const manual = row.source === 'p2p' || row.source === 'manual';
      const title = 'ArniyGym · A’zolik muddati';
      const message = manual
        ? `A’zoligingiz ${endDate} kuni tugaydi. P2P va qo‘lda berilgan tariflar avtomatik uzaymaydi.`
        : `A’zoligingiz ${endDate} kuni tugaydi. Tarif va to‘lov holatini tekshiring.`;
      let delivered = false;
      const errors: string[] = [];

      if (pushEnabled) for (const endpoint of endpoints || []) {
        try {
          await webpush.sendNotification({ endpoint: endpoint.endpoint, keys: { p256dh: endpoint.p256dh, auth: endpoint.auth } },
            JSON.stringify({ title, body: message, url: '/plans' }), { TTL: 86400 });
          delivered = true;
        } catch (pushFailure: any) {
          if (pushFailure?.statusCode === 404 || pushFailure?.statusCode === 410) await service.from('push_subscriptions').delete().eq('id', endpoint.id);
          else errors.push('push delivery failed');
        }
      }

      const telegramId = member?.telegram_user_id;
      if (botToken && telegramId) {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: telegramId, text: `${title}\n${message}` }),
          signal: AbortSignal.timeout(8000),
        }).catch(() => null);
        if (response?.ok) delivered = true;
        else errors.push('telegram delivery failed');
      }

      if (delivered) sent++; else failed++;
      const { error: updateError } = await service.from('subscription_reminders').update({
        status: delivered ? 'sent' : 'failed', last_error: delivered ? null : errors.join(', ').slice(0, 240) || 'No push or Telegram destination is configured', updated_at: new Date().toISOString(),
      }).eq('subscription_id', row.id).eq('period_end', periodEnd);
      if (updateError) throw updateError;
    }

    return json({ sent, skipped, failed }, 200, req);
  } catch (error) {
    console.error('Subscription expiry reminder dispatch failed', error);
    return json({ error: 'A’zolik eslatmalari yuborilmadi.' }, 500, req);
  }
});

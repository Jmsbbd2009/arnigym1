import { json, preflight, requireUser, service } from '../_shared/base.ts';

const tables = ['members','subscriptions','payment_orders','p2p_payments','weight_logs','water_logs','steps_logs','calorie_settings','calorie_logs','ai_usage_logs','privacy_consents','gym_class_bookings','gym_checkins','membership_freeze_requests','exercise_favorites','workout_logs','push_subscriptions'];
Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'Faqat POST so‘rovi qabul qilinadi.' }, 405, req);
  try {
    const { user } = await requireUser(req);
    const entries = await Promise.all(tables.map(async (table) => {
      const key = table === 'members' ? 'auth_user_id' : 'user_id';
      const { data, error } = await service.from(table).select('*').eq(key, user.id).limit(5000);
      if (error) throw new Error(`Eksportda ${table} jadvali o‘qilmadi.`);
      return [table, data || []] as const;
    }));
    const content = { exportedAt: new Date().toISOString(), account: { id: user.id, email: user.email || null, phone: user.user_metadata?.phone_e164 || null }, data: Object.fromEntries(entries) };
    return json(content, 200, req);
  } catch (error) {
    console.error('User data export failed', error);
    return json({ error: error instanceof Error ? error.message : 'Ma’lumotlar eksport qilinmadi.' }, 500, req);
  }
});

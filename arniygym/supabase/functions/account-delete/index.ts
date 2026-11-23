import { json, preflight, requireUser, service, hashHex } from '../_shared/base.ts';

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  try {
    const { user } = await requireUser(req);
    const { confirmPhone } = await req.json();
    const { data: member } = await service.from('members').select('phone_e164').eq('auth_user_id', user.id).maybeSingle();
    if (!member?.phone_e164 || String(confirmPhone || '').trim() !== member.phone_e164) return json({ error: 'Telefon tasdig‘i mos emas.' }, 400, req);
    const { data: admin } = await service.from('admin_roles').select('user_id').eq('user_id', user.id).maybeSingle();
    if (admin) return json({ error: 'Admin akkauntni boshqa admin orqali boshqaring.' }, 403, req);
    const { data: active, error } = await service.from('subscriptions').select('id').eq('user_id', user.id).in('status', ['active', 'on_trial', 'cancelled']).gt('current_period_end', new Date().toISOString()).limit(1).maybeSingle();
    if (error) throw error;
    if (active) return json({ error: 'Avval faol obunani bekor qiling yoki uning muddati tugashini kuting.' }, 409, req);
    await service.from('otp_challenges').delete().eq('phone_e164', member.phone_e164);
    const pepper = Deno.env.get('OTP_PEPPER');
    if (pepper && pepper.length >= 32) await service.from('privacy_consents').delete().eq('phone_hash', await hashHex(`${pepper}:privacy:${member.phone_e164}`));
    const { data: receiptFiles } = await service.storage.from('p2p-receipts').list(user.id, { limit: 1000 });
    if (receiptFiles?.length) await service.storage.from('p2p-receipts').remove(receiptFiles.map((file) => `${user.id}/${file.name}`));
    const { error: deleteError } = await service.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;
    return json({ ok: true }, 200, req);
  } catch (error) { console.error(error); return json({ error: 'Hisobni o‘chirib bo‘lmadi.' }, 500, req); }
});

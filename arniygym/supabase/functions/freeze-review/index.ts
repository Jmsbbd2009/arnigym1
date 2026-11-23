import { json, preflight, requireUser, service } from '../_shared/base.ts';

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'Faqat POST so‘rovi qabul qilinadi.' }, 405, req);
  try {
    const { user } = await requireUser(req);
    const { data: role } = await service.from('admin_roles').select('user_id').eq('user_id', user.id).eq('role','admin').maybeSingle();
    if (!role) return json({ error: 'Admin ruxsati talab qilinadi.' }, 403, req);
    const { requestId, approve } = await req.json();
    if (typeof requestId !== 'string' || typeof approve !== 'boolean') return json({ error: 'So‘rov ma’lumoti noto‘g‘ri.' }, 400, req);
    const { data, error } = await service.rpc('review_membership_freeze', { p_request_id: requestId, p_approve: approve, p_reviewer_id: user.id });
    if (error) return json({ error: error.message.includes('already reviewed') ? 'So‘rov avval ko‘rib chiqilgan.' : 'A’zolik so‘rovini yangilab bo‘lmadi.' }, 409, req);
    return json({ ok: true, request: data }, 200, req);
  } catch (error) {
    console.error('Membership freeze review failed', error);
    return json({ error: 'A’zolik so‘rovini ko‘rib chiqib bo‘lmadi.' }, 500, req);
  }
});

// Admin-only news image storage: upload (validated WebP), move between public/member buckets,
// delete when unreferenced, and orphan cleanup. Service role never leaves the server.
import { auditAdmin, authStatus, json, preflight, rateLimit, requireAdmin, service } from '../_shared/base.ts';
import { checkNewsImage, NEWS_BUCKETS, NEWS_IMAGE_MAX_BYTES, NEWS_PATH } from '../_shared/news.ts';

type Audience = keyof typeof NEWS_BUCKETS;
const bucketFor = (audience: unknown): string | null => audience === 'members' ? NEWS_BUCKETS.members : audience === 'public' ? NEWS_BUCKETS.public : null;
const knownBucket = (bucket: unknown): bucket is string => bucket === NEWS_BUCKETS.public || bucket === NEWS_BUCKETS.members;

async function referenced(path: string) {
  const { count, error } = await service.from('gym_news').select('id', { count: 'exact', head: true }).eq('image_path', path);
  if (error) throw error;
  return (count || 0) > 0;
}
function publicUrl(bucket: string, path: string) {
  return bucket === NEWS_BUCKETS.public ? service.storage.from(bucket).getPublicUrl(path).data.publicUrl : null;
}

async function upload(req: Request, adminId: string) {
  const length = Number(req.headers.get('content-length') || '0');
  if (length > NEWS_IMAGE_MAX_BYTES + 64 * 1024) return json({ error: 'Rasm hajmi 2 MB dan oshmasligi kerak.' }, 413, req);
  const form = await req.formData();
  const file = form.get('file');
  const bucket = bucketFor(form.get('audience'));
  if (!(file instanceof File)) return json({ error: 'Rasm fayli yuborilmadi.' }, 400, req);
  if (!bucket) return json({ error: 'Rasm auditoriyasi noto‘g‘ri.' }, 400, req);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkNewsImage(bytes, file.type);
  if (!check.ok) return json({ error: check.error }, 415, req);
  const path = `news/${crypto.randomUUID()}.webp`;
  const { error } = await service.storage.from(bucket).upload(path, bytes, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
  if (error) throw error;
  await auditAdmin(adminId, 'UPLOAD', `storage.${bucket}`, path, [`${check.width}x${check.height}`, `${bytes.length}b`]);
  return json({ path, bucket, url: publicUrl(bucket, path), width: check.width, height: check.height, bytes: bytes.length }, 200, req);
}

async function move(req: Request, adminId: string, body: any) {
  const { path, from } = body;
  const to = bucketFor(body.audience);
  if (typeof path !== 'string' || !NEWS_PATH.test(path) || !knownBucket(from) || !to) return json({ error: 'Rasm manzili noto‘g‘ri.' }, 400, req);
  if (from === to) return json({ path, bucket: to, url: publicUrl(to, path) }, 200, req);
  const { data, error } = await service.storage.from(from).download(path);
  if (error || !data) return json({ error: 'Ko‘chiriladigan rasm topilmadi.' }, 404, req);
  const bytes = new Uint8Array(await data.arrayBuffer());
  const check = checkNewsImage(bytes, 'image/webp');
  if (!check.ok) return json({ error: check.error }, 415, req);
  const nextPath = `news/${crypto.randomUUID()}.webp`;
  const { error: uploadError } = await service.storage.from(to).upload(nextPath, bytes, { contentType: 'image/webp', cacheControl: '31536000', upsert: false });
  if (uploadError) throw uploadError;
  await auditAdmin(adminId, 'MOVE', `storage.${to}`, nextPath, [`from:${from}`]);
  // The original stays until the news row points to the new copy; the client deletes it after saving.
  return json({ path: nextPath, bucket: to, url: publicUrl(to, nextPath) }, 200, req);
}

async function remove(req: Request, adminId: string, body: any) {
  const { path, bucket } = body;
  if (typeof path !== 'string' || !NEWS_PATH.test(path) || !knownBucket(bucket)) return json({ error: 'Rasm manzili noto‘g‘ri.' }, 400, req);
  if (await referenced(path)) return json({ ok: true, kept: true }, 200, req);
  const { error } = await service.storage.from(bucket).remove([path]);
  if (error) throw error;
  await auditAdmin(adminId, 'DELETE', `storage.${bucket}`, path);
  return json({ ok: true, removed: 1 }, 200, req);
}

async function cleanup(req: Request, adminId: string) {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const bucket of [NEWS_BUCKETS.public, NEWS_BUCKETS.members]) {
    const { data, error } = await service.storage.from(bucket).list('news', { limit: 1000, sortBy: { column: 'created_at', order: 'asc' } });
    if (error) throw error;
    const candidates = (data || []).map(item => ({ path: `news/${item.name}`, created: Date.parse(item.created_at || '') }))
      .filter(item => NEWS_PATH.test(item.path) && Number.isFinite(item.created) && item.created < cutoff);
    if (!candidates.length) continue;
    const { data: rows, error: rowsError } = await service.from('gym_news').select('image_path').in('image_path', candidates.map(item => item.path));
    if (rowsError) throw rowsError;
    const used = new Set((rows || []).map(row => row.image_path));
    const orphans = candidates.map(item => item.path).filter(path => !used.has(path));
    if (!orphans.length) continue;
    const { error: removeError } = await service.storage.from(bucket).remove(orphans);
    if (removeError) throw removeError;
    removed += orphans.length;
    await auditAdmin(adminId, 'CLEANUP', `storage.${bucket}`, null, [`removed:${orphans.length}`]);
  }
  return json({ ok: true, removed }, 200, req);
}

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'Faqat POST so‘rovi qabul qilinadi.' }, 405, req);
  try {
    const { user } = await requireAdmin(req);
    if (!await rateLimit(req, `news-image:${user.id}`, 60, 3600, 'global')) return json({ error: 'Rasm amallari limiti tugadi. Keyinroq urinib ko‘ring.' }, 429, req);
    if ((req.headers.get('content-type') || '').startsWith('multipart/form-data')) return await upload(req, user.id);
    const body = await req.json().catch(() => ({}));
    if (body.action === 'move') return await move(req, user.id, body);
    if (body.action === 'delete') return await remove(req, user.id, body);
    if (body.action === 'cleanup') return await cleanup(req, user.id);
    return json({ error: 'Noma’lum amal.' }, 400, req);
  } catch (error) {
    const status = authStatus(error);
    if (status) return json({ error: error instanceof Error ? error.message : 'Ruxsat berilmadi.' }, status, req);
    console.error('news-image failed', error);
    return json({ error: 'Rasm amali bajarilmadi. Qayta urinib ko‘ring.' }, 500, req);
  }
});

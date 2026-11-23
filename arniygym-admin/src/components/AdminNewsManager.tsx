import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CircleAlert, Image as ImageIcon, LockKeyhole, Pencil, Pin, Plus, RotateCcw, Trash2, Upload, X } from './BootstrapIcons';
import { invoke, supabase } from '../lib/supabase';
import { categoryLabel, dateLabel, NEWS_CATEGORIES, NEWS_COLUMNS, NEWS_LIMITS, newsDate, resolveNewsImages, safeImageUrl, sortNews, type NewsCategory, type NewsItem } from '../lib/news';
import { prepareNewsImage, ACCEPTED_TYPES } from '../lib/newsImage';
import './news.css';

type StoredImage = { path: string; bucket: 'news-images' | 'news-images-members'; url: string | null };
type Draft = {
  id: string | null; title: string; title_ru: string; body: string; body_ru: string; category: NewsCategory;
  is_pinned: boolean; is_members_only: boolean; published: boolean; publish_at: string; expires_at: string;
  image: StoredImage | null; legacyUrl: string; pending: { blob: Blob; preview: string; width: number; height: number } | null;
  removeImage: boolean; sendPush: boolean;
};
type PushLog = { news_id: string; status: string; sent: number; failed: number; created_at: string };
type Status = { kind: 'busy' | 'ok' | 'error'; text: string } | null;

const empty = (): Draft => ({ id: null, title: '', title_ru: '', body: '', body_ru: '', category: 'general', is_pinned: false, is_members_only: false,
  published: false, publish_at: '', expires_at: '', image: null, legacyUrl: '', pending: null, removeImage: false, sendPush: false });
const toLocal = (value: string | null) => value ? new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tashkent', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value)).replace(' ', 'T').slice(0, 16) : '';
const fromLocal = (value: string) => value ? new Date(`${value}:00+05:00`).toISOString() : null;
const bucketFor = (membersOnly: boolean) => membersOnly ? 'news-images-members' as const : 'news-images' as const;

function stateOf(item: NewsItem): ['live' | 'draft' | 'scheduled' | 'expired', string] {
  const now = Date.now();
  if (!item.published) return ['draft', 'Qoralama'];
  if (item.expires_at && Date.parse(item.expires_at) <= now) return ['expired', 'Muddati tugagan'];
  if (item.publish_at && Date.parse(item.publish_at) > now) return ['scheduled', 'Rejalashtirilgan'];
  return ['live', 'Saytda'];
}
function dbError(error: { code?: string; message?: string } | null, fallback: string) {
  if (!error) return fallback;
  if (error.code === '42501' || /permission|row-level/i.test(error.message || '')) return 'Ruxsat yo‘q: admin sessiyasi tugagan yoki bu qurilma faol emas. Qayta kiring.';
  if (error.code === '23514') return 'Ma’lumot cheklovlarga mos emas (uzunlik, sana yoki rasm turi). Maydonlarni tekshiring.';
  return fallback;
}

function validate(draft: Draft) {
  const errors: Partial<Record<keyof Draft, string>> = {};
  const len = (value: string) => value.trim().length;
  if (len(draft.title) < NEWS_LIMITS.titleMin) errors.title = 'Sarlavha kamida 3 belgi bo‘lsin.';
  if (len(draft.title) > NEWS_LIMITS.title) errors.title = `Sarlavha ${NEWS_LIMITS.title} belgidan oshmasin.`;
  if (len(draft.body) < NEWS_LIMITS.bodyMin) errors.body = 'Matn kamida 3 belgi bo‘lsin.';
  if (len(draft.body) > NEWS_LIMITS.body) errors.body = `Matn ${NEWS_LIMITS.body} belgidan oshmasin.`;
  if (len(draft.title_ru) > NEWS_LIMITS.title) errors.title_ru = `Ruscha sarlavha ${NEWS_LIMITS.title} belgidan oshmasin.`;
  if (len(draft.body_ru) > NEWS_LIMITS.body) errors.body_ru = `Ruscha matn ${NEWS_LIMITS.body} belgidan oshmasin.`;
  if (len(draft.body_ru) && !len(draft.title_ru)) errors.title_ru = 'Ruscha matn bo‘lsa, ruscha sarlavhani ham kiriting.';
  const start = fromLocal(draft.publish_at), end = fromLocal(draft.expires_at);
  if (start && end && Date.parse(end) <= Date.parse(start)) errors.expires_at = 'Tugash vaqti e’lon vaqtidan keyin bo‘lsin.';
  if (end && Date.parse(end) <= Date.now()) errors.expires_at = 'Tugash vaqti kelajakda bo‘lsin.';
  return errors;
}

function Counter({ value, max }: { value: string; max: number }) {
  const count = value.trim().length;
  return <span className={`anm-counter${count > max ? ' anm-counter-over' : ''}`}>{count}/{max}</span>;
}

export function AdminNewsManager({ notify }: { notify: (message: string) => void }) {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [pushLog, setPushLog] = useState<Record<string, PushLog>>({});
  const [draft, setDraft] = useState<Draft>(empty);
  const [original, setOriginal] = useState<StoredImage | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);
  const [listState, setListState] = useState<'loading' | 'ready' | 'error'>('loading');
  const formRef = useRef<HTMLFormElement>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft(current => ({ ...current, [key]: value }));

  const load = async () => {
    if (!supabase) { setListState('error'); return; }
    setListState('loading');
    const [{ data, error }, { data: logs }] = await Promise.all([
      supabase.from('gym_news').select(`${NEWS_COLUMNS},created_by`).order('created_at', { ascending: false }).limit(200),
      supabase.from('news_push_log').select('news_id,status,sent,failed,created_at').order('created_at', { ascending: false }).limit(300),
    ]);
    if (error) { setListState('error'); return; }
    const rows = sortNews((data || []) as NewsItem[]);
    setItems(rows); setListState('ready');
    const latest: Record<string, PushLog> = {};
    for (const log of (logs || []) as PushLog[]) if (log.news_id && !latest[log.news_id]) latest[log.news_id] = log;
    setPushLog(latest);
    setThumbs(await resolveNewsImages(rows).catch(() => ({})));
  };
  useEffect(() => { void load(); }, []);
  useEffect(() => () => { if (draft.pending) URL.revokeObjectURL(draft.pending.preview); }, [draft.pending]);

  const reset = () => { setDraft(empty()); setOriginal(null); setErrors({}); };
  const edit = (item: NewsItem) => {
    const image = item.image_path && item.image_bucket ? { path: item.image_path, bucket: item.image_bucket, url: item.cover_image_url } : null;
    setDraft({ id: item.id, title: item.title, title_ru: item.title_ru || '', body: item.body, body_ru: item.body_ru || '', category: item.category,
      is_pinned: item.is_pinned, is_members_only: item.is_members_only, published: item.published, publish_at: toLocal(item.publish_at), expires_at: toLocal(item.expires_at),
      image, legacyUrl: image ? '' : safeImageUrl(item.cover_image_url), pending: null, removeImage: false, sendPush: false });
    setOriginal(image); setErrors({}); setStatus(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setStatus({ kind: 'busy', text: 'Rasm tekshirilmoqda va WebP’ga siqilmoqda…' });
    try {
      const prepared = await prepareNewsImage(file);
      setDraft(current => ({ ...current, pending: { ...prepared, preview: URL.createObjectURL(prepared.blob) }, removeImage: false }));
      setStatus({ kind: 'ok', text: `Rasm tayyor: ${prepared.width}×${prepared.height}, ${(prepared.blob.size / 1024).toFixed(0)} KB WebP. Saqlaganda yuklanadi.` });
    } catch (error) {
      setStatus({ kind: 'error', text: error instanceof Error ? error.message : 'Rasm tayyorlanmadi.' });
    }
  };

  const removeStored = (image: StoredImage | null) => image ? invoke('news-image', { action: 'delete', path: image.path, bucket: image.bucket }).catch(() => undefined) : Promise.resolve();

  const sendPush = async (newsId: string, force = false): Promise<string> => {
    try {
      const result = await invoke<{ status: string; targeted: number; sent: number; failed: number; removed: number }>('news-push', { news_id: newsId, force });
      if (result.status === 'skipped') return 'Push: hozircha bildirishnomaga obuna bo‘lgan qurilma yo‘q.';
      return `Push: ${result.sent}/${result.targeted} ta qurilmaga yuborildi${result.failed ? `, ${result.failed} ta xato` : ''}${result.removed ? `, ${result.removed} ta eskirgan obuna o‘chirildi` : ''}.`;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Push yuborilmadi.';
      if (/avval yuborilgan/.test(message) && window.confirm('Bu yangilik uchun push avval yuborilgan. Qayta yuborilsinmi?')) return sendPush(newsId, true);
      return `Push yuborilmadi: ${message}`;
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase || busy) return;
    const found = validate(draft);
    setErrors(found);
    if (Object.keys(found).length) { setStatus({ kind: 'error', text: 'Formadagi xatolarni tuzating.' }); return; }
    setBusy(true);
    const audience = draft.is_members_only ? 'members' : 'public';
    let image: StoredImage | null = draft.removeImage ? null : draft.image;
    let created: StoredImage | null = null;
    try {
      if (draft.pending) {
        setStatus({ kind: 'busy', text: 'Rasm yuklanmoqda…' });
        const form = new FormData();
        form.append('audience', audience);
        form.append('file', new File([draft.pending.blob], 'news.webp', { type: 'image/webp' }));
        created = await invoke<StoredImage>('news-image', form);
        image = created;
      } else if (image && image.bucket !== bucketFor(draft.is_members_only)) {
        setStatus({ kind: 'busy', text: 'Rasm auditoriyaga mos bucket’ga ko‘chirilmoqda…' });
        created = await invoke<StoredImage>('news-image', { action: 'move', path: image.path, from: image.bucket, audience });
        image = created;
      }
      setStatus({ kind: 'busy', text: 'Yangilik saqlanmoqda…' });
      const payload = {
        title: draft.title.trim(), title_ru: draft.title_ru.trim(), body: draft.body.trim(), body_ru: draft.body_ru.trim(), category: draft.category,
        is_pinned: draft.is_pinned, is_members_only: draft.is_members_only, published: draft.published,
        publish_at: fromLocal(draft.publish_at), expires_at: fromLocal(draft.expires_at),
        image_path: image?.path || null, image_bucket: image?.bucket || null,
        cover_image_url: image ? (image.bucket === 'news-images' ? image.url : null) : (draft.removeImage || draft.is_members_only ? null : draft.legacyUrl || null),
      };
      const query = draft.id
        ? supabase.from('gym_news').update(payload).eq('id', draft.id).select(NEWS_COLUMNS).single()
        : supabase.from('gym_news').insert(payload).select(NEWS_COLUMNS).single();
      const { data, error } = await query;
      if (error || !data) {
        await removeStored(created);
        setStatus({ kind: 'error', text: dbError(error, 'Yangilik saqlanmadi. Qayta urinib ko‘ring.') });
        return;
      }
      const saved = data as NewsItem;
      if (original && original.path !== saved.image_path) await removeStored(original);
      let message = draft.id ? 'Yangilik yangilandi.' : saved.published ? 'Yangilik e’lon qilindi.' : 'Yangilik qoralama sifatida saqlandi.';
      if (draft.sendPush) {
        const live = saved.published && (!saved.publish_at || Date.parse(saved.publish_at) <= Date.now());
        if (live) { setStatus({ kind: 'busy', text: 'Push yuborilmoqda…' }); message += ` ${await sendPush(saved.id)}`; }
        else message += ' Push yuborilmadi: yangilik hali e’lon qilinmagan (qoralama yoki rejalashtirilgan).';
      }
      setStatus({ kind: /yuborilmadi|xato/.test(message) ? 'error' : 'ok', text: message });
      notify(draft.id ? 'Yangilik yangilandi.' : 'Yangilik saqlandi.');
      reset(); await load();
    } catch (error) {
      await removeStored(created);
      setStatus({ kind: 'error', text: error instanceof Error ? error.message : 'Saqlashda xato yuz berdi.' });
    } finally { setBusy(false); }
  };

  const togglePublish = async (item: NewsItem) => {
    if (!supabase) return;
    const { error } = await supabase.from('gym_news').update({ published: !item.published }).eq('id', item.id);
    if (error) return setStatus({ kind: 'error', text: dbError(error, 'Holat o‘zgarmadi.') });
    notify(item.published ? 'Yangilik qoralamaga qaytarildi.' : 'Yangilik e’lon qilindi.');
    await load();
  };
  const remove = async (item: NewsItem) => {
    if (!supabase || !window.confirm(`“${item.title}” yangiligini butunlay o‘chirasizmi?`)) return;
    const { error } = await supabase.from('gym_news').delete().eq('id', item.id);
    if (error) return setStatus({ kind: 'error', text: dbError(error, 'Yangilik o‘chirilmadi.') });
    if (item.image_path && item.image_bucket) await removeStored({ path: item.image_path, bucket: item.image_bucket, url: null });
    if (draft.id === item.id) reset();
    notify('Yangilik o‘chirildi.');
    await load();
  };
  const pushNow = async (item: NewsItem) => {
    setStatus({ kind: 'busy', text: 'Push yuborilmoqda…' });
    const message = await sendPush(item.id);
    setStatus({ kind: /yuborilmadi/.test(message) ? 'error' : 'ok', text: message });
    await load();
  };
  const cleanup = async () => {
    setStatus({ kind: 'busy', text: 'Keraksiz rasmlar qidirilmoqda…' });
    try { const result = await invoke<{ removed: number }>('news-image', { action: 'cleanup' }); setStatus({ kind: 'ok', text: `${result.removed} ta keraksiz rasm o‘chirildi (24 soatdan eski, hech bir yangilikka bog‘lanmagan).` }); }
    catch (error) { setStatus({ kind: 'error', text: error instanceof Error ? error.message : 'Tozalash bajarilmadi.' }); }
  };

  const preview = draft.pending?.preview || (!draft.removeImage && (draft.image?.url || (draft.image && draft.id ? thumbs[draft.id] : '') || draft.legacyUrl)) || '';
  const fieldProps = (key: keyof Draft) => ({ 'aria-invalid': Boolean(errors[key]) || undefined, 'aria-describedby': errors[key] ? `anm-${key}-error` : undefined });
  const ErrorText = ({ name }: { name: keyof Draft }) => errors[name] ? <span className="anm-error" id={`anm-${name}-error`}>{errors[name]}</span> : null;
  const counts = useMemo(() => ({ live: items.filter(item => stateOf(item)[0] === 'live').length, drafts: items.filter(item => !item.published).length }), [items]);

  return <div className="anm">
    <form ref={formRef} className="anm-form" onSubmit={save} noValidate aria-busy={busy}>
      <div className="anm-full anm-toolbar"><b>{draft.id ? 'Yangilikni tahrirlash' : 'Yangi yangilik'}</b>{draft.id && <button type="button" className="nf-btn nf-btn-ghost" onClick={reset}><X size={13}/>Bekor qilish</button>}</div>
      <label>Sarlavha (o‘zbekcha) *<input type="text" required maxLength={NEWS_LIMITS.title + 20} value={draft.title} onChange={e => set('title', e.target.value)} placeholder="Masalan: Yangi trenajyorlar keldi" {...fieldProps('title')}/><Counter value={draft.title} max={NEWS_LIMITS.title}/><ErrorText name="title"/></label>
      <label>Заголовок (ruscha)<input type="text" maxLength={NEWS_LIMITS.title + 20} value={draft.title_ru} onChange={e => set('title_ru', e.target.value)} placeholder="Необязательно" {...fieldProps('title_ru')}/><Counter value={draft.title_ru} max={NEWS_LIMITS.title}/><ErrorText name="title_ru"/></label>
      <label>Batafsil matn (o‘zbekcha) *<textarea required rows={6} maxLength={NEWS_LIMITS.body + 100} value={draft.body} onChange={e => set('body', e.target.value)} placeholder="Oddiy matn. HTML qabul qilinmaydi; qator tashlash saqlanadi." {...fieldProps('body')}/><Counter value={draft.body} max={NEWS_LIMITS.body}/><ErrorText name="body"/></label>
      <label>Текст (ruscha)<textarea rows={6} maxLength={NEWS_LIMITS.body + 100} value={draft.body_ru} onChange={e => set('body_ru', e.target.value)} placeholder="Tarjima bo‘lmasa, o‘zbekcha matn ko‘rsatiladi." {...fieldProps('body_ru')}/><Counter value={draft.body_ru} max={NEWS_LIMITS.body}/><ErrorText name="body_ru"/></label>
      <label>Kategoriya<select value={draft.category} onChange={e => set('category', e.target.value as NewsCategory)}>{NEWS_CATEGORIES.map(value => <option key={value} value={value}>{categoryLabel(value, 'uz')} · {categoryLabel(value, 'ru')}</option>)}</select></label>
      <label>Holat<select value={draft.published ? 'published' : 'draft'} onChange={e => set('published', e.target.value === 'published')}><option value="draft">Qoralama</option><option value="published">Nashr qilish</option></select></label>
      <label>E’lon vaqti (Toshkent)<input type="datetime-local" value={draft.publish_at} onChange={e => set('publish_at', e.target.value)}/><span className="anm-counter">Bo‘sh bo‘lsa — nashr qilingan zahoti</span></label>
      <label>Ko‘rinish tugaydi<input type="datetime-local" value={draft.expires_at} onChange={e => set('expires_at', e.target.value)} {...fieldProps('expires_at')}/><ErrorText name="expires_at"/></label>
      <div className="anm-full anm-checks">
        <label className="anm-check"><input type="checkbox" checked={draft.is_pinned} onChange={e => set('is_pinned', e.target.checked)}/><Pin size={13}/> Yuqoriga qadash</label>
        <label className="anm-check"><input type="checkbox" checked={draft.is_members_only} onChange={e => set('is_members_only', e.target.checked)}/><LockKeyhole size={13}/> Faqat a’zolar uchun</label>
        <label className="anm-check"><input type="checkbox" checked={draft.sendPush} onChange={e => set('sendPush', e.target.checked)}/><Bell size={13}/> Saqlangach push yuborish</label>
      </div>
      <div className="anm-full anm-image">
        {preview ? <img className="nf-cover" src={preview} alt="Muqova oldindan ko‘rinishi" width={1280} height={720}/> : <div className="nf-cover nf-cover-empty"><ImageIcon size={22}/><span>16:9 · WebP</span></div>}
        <div className="anm-image-actions">
          <span className="nf-btn nf-btn-ghost anm-file"><Upload size={14}/>{preview ? 'Rasmni almashtirish' : 'Rasm tanlash'}<input type="file" accept={ACCEPTED_TYPES.join(',')} onChange={e => { void pickImage(e.target.files?.[0]); e.target.value = ''; }} aria-label="Muqova rasmi"/></span>
          {preview && <button type="button" className="nf-btn nf-btn-ghost anm-danger" onClick={() => setDraft(current => ({ ...current, pending: null, removeImage: true }))}><Trash2 size={14}/>Rasmni olib tashlash</button>}
          <small>JPEG, PNG yoki WebP, 2 MB gacha. Brauzerda 16:9 WebP’ga siqiladi. A’zolar yangiligi rasmi yopiq bucket’da saqlanadi.</small>
        </div>
      </div>
      <div className="anm-full anm-bar">
        <button type="submit" className="nf-btn" disabled={busy}>{busy ? 'Saqlanmoqda…' : draft.id ? 'O‘zgarishni saqlash' : 'Saqlash'}{!busy && <Plus size={14}/>}</button>
        {draft.sendPush && !draft.published && <span className="anm-counter">Push faqat e’lon qilingan yangilik uchun yuboriladi.</span>}
      </div>
      {status && <div className={`anm-full anm-status anm-status-${status.kind}`} role={status.kind === 'error' ? 'alert' : 'status'} aria-live="polite">{status.kind === 'error' && <CircleAlert size={14}/>}{status.text}</div>}
    </form>

    <div className="anm-toolbar"><span className="anm-counter">Saytda: {counts.live} · Qoralama: {counts.drafts} · Jami: {items.length}</span>
      <span className="anm-bar"><button type="button" className="nf-btn nf-btn-ghost" onClick={() => void load()}><RotateCcw size={13}/>Yangilash</button><button type="button" className="nf-btn nf-btn-ghost" onClick={cleanup}><Trash2 size={13}/>Keraksiz rasmlarni tozalash</button></span></div>
    <div className="anm-list">
      {listState === 'loading' && <div className="nf-state" role="status"><div><b>Yuklanmoqda…</b></div></div>}
      {listState === 'error' && <div className="nf-state nf-state-error" role="alert"><div><b>Ro‘yxat yuklanmadi</b><small>Admin sessiyasini tekshirib, qayta urinib ko‘ring.</small></div><button type="button" className="nf-btn" onClick={() => void load()}>Qayta urinish</button></div>}
      {listState === 'ready' && !items.length && <div className="nf-state"><div><b>Hali yangilik yo‘q</b><small>Yuqoridagi formadan birinchi e’lonni yarating.</small></div></div>}
      {items.map(item => {
        const [state, label] = stateOf(item);
        const log = pushLog[item.id];
        return <article className="anm-row" key={item.id}>
          {thumbs[item.id] ? <img className="anm-thumb" src={thumbs[item.id]} alt="" loading="lazy"/> : <span className="anm-thumb nf-cover-empty"><ImageIcon size={16}/></span>}
          <div><h4>{item.title}</h4><div className="nf-meta">
            <span className={`anm-pill anm-pill-${state}`}>{label}</span><span className="nf-tag">{categoryLabel(item.category, 'uz')}</span>
            {item.is_pinned && <span className="nf-flag"><Pin size={10}/>Qadalgan</span>}{item.is_members_only && <span className="nf-flag nf-flag-members"><LockKeyhole size={10}/>A’zolar</span>}
            {!item.title_ru?.trim() && <span className="anm-pill">RU yo‘q</span>}
            <time>{dateLabel(newsDate(item), 'uz')}</time>{log && <span className="anm-pill">Push: {log.status} · {log.sent}</span>}
          </div></div>
          <div className="anm-row-actions">
            <button type="button" className="nf-btn nf-btn-ghost" onClick={() => edit(item)}><Pencil size={13}/>Tahrirlash</button>
            <button type="button" className="nf-btn nf-btn-ghost" onClick={() => void togglePublish(item)}>{item.published ? 'Qoralamaga qaytarish' : 'Nashr qilish'}</button>
            {state === 'live' && <button type="button" className="nf-btn nf-btn-ghost" onClick={() => void pushNow(item)}><Bell size={13}/>Push</button>}
            <button type="button" className="nf-btn anm-danger" onClick={() => void remove(item)} aria-label={`${item.title} — o‘chirish`}><Trash2 size={13}/></button>
          </div>
        </article>;
      })}
    </div>
  </div>;
}

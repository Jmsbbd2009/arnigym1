import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Bell, BellSlash, CalendarDays, CheckAll, CircleAlert, LockKeyhole, Megaphone, Pin, RotateCcw, WifiOff } from './BootstrapIcons';
import { useLanguage } from './Language';
import { categoryLabel, dateLabel, fetchNewsFeed, isRecent, loadReadIds, localizedNews, markNewsRead, newsDate, NEWS_CATEGORIES, resolveNewsImages, type NewsCategory, type NewsItem } from '../lib/news';
import { disablePush, enablePush, pushState, type PushState } from '../lib/push';
import { backendReady } from '../lib/supabase';
import './news.css';

type NewsContextValue = {
  items: NewsItem[]; images: Record<string, string>; loading: boolean; error: string; offline: boolean;
  reload: () => void; isRead: (id: string) => boolean; unread: number; markRead: (ids: string[]) => void; signedIn: boolean;
};
const NewsContext = createContext<NewsContextValue | null>(null);

export function NewsProvider({ session, children }: { session: any; children: ReactNode }) {
  const userId: string | null = session?.user?.id || null;
  const [items, setItems] = useState<NewsItem[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick(value => value + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    if (!backendReady) { setItems([]); setLoading(false); setError('config'); return; }
    fetchNewsFeed(Boolean(userId)).then(async result => {
      if (!alive) return;
      setItems(result.items); setOffline(result.offline);
      const [resolved, read] = await Promise.all([resolveNewsImages(result.items).catch(() => ({})), loadReadIds(userId, result.items.map(item => item.id))]);
      if (!alive) return;
      setImages(resolved); setReadIds(read);
    }).catch(() => { if (alive) { setError('load'); setOffline(!navigator.onLine); } })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [userId, tick]);

  useEffect(() => {
    const online = () => { setOffline(false); reload(); };
    const goneOffline = () => setOffline(true);
    const visible = () => { if (document.visibilityState === 'visible' && navigator.onLine) reload(); };
    window.addEventListener('online', online); window.addEventListener('offline', goneOffline);
    document.addEventListener('visibilitychange', visible);
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', goneOffline); document.removeEventListener('visibilitychange', visible); };
  }, [reload]);

  const markRead = useCallback((ids: string[]) => {
    const fresh = ids.filter(id => !readIds.has(id));
    if (!fresh.length) return;
    setReadIds(current => new Set([...current, ...fresh]));
    void markNewsRead(userId, fresh).catch(() => undefined);
  }, [readIds, userId]);

  const value = useMemo<NewsContextValue>(() => ({
    items, images, loading, error, offline, reload, markRead, signedIn: Boolean(userId),
    isRead: (id: string) => readIds.has(id),
    unread: items.filter(item => isRecent(item) && !readIds.has(item.id)).length,
  }), [items, images, loading, error, offline, reload, markRead, readIds, userId]);
  return <NewsContext.Provider value={value}>{children}</NewsContext.Provider>;
}

export function useNews() {
  const value = useContext(NewsContext);
  if (!value) throw new Error('useNews must be used inside NewsProvider');
  return value;
}

export function NewsBadge() {
  const { unread } = useNews();
  if (!unread) return null;
  return <span className="news-badge" aria-label={`${unread} ta o‘qilmagan yangilik`}>{unread > 9 ? '9+' : unread}</span>;
}

const tr = (language: 'uz' | 'ru', uz: string, ru: string) => language === 'ru' ? ru : uz;

function NewsCover({ item, image, priority }: { item: NewsItem; image?: string; priority?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (!image || failed) return <div className="nf-cover nf-cover-empty" aria-hidden="true"><Megaphone size={26}/><span>ARNIY<b>GYM</b></span></div>;
  return <img className="nf-cover" src={image} alt="" width={1280} height={720} loading={priority ? 'eager' : 'lazy'} decoding="async" onError={() => setFailed(true)}/>;
}

function NewsMeta({ item }: { item: NewsItem }) {
  const { language } = useLanguage();
  return <div className="nf-meta">
    <span className={`nf-tag nf-tag-${item.category}`}>{categoryLabel(item.category, language)}</span>
    {item.is_pinned && <span className="nf-flag"><Pin size={11}/>{tr(language, 'Qadalgan', 'Закреплено')}</span>}
    {item.is_members_only && <span className="nf-flag nf-flag-members"><LockKeyhole size={11}/>{tr(language, 'A’zolar uchun', 'Для участников')}</span>}
    <time dateTime={newsDate(item)}><CalendarDays size={11}/>{dateLabel(newsDate(item), language)}</time>
  </div>;
}

function NewsCard({ item, onOpen, compact }: { item: NewsItem; onOpen: (id: string) => void; compact?: boolean }) {
  const { language } = useLanguage();
  const { images, isRead } = useNews();
  const text = localizedNews(item, language);
  const unread = isRecent(item) && !isRead(item.id);
  return <article className={`nf-card${item.is_pinned ? ' nf-pinned' : ''}${compact ? ' nf-compact' : ''}`}>
    <button type="button" className="nf-card-hit" onClick={() => onOpen(item.id)} aria-label={text.title}>
      <div className="nf-cover-wrap"><NewsCover item={item} image={images[item.id]}/>{unread && <span className="nf-dot">{tr(language, 'YANGI', 'НОВОЕ')}</span>}</div>
      <div className="nf-card-body"><NewsMeta item={item}/><h3>{text.title}</h3><p className="nf-excerpt">{text.body}</p></div>
    </button>
  </article>;
}

function StateBox({ kind, onRetry }: { kind: 'loading' | 'empty' | 'error' | 'config' | 'offline-empty'; onRetry?: () => void }) {
  const { language } = useLanguage();
  if (kind === 'loading') return <div className="nf-skeletons" role="status" aria-label={tr(language, 'Yangiliklar yuklanmoqda', 'Новости загружаются')}>{[0, 1, 2].map(index => <div className="nf-skeleton" key={index}><span/><i/><i/></div>)}</div>;
  const copy = {
    empty: [Bell, tr(language, 'Hozircha yangilik yo‘q', 'Пока нет новостей'), tr(language, 'Zal e’lonlari shu yerda chiqadi.', 'Объявления зала появятся здесь.')],
    error: [CircleAlert, tr(language, 'Yangiliklar yuklanmadi', 'Не удалось загрузить новости'), tr(language, 'Internet aloqasini tekshirib, qayta urinib ko‘ring.', 'Проверьте подключение и попробуйте снова.')],
    'offline-empty': [WifiOff, tr(language, 'Internet yo‘q', 'Нет подключения'), tr(language, 'Saqlangan yangiliklar topilmadi. Aloqa tiklangach qayta yuklanadi.', 'Сохранённых новостей нет. Обновим, когда появится сеть.')],
    config: [CircleAlert, tr(language, 'Server ulanmagan', 'Сервер не подключён'), tr(language, 'Yangiliklar uchun Supabase sozlamalari kerak.', 'Для новостей нужны настройки Supabase.')],
  }[kind];
  const [Icon, title, text] = copy as [typeof Bell, string, string];
  return <div className={`nf-state nf-state-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
    <span className="nf-state-icon"><Icon size={18}/></span><div><b>{title}</b><small>{text}</small></div>
    {onRetry && (kind === 'error' || kind === 'offline-empty') && <button type="button" className="nf-btn" onClick={onRetry}><RotateCcw size={14}/>{tr(language, 'Qayta urinish', 'Повторить')}</button>}
  </div>;
}

/** Compact block for the home page: three latest items and a link to the full feed. */
export function NewsSection({ onOpen, onAll }: { onOpen: (id: string) => void; onAll: () => void }) {
  const { language } = useLanguage();
  const { items, loading, error, reload, unread } = useNews();
  const latest = items.slice(0, 3);
  return <section className="news-section nf-home" id="yangiliklar" aria-labelledby="nf-home-title">
    <div className="nf-head">
      <div><div className="eyebrow muted"><Bell size={13}/> {tr(language, 'ZALDAN XABARLAR', 'НОВОСТИ ЗАЛА')}</div><h2 id="nf-home-title">{tr(language, 'Yangiliklar', 'Новости')}{unread > 0 && <span className="nf-count">{unread}</span>}</h2></div>
      <button type="button" className="link-arrow" onClick={onAll}>{tr(language, 'Barchasi', 'Все новости')} <ArrowRight size={15}/></button>
    </div>
    {loading && !items.length ? <StateBox kind="loading"/> : latest.length ? <div className="nf-grid">{latest.map(item => <NewsCard key={item.id} item={item} onOpen={onOpen} compact/>)}</div>
      : <StateBox kind={error === 'config' ? 'config' : error ? (navigator.onLine ? 'error' : 'offline-empty') : 'empty'} onRetry={reload}/>}
  </section>;
}

export function PushToggle({ signedIn, onAuth, notify }: { signedIn: boolean; onAuth: () => void; notify: (message: string) => void }) {
  const { language } = useLanguage();
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { let alive = true; pushState().then(value => alive && setState(value)).catch(() => alive && setState('unsupported')); return () => { alive = false; }; }, [signedIn]);
  if (!state || state === 'insecure') return null;
  const hint: Partial<Record<PushState, string>> = {
    unsupported: tr(language, 'Bu brauzer bildirishnomalarni qo‘llamaydi.', 'Этот браузер не поддерживает уведомления.'),
    'ios-install': tr(language, 'iPhone’da bildirishnoma uchun ArniyGym’ni bosh ekranga qo‘shing.', 'На iPhone добавьте ArniyGym на экран «Домой», чтобы получать уведомления.'),
    'not-configured': tr(language, 'Bildirishnomalar hali sozlanmagan.', 'Уведомления ещё не настроены.'),
    denied: tr(language, 'Bildirishnoma brauzer sozlamalarida bloklangan.', 'Уведомления заблокированы в настройках браузера.'),
  };
  if (hint[state]) return <p className="nf-push-hint"><BellSlash size={13}/>{hint[state]}</p>;
  const toggle = async () => {
    if (!signedIn) { onAuth(); return; }
    setBusy(true);
    try {
      const next = state === 'on' ? await disablePush() : await enablePush(language);
      setState(next);
      notify(next === 'on' ? tr(language, 'Yangiliklar haqida bildirishnoma yoqildi.', 'Уведомления о новостях включены.')
        : next === 'denied' ? tr(language, 'Ruxsat berilmadi. Brauzer sozlamalaridan yoqishingiz mumkin.', 'Разрешение не выдано. Его можно включить в настройках браузера.')
        : tr(language, 'Bildirishnoma o‘chirildi.', 'Уведомления отключены.'));
    } catch (error) {
      notify(error instanceof Error ? error.message : tr(language, 'Bildirishnoma yoqilmadi.', 'Не удалось включить уведомления.'));
    } finally { setBusy(false); }
  };
  return <button type="button" className={`nf-btn nf-push${state === 'on' ? ' nf-push-on' : ''}`} onClick={toggle} disabled={busy} aria-pressed={state === 'on'}>
    {state === 'on' ? <><Bell size={14}/>{tr(language, 'Bildirishnoma yoqilgan', 'Уведомления включены')}</> : <><BellSlash size={14}/>{signedIn ? tr(language, 'Bildirishnomani yoqish', 'Включить уведомления') : tr(language, 'Bildirishnoma uchun kiring', 'Войдите для уведомлений')}</>}
  </button>;
}

/** Full feed at /news and a detail view at /news/:id. */
export function NewsPage({ newsId, onOpen, onBack, onAuth, onPlans, notify }: {
  newsId: string | null; onOpen: (id: string) => void; onBack: () => void; onAuth: () => void; onPlans: () => void; notify: (message: string) => void;
}) {
  const { language } = useLanguage();
  const { items, images, loading, error, offline, reload, markRead, unread, isRead, signedIn } = useNews();
  const [filter, setFilter] = useState<NewsCategory | 'all'>('all');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const current = newsId ? items.find(item => item.id === newsId) || null : null;
  useEffect(() => { if (current) { markRead([current.id]); headingRef.current?.focus(); } }, [current?.id]);
  const visible = filter === 'all' ? items : items.filter(item => item.category === filter);
  const hasMembers = items.some(item => item.is_members_only);

  if (newsId) {
    if (loading && !current) return <section className="nf-page"><StateBox kind="loading"/></section>;
    if (!current) return <section className="nf-page"><button type="button" className="nf-back" onClick={onBack}><ArrowLeft size={15}/>{tr(language, 'Yangiliklar', 'Новости')}</button>
      <StateBox kind={error ? 'error' : 'empty'} onRetry={reload}/>
      <p className="nf-note">{tr(language, 'Yangilik o‘chirilgan, muddati tugagan yoki faqat faol a’zolar uchun bo‘lishi mumkin.', 'Новость удалена, устарела или доступна только активным участникам.')}</p></section>;
    const text = localizedNews(current, language);
    return <article className="nf-page nf-detail">
      <button type="button" className="nf-back" onClick={onBack}><ArrowLeft size={15}/>{tr(language, 'Barcha yangiliklar', 'Все новости')}</button>
      <div className="nf-detail-cover"><NewsCover item={current} image={images[current.id]} priority/></div>
      <NewsMeta item={current}/>
      <h1 ref={headingRef} tabIndex={-1}>{text.title}</h1>
      {!text.translated && <p className="nf-note">{tr(language, '', 'Перевод пока не добавлен — показан текст на узбекском.')}</p>}
      <div className="nf-body">{text.body}</div>
    </article>;
  }

  return <section className="nf-page" aria-labelledby="nf-title">
    <div className="nf-page-head">
      <div><div className="eyebrow"><i/>{tr(language, 'ZAL YANGILIKLARI', 'НОВОСТИ ЗАЛА')}</div><h1 id="nf-title">{tr(language, 'Yangiliklar', 'Новости')}</h1>
        <p>{tr(language, 'Jadval, aksiyalar, yangi jihozlar va zal e’lonlari.', 'Расписание, акции, новое оборудование и объявления зала.')}</p></div>
      <div className="nf-actions">
        <PushToggle signedIn={signedIn} onAuth={onAuth} notify={notify}/>
        {unread > 0 && <button type="button" className="nf-btn nf-btn-ghost" onClick={() => markRead(items.map(item => item.id))}><CheckAll size={15}/>{tr(language, 'Hammasini o‘qildi', 'Прочитать все')}</button>}
      </div>
    </div>
    {offline && <div className="nf-offline" role="status"><WifiOff size={14}/>{tr(language, 'Oflayn rejim: oxirgi saqlangan ommaviy yangiliklar ko‘rsatilmoqda.', 'Офлайн: показаны последние сохранённые публичные новости.')}</div>}
    <div className="nf-filters" role="tablist" aria-label={tr(language, 'Kategoriya', 'Категория')}>
      {(['all', ...NEWS_CATEGORIES] as const).map(value => <button key={value} role="tab" aria-selected={filter === value} className={filter === value ? 'nf-chip nf-chip-on' : 'nf-chip'} onClick={() => setFilter(value)}>
        {value === 'all' ? tr(language, 'Barchasi', 'Все') : categoryLabel(value, language)}
      </button>)}
    </div>
    {loading && !items.length ? <StateBox kind="loading"/> : visible.length ? <div className="nf-list">{visible.map(item => <NewsCard key={item.id} item={item} onOpen={onOpen}/>)}</div>
      : <StateBox kind={error === 'config' ? 'config' : error ? (navigator.onLine ? 'error' : 'offline-empty') : 'empty'} onRetry={reload}/>}
    {!hasMembers && !loading && <div className="nf-members-cta"><LockKeyhole size={16}/><div><b>{tr(language, 'A’zolar uchun e’lonlar', 'Объявления для участников')}</b>
      <small>{tr(language, 'Maxsus yangiliklar faqat amaldagi obunasi bor a’zolarga ko‘rinadi.', 'Специальные новости видны только участникам с активной подпиской.')}</small></div>
      <button type="button" className="nf-btn" onClick={signedIn ? onPlans : onAuth}>{signedIn ? tr(language, 'Tariflar', 'Тарифы') : tr(language, 'Kirish', 'Войти')}</button></div>}
    {items.length > 0 && items.every(item => isRead(item.id)) && <p className="nf-note">{tr(language, 'Barcha yangiliklar o‘qilgan.', 'Все новости прочитаны.')}</p>}
  </section>;
}

// Shared news model for the public PWA and the admin panel.
// Security notes:
// - Members-only rows are never trusted from the client: RLS returns them only when the
//   server-side has_active_subscription() check passes.
// - Public and members-only rows are fetched with separate queries. Only the public query
//   (is_members_only=eq.false) is matched by the service worker's offline cache.
import { supabase } from './supabase';

export type NewsCategory = 'general' | 'schedule' | 'promo' | 'equipment';
export type NewsLanguage = 'uz' | 'ru';
export type NewsItem = {
  id: string;
  title: string;
  title_ru: string | null;
  body: string;
  body_ru: string | null;
  category: NewsCategory;
  cover_image_url: string | null;
  image_path: string | null;
  image_bucket: 'news-images' | 'news-images-members' | null;
  published: boolean;
  is_pinned: boolean;
  is_members_only: boolean;
  publish_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  created_by?: string | null;
};

export const NEWS_COLUMNS = 'id,title,title_ru,body,body_ru,category,cover_image_url,image_path,image_bucket,published,is_pinned,is_members_only,publish_at,expires_at,created_at,updated_at';
export const NEWS_LIMITS = { title: 140, body: 3000, titleMin: 3, bodyMin: 3 } as const;
export const NEWS_CATEGORIES: NewsCategory[] = ['general', 'schedule', 'promo', 'equipment'];
const categoryText: Record<NewsCategory, Record<NewsLanguage, string>> = {
  general: { uz: 'Umumiy', ru: 'Общее' },
  schedule: { uz: 'Jadval', ru: 'Расписание' },
  promo: { uz: 'Aksiya', ru: 'Акция' },
  equipment: { uz: 'Jihozlar', ru: 'Оборудование' },
};
export const categoryLabel = (category: NewsCategory, language: NewsLanguage) => categoryText[category]?.[language] || categoryText.general[language];

/** Russian text falls back to the primary (Uzbek) text when the translation is empty. */
export function localizedNews(item: NewsItem, language: NewsLanguage) {
  const title = language === 'ru' && item.title_ru?.trim() ? item.title_ru : item.title;
  const body = language === 'ru' && item.body_ru?.trim() ? item.body_ru : item.body;
  return { title, body, translated: language === 'uz' || Boolean(item.title_ru?.trim() || item.body_ru?.trim()) };
}

export const newsDate = (item: NewsItem) => item.publish_at || item.created_at;
export function sortNews(items: NewsItem[]) {
  return [...items].sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || Date.parse(newsDate(b)) - Date.parse(newsDate(a)));
}
const UZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
/** Uzbek month names are formatted manually: many browsers ship without uz month data ("M11"). */
export function dateLabel(value: string, language: NewsLanguage) {
  const date = new Date(value);
  if (language === 'ru') return new Intl.DateTimeFormat('ru-RU', { timeZone: 'Asia/Tashkent', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Tashkent', day: 'numeric', month: 'numeric', year: 'numeric' })
    .formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.day}-${UZ_MONTHS[Number(parts.month) - 1]}, ${parts.year}`;
}

/** Only HTTPS images from this project's Supabase storage are rendered (matches the CSP). */
export function safeImageUrl(value: string | null | undefined) {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return '';
    const base = import.meta.env.VITE_SUPABASE_URL as string | undefined;
    if (base && new URL(base).host !== url.host) return '';
    return url.href;
  } catch { return ''; }
}

/** Resolves display URLs: public bucket → stored public URL; members bucket → short-lived signed URL. */
export async function resolveNewsImages(items: NewsItem[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  const members = items.filter(item => item.image_bucket === 'news-images-members' && item.image_path);
  for (const item of items) {
    if (item.image_bucket !== 'news-images-members') {
      const url = safeImageUrl(item.cover_image_url);
      if (url) result[item.id] = url;
    }
  }
  if (supabase && members.length) {
    const { data } = await supabase.storage.from('news-images-members').createSignedUrls(members.map(item => item.image_path!), 3600);
    for (const entry of data || []) {
      const owner = members.find(item => item.image_path === entry.path);
      if (owner && entry.signedUrl) result[owner.id] = entry.signedUrl;
    }
  }
  return result;
}

export type NewsLoad = { items: NewsItem[]; offline: boolean };
/** Public feed (offline-cacheable) plus, for signed-in users, the members-only feed (never cached). */
export async function fetchNewsFeed(signedIn: boolean): Promise<NewsLoad> {
  if (!supabase) throw new Error('Backend sozlanmagan. .env.local faylida Supabase URL va kalitini kiriting.');
  const publicQuery = supabase.from('gym_news').select(NEWS_COLUMNS)
    .eq('published', true).eq('is_members_only', false)
    .order('is_pinned', { ascending: false }).order('publish_at', { ascending: false, nullsFirst: false }).limit(40);
  const membersQuery = signedIn ? supabase.from('gym_news').select(NEWS_COLUMNS)
    .eq('published', true).eq('is_members_only', true)
    .order('is_pinned', { ascending: false }).order('publish_at', { ascending: false, nullsFirst: false }).limit(40) : null;
  const [pub, mem] = await Promise.all([publicQuery, membersQuery ?? Promise.resolve({ data: [], error: null })]);
  if (pub.error) throw new Error('Yangiliklarni yuklab bo‘lmadi.');
  const items = [...(pub.data || []), ...((mem && !mem.error && mem.data) || [])] as NewsItem[];
  const unique = [...new Map(items.map(item => [item.id, item])).values()];
  return { items: sortNews(unique), offline: typeof navigator !== 'undefined' && !navigator.onLine };
}

// ---------------- Read / unread state ----------------
const GUEST_KEY = 'arniygym-news-read:guest';
const UNREAD_WINDOW_DAYS = 45;
export const isRecent = (item: NewsItem) => Date.now() - Date.parse(newsDate(item)) < UNREAD_WINDOW_DAYS * 86400_000;

function readGuest(): Set<string> {
  try { const raw = JSON.parse(localStorage.getItem(GUEST_KEY) || '[]'); return new Set(Array.isArray(raw) ? raw.filter(value => typeof value === 'string') : []); }
  catch { return new Set(); }
}
function writeGuest(ids: Set<string>) {
  try { localStorage.setItem(GUEST_KEY, JSON.stringify([...ids].slice(-300))); } catch { /* storage disabled */ }
}

/** Signed-in users: rows in news_reads (RLS: own rows only). Guests: this browser's localStorage. */
export async function loadReadIds(userId: string | null, newsIds: string[]): Promise<Set<string>> {
  if (!userId) return readGuest();
  if (!supabase || !newsIds.length) return new Set();
  const { data, error } = await supabase.from('news_reads').select('news_id').eq('user_id', userId).in('news_id', newsIds);
  if (error) return new Set();
  return new Set((data || []).map(row => row.news_id as string));
}
export async function markNewsRead(userId: string | null, ids: string[]) {
  if (!ids.length) return;
  if (!userId) { const set = readGuest(); ids.forEach(id => set.add(id)); writeGuest(set); return; }
  if (!supabase) return;
  await supabase.from('news_reads').upsert(ids.map(news_id => ({ user_id: userId, news_id })), { onConflict: 'user_id,news_id', ignoreDuplicates: true });
}

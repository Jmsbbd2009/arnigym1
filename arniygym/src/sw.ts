/// <reference lib="webworker" />
// ArniyGym service worker.
// Offline policy:
//  - App shell (precached build assets) is always available.
//  - ONLY public news (REST query filtered by is_members_only=eq.false) and images from the
//    public "news-images" bucket are cached at runtime.
//  - Members-only news, signed URLs, receipts, protected video, Edge Functions and all other
//    API traffic are network-only and never written to a cache.
import { cleanupOutdatedCaches, createHandlerBoundToURL, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
self.addEventListener('install', () => { void self.skipWaiting(); });
self.addEventListener('activate', (event) => { event.waitUntil(self.clients.claim()); });

const PUBLIC_NEWS_CACHE = 'arniy-public-news-v1';
const NEWS_IMAGE_CACHE = 'arniy-news-images-v1';

// SPA navigations: try the network, fall back to the precached shell so cached news can render.
const shell = createHandlerBoundToURL('/index.html');
registerRoute(new NavigationRoute(async (options) => {
  try {
    const response = await fetch(options.request);
    if (response.ok || response.status < 500) return response;
    throw new Error('server error');
  } catch {
    return shell(options);
  }
}, { denylist: [/^\/sw\.js$/, /^\/workbox-/, /\.[a-z0-9]+$/i] }));

const isSupabase = (url: URL) => url.hostname.endsWith('.supabase.co') || url.hostname.endsWith('.supabase.in');

function isPublicNewsQuery(url: URL, request: Request) {
  if (request.method !== 'GET' || !isSupabase(url) || url.pathname !== '/rest/v1/gym_news') return false;
  return url.searchParams.getAll('is_members_only').includes('eq.false') && url.searchParams.getAll('published').includes('eq.true');
}
registerRoute(({ url, request }) => isPublicNewsQuery(url, request), new NetworkFirst({
  cacheName: PUBLIC_NEWS_CACHE,
  networkTimeoutSeconds: 4,
  plugins: [
    new CacheableResponsePlugin({ statuses: [200] }),
    new ExpirationPlugin({ maxEntries: 8, maxAgeSeconds: 7 * 24 * 60 * 60 }),
  ],
}));

registerRoute(({ url, request }) => request.method === 'GET' && isSupabase(url)
  && /^\/storage\/v1\/(object|render\/image)\/public\/news-images\/news\/[0-9a-f-]{36}\.webp$/.test(url.pathname),
new CacheFirst({
  cacheName: NEWS_IMAGE_CACHE,
  plugins: [
    new CacheableResponsePlugin({ statuses: [0, 200] }),
    new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true }),
  ],
}));

setCatchHandler(async ({ request }) => {
  if (request.destination === 'document') return (await matchPrecache('/offline.html')) || Response.error();
  return Response.error();
});

// ---------------- Web Push ----------------
type PushPayload = { title?: string; body?: string; url?: string; tag?: string; news_id?: string };
function sameOriginPath(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return '/';
  try { const url = new URL(value, self.location.origin); return url.origin === self.location.origin ? url.pathname + url.search : '/'; } catch { return '/'; }
}

self.addEventListener('push', (event) => {
  let data: PushPayload = {};
  try { data = event.data?.json() || {}; } catch { data = { body: event.data?.text() }; }
  const title = String(data.title || 'ArniyGym').slice(0, 120);
  const options: NotificationOptions & { renotify?: boolean } = {
    body: String(data.body || 'Zaldan yangi xabar.').slice(0, 240),
    icon: '/icon-192.png',
    badge: '/icon-192-maskable.png',
    tag: typeof data.tag === 'string' ? data.tag.slice(0, 64) : undefined,
    renotify: Boolean(data.tag),
    data: { url: sameOriginPath(data.url) },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = sameOriginPath(event.notification.data?.url);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if (new URL(client.url).origin !== self.location.origin) continue;
      await client.focus();
      if ('navigate' in client) { await (client as WindowClient).navigate(target).catch(() => client.postMessage({ type: 'navigate', url: target })); }
      return;
    }
    await self.clients.openWindow(target);
  })());
});

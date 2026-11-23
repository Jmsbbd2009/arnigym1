// Deploy base path helpers. The app can be served from a domain root ("/") or from a
// sub-path such as GitHub Pages project sites ("/arnygym/"). Vite sets BASE_URL from `base`.
export const BASE: string = import.meta.env.BASE_URL || '/';
// Public site base, used by the admin app for links that must open the member site (legal pages).
export const SITE_BASE: string = (import.meta.env.VITE_PUBLIC_SITE_BASE as string | undefined) || BASE;

const join = (base: string, path: string) => base.replace(/\/+$/, '/') + path.replace(/^\/+/, '');
/** "/news/1" -> "/arnygym/news/1" */
export const withBase = (path: string) => join(BASE, path);
export const withSiteBase = (path: string) => join(SITE_BASE, path);
/** "/arnygym/news/1" -> "/news/1" */
export function stripBase(pathname: string) {
  const base = BASE.replace(/\/+$/, '');
  if (base && (pathname === base || pathname.startsWith(base + '/'))) return pathname.slice(base.length) || '/';
  return pathname;
}

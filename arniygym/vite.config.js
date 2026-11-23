import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

function seoFiles() {
  let siteOrigin = '';
  return {
    name: 'arniygym-seo-files',
    config(_config, { mode }) {
      const configured = loadEnv(mode, process.cwd(), '').VITE_SITE_URL || '';
      try {
        const url = new URL(configured);
        if (url.protocol === 'https:' && !url.search && !url.hash) siteOrigin = url.origin + url.pathname.replace(/\/+$/, '');
      } catch { /* Local builds deliberately stay out of search indexes until a production origin is set. */ }
    },
    async closeBundle() {
      const output = resolve(process.cwd(), 'dist');
      await mkdir(output, { recursive: true });
      if (!siteOrigin) {
        await writeFile(resolve(output, 'robots.txt'), 'User-agent: *\nDisallow: /\n', 'utf8');
        return;
      }
      const paths = ['/', '/news', '/diet', '/workouts/shoulders', '/workouts/biceps', '/workouts/triceps', '/workouts/back', '/workouts/chest', '/workouts/legs', '/plans', '/about'];
      const urls = paths.map(path => `<url><loc>${siteOrigin}${path}</loc></url>`).join('');
      await writeFile(resolve(output, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`, 'utf8');
      await writeFile(resolve(output, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteOrigin}/sitemap.xml\n`, 'utf8');
      const indexPath = resolve(output, 'index.html');
      let html = await readFile(indexPath, 'utf8');
      html = html.replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${siteOrigin}/" />`)
        .replace(/<meta property="og:image" content="[^"]*" \/>/, `<meta property="og:image" content="${siteOrigin}/images/coach-bobur.webp" />`);
      await writeFile(indexPath, html, 'utf8');
    },
  };
}

// BASE_PATH lets the same build run at a domain root ("/") or a sub-path (GitHub Pages "/arnygym/").
const BASE = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');

export default defineConfig({
  base: BASE,
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', strategies: 'injectManifest', srcDir: 'src', filename: 'sw.ts', manifest: {
    id: BASE, name: 'ArniyGym', short_name: 'ArniyGym', description: 'Mashqlar, ovqatlanish va zal yangiliklari', categories: ['health', 'fitness', 'sports'], dir: 'ltr',
    lang: 'uz', scope: BASE, theme_color: '#09090B', background_color: '#09090B', display: 'standalone', display_override: ['standalone', 'minimal-ui'], orientation: 'portrait', start_url: BASE,
    icons: [
      { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: 'icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: 'icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
    ],
    shortcuts: [
      { name: 'Zal yangiliklari', short_name: 'Yangiliklar', url: 'news', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }] },
      { name: 'Mashqlar', short_name: 'Mashqlar', url: 'workouts/shoulders', icons: [{ src: 'icon-192.png', sizes: '192x192', type: 'image/png' }] }
    ]
  },
  injectManifest: { globPatterns: ['**/*.{js,css,html,svg,png,webp,woff,woff2}'], globIgnores: ['**/images/*.png'], maximumFileSizeToCacheInBytes: 3 * 1024 * 1024 },
  devOptions: { enabled: false }
  }), seoFiles()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/\/react(?:-dom)?\//.test(id)) return 'framework';
          if (/\/framer-motion\/|\/motion-dom\/|\/motion-utils\//.test(id)) return 'motion';
          if (/\/@supabase\//.test(id)) return 'supabase';
          if (/\/hls\.js\//.test(id)) return 'video';
          if (/\/tus-js-client\//.test(id)) return 'uploads';
        }
      }
    }
  }
});

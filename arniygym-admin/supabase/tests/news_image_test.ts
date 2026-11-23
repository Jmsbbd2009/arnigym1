// Run: deno test -A supabase/tests/news_image_test.ts
import { checkNewsImage, excerpt, sniffImage, webpSize } from '../functions/_shared/news.ts';
const read = (name: string) => Deno.readFileSync(new URL(`./fixtures/${name}`, import.meta.url));
const assert = (cond: unknown, msg: string) => { if (!cond) throw new Error(msg); };

Deno.test('accepts 16:9 lossy WebP', () => { const r = checkNewsImage(read('ok.webp'), 'image/webp'); assert(r.ok, JSON.stringify(r)); });
Deno.test('accepts 16:9 lossless WebP (VP8L)', () => { const r = checkNewsImage(read('alpha.webp'), 'image/webp'); assert(r.ok, JSON.stringify(r)); });
Deno.test('rejects non-16:9', () => assert(!checkNewsImage(read('square.webp'), 'image/webp').ok, 'square accepted'));
Deno.test('rejects JPEG declared as WebP', () => assert(!checkNewsImage(read('photo.jpg'), 'image/webp').ok, 'mismatch accepted'));
Deno.test('rejects raw JPEG (must be WebP)', () => { const r = checkNewsImage(read('photo.jpg'), 'image/jpeg'); assert(!r.ok && /WebP/.test(r.error), JSON.stringify(r)); });
Deno.test('rejects files over 2 MB', () => {
  const ok = read('ok.webp'); const big = new Uint8Array(2 * 1024 * 1024 + 1); big.set(ok);
  const r = checkNewsImage(big, 'image/webp'); assert(!r.ok && /2 MB/.test(r.error), JSON.stringify(r));
});
Deno.test('rejects SVG / other types', () => assert(!checkNewsImage(new TextEncoder().encode('<svg onload=alert(1)>'), 'image/svg+xml').ok, 'svg accepted'));
Deno.test('signature + dimensions', () => {
  assert(sniffImage(read('photo.jpg')) === 'image/jpeg', 'jpeg sniff');
  const size = webpSize(read('ok.webp')); assert(size?.width === 1280 && size?.height === 720, JSON.stringify(size));
});
Deno.test('push excerpt', () => { assert(excerpt('a  b\n\nc') === 'a b c', 'whitespace'); assert(excerpt('x'.repeat(300)).length === 140, 'length'); });

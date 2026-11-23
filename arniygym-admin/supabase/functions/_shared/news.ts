// Shared validation for ArniyGym news images and push payloads (Edge runtime).
export const NEWS_IMAGE_MAX_BYTES = 2 * 1024 * 1024;
export const NEWS_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const NEWS_BUCKETS = { public: 'news-images', members: 'news-images-members' } as const;
export const NEWS_PATH = /^news\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

const ascii = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));

/** Detects the real image type from the file signature, ignoring the declared MIME type. */
export function sniffImage(bytes: Uint8Array): (typeof NEWS_IMAGE_TYPES)[number] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return 'image/png';
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

/** Reads width/height from a WebP header (VP8, VP8L or VP8X). */
export function webpSize(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30) return null;
  const chunk = ascii(bytes, 12, 16);
  if (chunk === 'VP8X') return { width: 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)), height: 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16)) };
  if (chunk === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return { width: (bytes[26] | (bytes[27] << 8)) & 0x3fff, height: (bytes[28] | (bytes[29] << 8)) & 0x3fff };
  if (chunk === 'VP8L' && bytes[20] === 0x2f) {
    const bits = bytes[21] | (bytes[22] << 8) | (bytes[23] << 16) | (bytes[24] << 24);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

export type ImageCheck = { ok: true; width: number; height: number } | { ok: false; error: string };

/** Server-side check: declared MIME, real signature, size and a 16:9 WebP of sane dimensions. */
export function checkNewsImage(bytes: Uint8Array, declaredType: string): ImageCheck {
  if (!bytes.length) return { ok: false, error: 'Rasm fayli bo‘sh.' };
  if (bytes.length > NEWS_IMAGE_MAX_BYTES) return { ok: false, error: 'Rasm hajmi 2 MB dan oshmasligi kerak.' };
  if (!(NEWS_IMAGE_TYPES as readonly string[]).includes(declaredType)) return { ok: false, error: 'Faqat JPEG, PNG yoki WebP rasm qabul qilinadi.' };
  const real = sniffImage(bytes);
  if (!real || real !== declaredType) return { ok: false, error: 'Fayl turi uning ichidagi rasm imzosiga mos emas.' };
  if (real !== 'image/webp') return { ok: false, error: 'Rasm brauzerda WebP formatiga siqilgan bo‘lishi kerak.' };
  const size = webpSize(bytes);
  if (!size) return { ok: false, error: 'WebP rasm sarlavhasi o‘qilmadi.' };
  if (size.width < 320 || size.width > 1920 || size.height < 180 || size.height > 1080) return { ok: false, error: 'Rasm o‘lchami 320×180 dan 1920×1080 gacha bo‘lishi kerak.' };
  if (Math.abs(size.width / size.height - 16 / 9) > 0.02) return { ok: false, error: 'Rasm 16:9 nisbatda bo‘lishi kerak.' };
  return { ok: true, ...size };
}

export function excerpt(text: string, max = 140) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

// Browser-side image pipeline for admin news uploads:
// real MIME + file signature check → decode → centre-crop to 16:9 → WebP → final size check.
// The Edge Function (news-image) and the Storage bucket repeat the type/size checks server-side.
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const TARGET = { width: 1280, height: 720, minWidth: 320, minHeight: 180 };

export async function sniffImageType(file: Blob): Promise<string | null> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return 'image/png';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

export async function validateSourceImage(file: File): Promise<string | null> {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return 'Faqat JPEG, PNG yoki WebP rasm tanlang.';
  if (file.size > MAX_IMAGE_BYTES) return `Rasm hajmi 2 MB dan oshmasin (hozir ${(file.size / 1048576).toFixed(1)} MB).`;
  const real = await sniffImageType(file);
  if (!real) return 'Fayl haqiqiy rasm emas yoki buzilgan.';
  if (real !== file.type) return 'Fayl kengaytmasi/turi uning ichidagi rasm formatiga mos emas.';
  return null;
}

async function decode(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions); } catch { /* fall back below */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return image;
  } finally { URL.revokeObjectURL(url); }
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', quality));

/** Returns a 16:9 WebP (≤1280×720, ≤2 MB) or throws with a user-facing message. */
export async function prepareNewsImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const problem = await validateSourceImage(file);
  if (problem) throw new Error(problem);
  const source = await decode(file).catch(() => { throw new Error('Rasmni ochib bo‘lmadi.'); });
  const sw = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const sh = 'naturalHeight' in source ? source.naturalHeight : source.height;
  if (sw < TARGET.minWidth || sh < TARGET.minHeight) throw new Error('Rasm juda kichik: kamida 320×180 piksel bo‘lsin.');
  const ratio = 16 / 9;
  let cropW = sw, cropH = Math.round(sw / ratio);
  if (cropH > sh) { cropH = sh; cropW = Math.round(sh * ratio); }
  const sx = Math.round((sw - cropW) / 2), sy = Math.round((sh - cropH) / 2);
  const width = Math.min(TARGET.width, cropW - (cropW % 16));
  const height = Math.round(width / ratio);
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Brauzer rasmni qayta ishlay olmadi.');
  context.imageSmoothingQuality = 'high';
  context.drawImage(source as CanvasImageSource, sx, sy, cropW, cropH, 0, 0, width, height);
  if ('close' in source) source.close();
  let blob: Blob | null = null;
  for (const quality of [0.82, 0.72, 0.6, 0.5]) {
    blob = await toBlob(canvas, quality);
    if (!blob || blob.type !== 'image/webp') throw new Error('Bu brauzer WebP yarata olmaydi. Chrome, Edge yoki Firefox’ning yangi versiyasidan foydalaning.');
    if (blob.size <= 600 * 1024) break;
  }
  if (!blob || blob.size > MAX_IMAGE_BYTES) throw new Error('Siqilgan rasm hali ham 2 MB dan katta.');
  if ((await sniffImageType(blob)) !== 'image/webp') throw new Error('WebP fayl to‘g‘ri yaratilmadi.');
  return { blob, width, height };
}

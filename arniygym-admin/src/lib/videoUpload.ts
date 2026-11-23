import { Upload as TusUpload } from 'tus-js-client';
import { invoke } from './supabase';

type Ticket =
  | { provider: 'cloudflare'; uploadURL: string; uid: string }
  | { provider: 'supabase'; uid: string; signedUrl: string; maxBytes: number };

const TYPES: Record<string, string> = { mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime' };
const contentTypeOf = (file: File) => file.type || TYPES[file.name.split('.').pop()?.toLowerCase() || ''] || '';

/**
 * Uploads a workout/diet video and returns the id stored in *_media.stream_video_id.
 * Cloudflare Stream (TUS, up to 2 GB) when its keys are configured on the server,
 * otherwise the private Supabase Storage bucket (signed upload URL, up to 50 MB).
 */
export async function uploadVideo(file: File, title: string, onProgress: (percent: number) => void): Promise<string> {
  const contentType = contentTypeOf(file);
  const ticket = await invoke<Ticket>('admin-video-upload-url', { size: file.size, title, contentType });
  if (ticket.provider === 'supabase') {
    await new Promise<void>((resolve, reject) => {
      const form = new FormData();
      form.append('cacheControl', '3600');
      form.append('', new File([file], file.name, { type: contentType }));
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', ticket.signedUrl);
      xhr.setRequestHeader('x-upsert', 'false');
      xhr.upload.onprogress = (event) => { if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100)); };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Video saqlanmadi (${xhr.status}). Fayl hajmi ${Math.round(ticket.maxBytes / 1024 / 1024)} MB dan oshmasin.`)));
      xhr.onerror = () => reject(new Error('Internet aloqasi uzildi. Qayta urinib ko‘ring.'));
      xhr.send(form);
    });
    return ticket.uid;
  }
  await new Promise<void>((resolve, reject) => {
    const tus = new TusUpload(file, {
      uploadUrl: ticket.uploadURL, chunkSize: 50 * 1024 * 1024, retryDelays: [0, 1000, 3000, 5000],
      metadata: { filename: file.name, filetype: contentType },
      onError: reject, onProgress: (sent, total) => onProgress(Math.round((sent / total) * 100)), onSuccess: () => resolve(),
    });
    tus.start();
  });
  return ticket.uid;
}

import { createClient } from '@supabase/supabase-js';
import { BASE } from './base';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const backendReady = Boolean(url && key);
// The admin build sets VITE_ADMIN_APP=1: its session lives in sessionStorage only, so closing the tab
// (or opening the admin link later) always asks for password + Telegram 2FA again.
export const isAdminApp = import.meta.env.VITE_ADMIN_APP === '1';
const storage = typeof window === 'undefined' ? undefined : isAdminApp ? window.sessionStorage : window.localStorage;
export const supabase = backendReady ? createClient(url!, key!, {
  // Site and admin are served from the same origin (GitHub Pages sub-paths), so each app keeps its
  // session under its own storage key; otherwise an admin login would also sign in the member site.
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: !isAdminApp, storageKey: `arniygym-auth:${BASE}`, storage }
}) : null;

export async function invoke<T = any>(name: string, body?: unknown): Promise<T> {
  if (!supabase) throw new Error('Backend sozlanmagan. .env.example ni .env.local ga ko‘chirib, Supabase kalitlarini kiriting.');
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    try { const payload = await error.context?.json(); if (typeof payload?.error === 'string') throw new Error(payload.error); } catch (detail) { if (detail instanceof Error && detail.message !== 'Unexpected end of JSON input') throw detail; }
    throw new Error('So‘rov bajarilmadi. Ma’lumotlarni tekshirib, qayta urinib ko‘ring.');
  }
  return data as T;
}

export async function invokeWithHeaders<T = any>(name: string, body?: unknown, headers?: Record<string,string>): Promise<T> {
  if (!supabase) throw new Error('Backend sozlanmagan. .env.example ni .env.local ga ko‘chirib, Supabase kalitlarini kiriting.');
  const { data, error } = await supabase.functions.invoke(name, { body, headers });
  if (error) {
    try { const payload = await error.context?.json(); if (typeof payload?.error === 'string') throw new Error(payload.error); } catch (detail) { if (detail instanceof Error && detail.message !== 'Unexpected end of JSON input') throw detail; }
    throw new Error('So‘rov bajarilmadi. Ma’lumotlarni tekshirib, qayta urinib ko‘ring.');
  }
  return data as T;
}

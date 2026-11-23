// Web Push client helpers. A subscription is created only after the user clicks the button and
// the browser permission prompt is accepted; nothing is requested automatically.
import { invoke } from './supabase';

export type PushState = 'unsupported' | 'insecure' | 'ios-install' | 'not-configured' | 'denied' | 'off' | 'on';

const vapidKey = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined)?.trim() || '';
export const pushConfigured = /^[A-Za-z0-9_-]{80,100}$/.test(vapidKey);

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as any).standalone);

function base64UrlToBytes(value: string) {
  const padded = (value + '='.repeat((4 - (value.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}

async function registration() {
  if (!('serviceWorker' in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration()) || null;
}

export async function pushState(): Promise<PushState> {
  if (!window.isSecureContext) return 'insecure';
  // iOS/iPadOS deliver Web Push only to web apps added to the Home Screen (16.4+).
  if (isIos() && !isStandalone()) return 'ios-install';
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'unsupported';
  if (!pushConfigured) return 'not-configured';
  if (Notification.permission === 'denied') return 'denied';
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === 'granted' ? 'on' : 'off';
}

export async function enablePush(locale: 'uz' | 'ru'): Promise<PushState> {
  const state = await pushState();
  if (state !== 'off' && state !== 'on') return state;
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'off';
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const subscription = existing || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(vapidKey) });
  try {
    await invoke('push-subscribe', { subscription: subscription.toJSON(), consent: true, locale });
  } catch (error) {
    if (!existing) await subscription.unsubscribe().catch(() => undefined);
    throw error;
  }
  return 'on';
}

export async function disablePush(): Promise<PushState> {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await invoke('push-subscribe', { action: 'unsubscribe', endpoint: sub.endpoint }).catch(() => undefined);
    await sub.unsubscribe().catch(() => undefined);
  }
  return 'off';
}

/** Called when the signed-in account changes so a shared device stops receiving the previous user's pushes. */
export async function dropBrowserPushSubscription() {
  const reg = await registration().catch(() => null);
  const sub = await reg?.pushManager.getSubscription().catch(() => null);
  await sub?.unsubscribe().catch(() => undefined);
}

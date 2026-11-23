import { useEffect, useState } from 'react';
import { withBase } from '../lib/base';
import { Download, ShareIos, Plus, X } from './BootstrapIcons';
import { Modal } from './SupportModals';
import { useLanguage } from './Language';
import { isIos, isStandalone } from '../lib/push';
import './news.css';

type DeferredPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };
type Mode = 'prompt' | 'ios' | 'in-app' | null;

const KEY = 'arniygym-install-dismissed';
const SNOOZE_DAYS = 14;
const MAX_DISMISSALS = 2;

function dismissed(): boolean {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!value) return false;
    if (value.count >= MAX_DISMISSALS) return true;
    return Date.now() - Number(value.at || 0) < SNOOZE_DAYS * 86400_000;
  } catch { return false; }
}
function rememberDismissal() {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) || 'null') || { count: 0 };
    localStorage.setItem(KEY, JSON.stringify({ count: Number(value.count || 0) + 1, at: Date.now() }));
  } catch { /* storage disabled: the banner simply appears next visit */ }
}
// In-app browsers (Telegram, Instagram, Facebook, Android WebView) cannot install PWAs.
const inAppBrowser = () => /Instagram|FBAN|FBAV|FB_IAB|Line\/|Telegram|; wv\)/i.test(navigator.userAgent);
const iosSafari = () => isIos() && /Safari/i.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(navigator.userAgent);

/**
 * Install offer:
 * - Android/Chrome: keeps the beforeinstallprompt event and shows our own banner.
 * - iOS Safari: shows Share → Add to Home Screen steps (iOS has no install prompt API).
 * - In-app browsers: explains how to open the site in the real browser.
 * - Hidden when already running standalone, on insecure origins, or after the user dismissed it.
 */
export function InstallPWA() {
  const { language } = useLanguage();
  const tr = (uz: string, ru: string) => language === 'ru' ? ru : uz;
  const [deferred, setDeferred] = useState<DeferredPrompt | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [showSteps, setShowSteps] = useState(false);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    if (installed || !window.isSecureContext) return;
    const onPrompt = (event: Event) => { event.preventDefault(); setDeferred(event as DeferredPrompt); if (!dismissed()) setMode('prompt'); };
    const onInstalled = () => { setInstalled(true); setMode(null); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    const media = window.matchMedia('(display-mode: standalone)');
    const onDisplay = () => media.matches && onInstalled();
    media.addEventListener?.('change', onDisplay);
    // Give the visitor a moment with the page before offering anything.
    const timer = window.setTimeout(() => {
      if (dismissed()) return;
      if (inAppBrowser()) setMode(current => current || 'in-app');
      else if (iosSafari()) setMode(current => current || 'ios');
    }, 6000);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
      media.removeEventListener?.('change', onDisplay);
    };
  }, [installed]);

  if (installed || !mode) return null;
  const close = () => { rememberDismissal(); setMode(null); setShowSteps(false); };
  const install = async () => {
    if (mode !== 'prompt' || !deferred) { setShowSteps(true); return; }
    await deferred.prompt();
    const choice = await deferred.userChoice.catch(() => ({ outcome: 'dismissed' as const }));
    setDeferred(null);
    if (choice.outcome === 'accepted') setMode(null); else close();
  };

  const copy = {
    prompt: [tr('ArniyGym ilovasini telefonga o‘rnatish', 'Установить приложение ArniyGym'), tr('Bosh ekrandan bir bosishda oching, sust internetda ham ishlaydi.', 'Открывайте с главного экрана, работает и при слабом интернете.'), tr('O‘rnatish', 'Установить')],
    ios: [tr('ArniyGym’ni bosh ekranga qo‘shing', 'Добавьте ArniyGym на экран «Домой»'), tr('Safari’da Ulashish → “Bosh ekranga” orqali ilova kabi o‘rnating.', 'В Safari: «Поделиться» → «На экран Домой».'), tr('Qanday?', 'Как?')],
    'in-app': [tr('Brauzerda oching', 'Откройте в браузере'), tr('Ilovani o‘rnatish uchun sahifani Chrome yoki Safari’da oching.', 'Чтобы установить приложение, откройте страницу в Chrome или Safari.'), tr('Ko‘rsatma', 'Инструкция')],
  }[mode];

  return <>
    <aside className="pwa-install" role="dialog" aria-label={copy[0]}>
      <span className="pwa-install-icon"><img src={withBase('/icon-192.png')} alt="" width={28} height={28}/></span>
      <span className="pwa-install-copy"><b>{copy[0]}</b><small>{copy[1]}</small></span>
      <button type="button" className="nf-btn" onClick={install}><Download size={14}/>{copy[2]}</button>
      <button type="button" className="pwa-install-close" onClick={close} aria-label={tr('Keyinroq', 'Позже')}><X size={14}/></button>
    </aside>
    {showSteps && <Modal onClose={() => setShowSteps(false)}>
      <div className="eyebrow">ARNIYGYM / PWA</div>
      {mode === 'in-app' ? <>
        <h2>{tr('Sahifani brauzerda oching', 'Откройте страницу в браузере')}</h2>
        <ol className="pwa-steps">
          <li>{tr('Yuqoridagi ⋮ yoki ••• menyuni bosing.', 'Нажмите меню ⋮ или ••• вверху.')}</li>
          <li>{tr('“Brauzerda ochish” (Open in browser) ni tanlang.', 'Выберите «Открыть в браузере».')}</li>
          <li>{tr('Chrome yoki Safari’da o‘rnatish taklifi chiqadi.', 'В Chrome или Safari появится предложение установки.')}</li>
        </ol>
      </> : <>
        <h2>{tr('iPhone’da bosh ekranga qo‘shish', 'Добавление на iPhone')}</h2>
        <ol className="pwa-steps">
          <li><span>{tr('Safari pastidagi', 'Нажмите')} <ShareIos size={15}/> <b>{tr('Ulashish', 'Поделиться')}</b> {tr('tugmasini bosing.', 'внизу Safari.')}</span></li>
          <li><span><Plus size={14}/> <b>{tr('Bosh ekranga', 'На экран «Домой»')}</b> {tr('bandini tanlang.', '— выберите этот пункт.')}</span></li>
          <li><span>{tr('O‘ng yuqoridagi', 'Нажмите')} <b>{tr('Qo‘shish', 'Добавить')}</b> {tr('ni bosing.', 'в правом верхнем углу.')}</span></li>
        </ol>
        <p className="install-note">{tr('Bildirishnomalar iPhone’da faqat bosh ekranga qo‘shilgan ilovada ishlaydi (iOS 16.4+).', 'Уведомления на iPhone работают только в приложении с экрана «Домой» (iOS 16.4+).')}</p>
      </>}
    </Modal>}
  </>;
}

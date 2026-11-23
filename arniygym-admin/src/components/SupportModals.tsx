import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Droplets, LockKeyhole, Minus, Plus, X } from './BootstrapIcons';
import { supabase } from '../lib/supabase';

export function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => {
      dialog.current?.querySelector<HTMLElement>('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')?.focus();
    }, 0);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, []);

  const trapFocus = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Tab' || !dialog.current) return;
    const nodes = [...dialog.current.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],[tabindex]:not([tabindex="-1"])')]
      .filter(node => !node.hasAttribute('disabled'));
    if (!nodes.length) { event.preventDefault(); return; }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };

  return <div className="modal-overlay" role="presentation">
    <motion.div ref={dialog} role="dialog" aria-modal="true" tabIndex={-1} className="modal-card"
      initial={{ opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} onKeyDown={trapFocus}>
      {children}<button type="button" className="modal-x" aria-label="Oynani yopish" onClick={onClose}><X size={18}/></button>
    </motion.div>
  </div>;
}

export function InstallInstructions({ onClose }: { onClose: () => void }) {
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return <Modal onClose={onClose}>
    <div className="eyebrow">ARNIYGYM / PWA</div>
    <h2>Ilovani bosh ekranga qo‘shing.</h2>
    <p>ArniyGym’ni telefoningizdan tez ochish uchun brauzer menyusidan bosh ekranga qo‘shing.</p>
    <ol className="install-steps">
      {isIOS ? <><li>Safari brauzerida sahifaning <b>Ulashish</b> tugmasini bosing.</li><li><b>Bosh ekranga qo‘shish</b> bandini tanlang.</li><li><b>Qo‘shish</b>ni bosing.</li></>
        : <><li>Chrome brauzeridagi <b>⋮ menyu</b>ni oching.</li><li><b>Ilovani o‘rnatish</b> yoki <b>Bosh ekranga qo‘shish</b>ni tanlang.</li><li>Ochilgan oynada o‘rnatishni tasdiqlang.</li></>}
    </ol>
    <p className="install-note">O‘rnatish bandi ko‘rinmasa, sahifani HTTPS manzili orqali ochib, brauzer menyusini tekshiring.</p>
  </Modal>;
}

export function ProgressModal({ water, onWater, weights, onWeight, session, onAuth, onClose, notify }: {
  water: number; onWater: (delta: number) => void; weights: number[]; onWeight: (value: number) => void;
  session: any; onAuth: () => void; onClose: () => void; notify: (message: string) => void;
}) {
  const [input, setInput] = useState('');
  const min = weights.length ? Math.min(...weights) : 0;
  const max = weights.length ? Math.max(...weights) : 0;
  const points = weights.map((value, index) => {
    const x = weights.length === 1 ? 150 : index * (300 / (weights.length - 1));
    const y = weights.length === 1 ? 55 : 95 - ((value - min) / (max - min || 1)) * 72;
    return `${x},${y}`;
  }).join(' ');

  return <Modal onClose={onClose}>
    <div className="eyebrow">SENING PROGRESSING</div><h2>Izchillikni ko‘r.</h2>
    {!session && <div className="locked-banner"><LockKeyhole size={16}/> Profil ma’lumotlarini saqlash uchun kirish kerak. <button type="button" onClick={onAuth}>Kirish</button></div>}
    <div className="progress-chart">
      <div className="chart-top"><span>VAZN QAYDLARI</span><small>KG</small></div>
      {weights.length ? <><svg viewBox="0 0 300 110" preserveAspectRatio="none" role="img" aria-label={`${weights.length} ta qayd; oxirgi vazn ${weights[weights.length - 1]} kilogramm`}>
        {weights.length > 1 && <polyline points={points} fill="none" stroke="#ef4444" strokeWidth="3"/>}
        {weights.map((value, index) => { const x = weights.length === 1 ? 150 : index * (300 / (weights.length - 1)); const y = weights.length === 1 ? 55 : 95 - ((value - min) / (max - min || 1)) * 72; return <circle key={`${index}-${value}`} cx={x} cy={y} r="4" fill="#ef4444"/>; })}
        <text x="0" y="107" fill="#aaa" fontSize="10">1-qayd</text><text x="300" y="107" fill="#aaa" fontSize="10" textAnchor="end">{weights.length}-qayd</text>
      </svg><div className="chart-labels"><span>{weights.length} ta qayd</span><b>{weights[weights.length - 1]} kg</b><span>So‘nggi vazn</span></div></>
        : <p className="empty-state">Hali vazn yozuvi yo‘q. Birinchi natijangni kiritsang, grafik shu yerda boshlanadi.</p>}
      <small className="chart-disclaimer">Nuqtalar qaydlar ketma-ketligini ko‘rsatadi; ular orasidagi kunlar soni ko‘rsatilmagan.</small>
    </div>
    <form className="weight-form" onSubmit={event => { event.preventDefault(); const value = Number(input); if (value > 20 && value < 350) { onWeight(value); setInput(''); } else notify('Vaznni 20–350 kg oralig‘ida kiriting.'); }}>
      <label className="field-label">Bugungi vazn (kg)<input type="number" step="0.1" min="20.1" max="349.9" value={input} onChange={event => setInput(event.target.value)} placeholder="Masalan, 74.0"/></label>
      <button type="submit" className="btn-outline">Vazn qo‘shish <Plus size={14}/></button>
    </form>
    <div className="water-panel"><div><Droplets size={18}/><span><b>Suv nazorati</b><small>Kunlik maqsad: 8 stakan</small></span></div>
      <div className="water-count"><button type="button" aria-label="Bir stakan kamaytirish" onClick={() => onWater(-1)}><Minus size={14}/></button><b>{water}<small> / 8</small></b><button type="button" aria-label="Bir stakan qo‘shish" onClick={() => onWater(1)}><Plus size={14}/></button></div>
      <div className="water-track"><span style={{ width: `${Math.min(100, water / 8 * 100)}%` }}/></div>
    </div>
    {session && <button type="button" className="text-button logout" onClick={async () => { await supabase?.auth.signOut(); notify('Hisobdan chiqdingiz'); onClose(); }}>Hisobdan chiqish <Check size={14}/></button>}
  </Modal>;
}

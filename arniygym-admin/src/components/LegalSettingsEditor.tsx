import type React from 'react';
import { useEffect, useState } from 'react';
import { Check } from './BootstrapIcons';
import { supabase } from '../lib/supabase';

const fields = [
  ['operatorName', 'Yuridik nomi'], ['taxId', 'STIR'], ['address', 'Yuridik manzil'], ['phone', 'Aloqa telefoni'], ['email', 'Aloqa emaili'],
  ['phonePurpose', 'Telefon ma’lumotidan foydalanish maqsadi'], ['phoneRetention', 'Telefon ma’lumotini saqlash muddati va o‘chirish qoidasi'],
  ['healthPurpose', 'Sog‘liq / vazn / ovqatlanish ma’lumotidan foydalanish maqsadi'], ['healthRetention', 'Sog‘liq ma’lumotini saqlash muddati va o‘chirish qoidasi'],
  ['termsText', 'Ommaviy oferta / foydalanish shartlari'], ['privacyText', 'Maxfiylik siyosati'], ['refundText', 'Qaytarish va bekor qilish qoidalari'], ['renewalText', 'Avtomatik uzaytirish va to‘lov haqida ogohlantirish'],
] as const;

export function LegalSettingsEditor({ raw, onSaved, notify }: { raw: string; onSaved: (value: string) => void; notify: (message: string) => void }) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    try { const legal = JSON.parse(raw || '{}').legal || {}; setForm(Object.fromEntries(fields.map(([key]) => [key, legal[key] || '']))); setReady(legal.ready === true); }
    catch { setForm({}); setReady(false); }
  }, [raw]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!supabase) return notify('Supabase sozlanmagan.');
    const complete = fields.every(([key]) => String(form[key] || '').trim().length > 4);
    if (ready && !complete) return notify('Barcha huquqiy maydonlarni to‘ldirmasdan to‘lovni yoqib bo‘lmaydi.');
    setBusy(true);
    try {
      const content = JSON.parse(raw || '{}');
      const next = { ...content, legal: { ...form, ready: ready && complete, version: 'arniygym-terms-privacy-v1' } };
      const { error } = await supabase.from('about_content').upsert({ id: 1, content: next, updated_at: new Date().toISOString() });
      if (error) throw error;
      onSaved(JSON.stringify(next, null, 2));
      notify(ready && complete ? 'Huquqiy sozlamalar saqlandi; kirish va to‘lovlar yoqildi.' : 'Huquqiy matnlar saqlandi; kirish va to‘lovlar yopiq qoladi.');
    } catch { notify('Ma’lumotlar saqlanmadi. JSON formatini tekshiring.'); }
    finally { setBusy(false); }
  };
  return <form className="legal-settings" onSubmit={save}><div className="legal-status"><b>To‘lov va foydalanuvchi ro‘yxatini yoqishdan oldin aniq yuridik ma’lumotlarni kiriting va hujjatlarni yurist bilan tekshiring.</b></div>{fields.map(([key, label]) => <label className="field-label" key={key}>{label}{key.endsWith('Text') ? <textarea rows={key === 'privacyText' ? 7 : 5} value={form[key] || ''} onChange={(event) => setForm({ ...form, [key]: event.target.value })} required/> : <input value={form[key] || ''} onChange={(event) => setForm({ ...form, [key]: event.target.value })} required/>}</label>)}<label className="auth-consent"><input type="checkbox" checked={ready} onChange={(event) => setReady(event.target.checked)}/><span>Ma’lumotlar to‘g‘ri, hujjatlar ko‘rib chiqilgan, e’lon qilishga roziman.</span></label><button className="btn-red" disabled={busy}>{busy ? 'Saqlanmoqda…' : 'Huquqiy ma’lumotlarni saqlash'} <Check size={15}/></button></form>;
}

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
import { Camera, Check, ChevronRight, CircleAlert, ImagePlus, LockKeyhole, RotateCcw, Sparkles } from './BootstrapIcons';
import { invoke, supabase } from '../lib/supabase';
import { todayInTashkent } from '../lib/dates';
import './food-analyzer.css';

type IdentifiedFood = {
  name: string;
  clarification_required: boolean;
  clarification_question: string;
  confidence: number;
  grams: string;
  clarification: string;
};
type FoodResult = {
  nutrition: { name: string; calories: number; protein_g: number; fat_g: number; carbs_g: number; confidence: number };
  items: Array<{ name: string; grams: number; calories: number; protein_g: number; fat_g: number; carbs_g: number; confidence: number }>;
  remaining: number;
};
type Props = {
  session: any;
  notify: (message: string) => void;
  onAuth?: () => void;
  onPlans?: () => void;
  onLogged?: (nutrition: FoodResult['nutrition']) => void;
  compact?: boolean;
};

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
    reader.onerror = () => reject(new Error('Rasmni o‘qib bo‘lmadi.'));
    reader.readAsDataURL(file);
  });
}

export function FoodAnalyzer({ session, notify, onAuth, onPlans, onLogged, compact = false }: Props) {
  const [access, setAccess] = useState<'loading' | 'guest' | 'locked' | 'ready' | 'unconfigured'>('loading');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [items, setItems] = useState<IdentifiedFood[]>([]);
  const [result, setResult] = useState<FoodResult | null>(null);
  const [issue, setIssue] = useState('');
  const [busy, setBusy] = useState<'identify' | 'calculate' | ''>('');
  const [step, setStep] = useState<'upload' | 'review' | 'result'>('upload');
  const [aiConsent, setAiConsent] = useState(false);
  const [scanToken, setScanToken] = useState('');

  useEffect(() => {
    let alive = true;
    if (!supabase) { setAccess('unconfigured'); return; }
    if (!session?.user?.id) { setAccess('guest'); return; }
    const today = todayInTashkent();
    Promise.all([
      supabase.from('subscriptions').select('id').eq('user_id', session.user.id).in('status', ['active', 'on_trial', 'cancelled']).gt('current_period_end', new Date().toISOString()).limit(1),
      supabase.from('ai_usage_logs').select('scan_count').eq('user_id', session.user.id).eq('used_on', today).maybeSingle(),
    ]).then(([subscriptions, usage]) => {
      if (!alive) return;
      const active = !!subscriptions.data?.length;
      setAccess(active ? 'ready' : 'locked');
      setRemaining(active ? Math.max(0, 5 - Number(usage.data?.scan_count || 0)) : 0);
    }).catch(() => { if (alive) setAccess('locked'); });
    return () => { alive = false; };
  }, [session?.user?.id]);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const canCalculate = useMemo(() => items.length > 0 && items.every(item => {
    const grams = Number(item.grams);
    return Number.isFinite(grams) && grams > 0 && grams <= 10000 && (!item.clarification_required || item.clarification.trim().length > 0);
  }), [items]);

  const identify = async (image?: File) => {
    if (!image) return;
    if (!aiConsent) { setIssue('Rasm Google Gemini API’ga yuborilishini tasdiqlang.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(image.type) || image.size > 5 * 1024 * 1024) {
      setIssue('JPG, PNG yoki WebP formatida, 5 MB gacha rasm tanlang.');
      return;
    }
    if (access !== 'ready') return;
    if (remaining === 0) { setIssue('Bugungi 5 ta AI tahlil limiti tugadi.'); return; }
    setFile(image);
    setPreview(URL.createObjectURL(image));
    setItems([]); setResult(null); setIssue(''); setStep('upload'); setBusy('identify');
    try {
      const response = await invoke<{ items: Omit<IdentifiedFood, 'grams' | 'clarification'>[]; message?: string; remaining: number; scanToken: string }>('analyze-food', {
        action: 'identify', imageBase64: await toBase64(image), mediaType: image.type, disclosureAccepted: true,
      });
      setRemaining(response.remaining);
      setScanToken(response.scanToken || '');
      if (!response.items?.length) {
        setIssue(response.message || 'Taom aniqlanmadi. Yorug‘roq va yaqinroq rasm yuboring.');
        return;
      }
      setItems(response.items.map(item => ({ ...item, grams: '', clarification: '' })));
      setStep('review');
    } catch (error: any) {
      setIssue('So‘rov muvaffaqiyatsiz. Qayta urinib ko‘ring.');
    } finally { setBusy(''); }
  };

  const calculate = async () => {
    if (!file || !canCalculate || !scanToken || !aiConsent) return;
    setIssue(''); setBusy('calculate');
    try {
      const response = await invoke<FoodResult>('analyze-food', {
        action: 'calculate', imageBase64: await toBase64(file), mediaType: file.type,
        scanToken, disclosureAccepted: true,
        items: items.map(item => ({ name: item.name, grams: Number(item.grams), clarification: item.clarification.trim() })),
      });
      setResult(response); setRemaining(response.remaining); setStep('result');
      onLogged?.(response.nutrition);
      notify(`“${response.nutrition.name}” hisoblandi va kunlik balansga qo‘shildi.`);
    } catch (error: any) {
      setIssue('So‘rov muvaffaqiyatsiz. Qayta urinib ko‘ring.');
    } finally { setBusy(''); }
  };

  const reset = () => { setFile(null); setPreview(''); setItems([]); setResult(null); setScanToken(''); setIssue(''); setStep('upload'); };
  const updateItem = (index: number, key: 'grams' | 'clarification', value: string) => setItems(rows => rows.map((item, i) => i === index ? { ...item, [key]: value } : item));

  return <section className={`food-ai-card${compact ? ' food-ai-compact' : ''}`}>
    <div className="food-ai-heading">
      <span className="food-ai-icon"><Sparkles size={18}/></span>
      <div><div className="eyebrow muted">AI OVQAT TAHLILI</div><h3>Rasmni yukla — miqdorini aniqlaymiz.</h3><p>AI taomni ajratadi, porsiya grammiga qarab kaloriya va BJU ni hisoblaydi.</p></div>
      {access === 'ready' && <span className="food-ai-limit">Bugun: {remaining ?? '…'} / 5</span>}
    </div>

    {access === 'guest' && <div className="food-ai-gate"><LockKeyhole size={17}/><span>AI tahlili Premium obunada ishlaydi. Avval Telegram orqali kiring.</span><button className="btn-red" onClick={onAuth}>Kirish <ChevronRight size={14}/></button></div>}
    {access === 'locked' && <div className="food-ai-gate"><LockKeyhole size={17}/><span>Rasm bo‘yicha kaloriya hisobi faol Premium obunachilar uchun.</span><button className="btn-red" onClick={onPlans}>Tariflar <ChevronRight size={14}/></button></div>}
    {access === 'unconfigured' && <div className="food-ai-message"><CircleAlert size={16}/> AI tahlilini yoqish uchun Supabase va Gemini server sozlamalari kerak.</div>}
    {access === 'loading' && <div className="food-ai-message">Obuna holati tekshirilmoqda…</div>}

    {access === 'ready' && <>
      <label className="food-ai-consent"><input type="checkbox" checked={aiConsent} onChange={event => setAiConsent(event.target.checked)}/><span>Rasmim taomni aniqlash uchun Google Gemini API’ga yuborilishiga roziman. Kaloriya va BJU qiymatlari taxminiy, tibbiy maslahat emas.</span></label>
      <div className="food-ai-upload-row">
        {preview && <img className="food-ai-preview" src={preview} alt="Yuklangan taom rasmi"/>}
        <label className="btn-red food-ai-upload"><input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={!!busy || remaining === 0 || !aiConsent} onChange={(event: ChangeEvent<HTMLInputElement>) => { void identify(event.target.files?.[0]); event.target.value = ''; }}/>{busy === 'identify' ? 'Taom aniqlanmoqda…' : <>{preview ? <ImagePlus size={15}/> : <Camera size={15}/>} {preview ? 'Boshqa rasm' : 'Taom rasmini yuklash'}</>}</label>
        {preview && step !== 'result' && <button className="food-ai-reset" onClick={reset} disabled={!!busy}><RotateCcw size={14}/> Tozalash</button>}
      </div>
      {issue && <div className="food-ai-message"><CircleAlert size={16}/>{issue}</div>}

      {step === 'review' && <div className="food-ai-review">
        <div className="food-ai-subhead"><div><b>AI ko‘rgan mahsulotlar</b><small>Har bir porsiyaning gramm miqdorini kiriting.</small></div><span>{items.length} ta</span></div>
        {items.map((item, index) => <article className="food-ai-item" key={`${item.name}-${index}`}>
          <div className="food-ai-item-title"><span>{String(index + 1).padStart(2, '0')}</span><b>{item.name}</b><small>{Math.round(item.confidence * 100)}% ishonch</small></div>
          <label className="food-ai-input">Porsiya (gramm)<input type="number" inputMode="decimal" min="1" max="10000" value={item.grams} onChange={event => updateItem(index, 'grams', event.target.value)} placeholder="Masalan, 250"/></label>
          {item.clarification_required && <label className="food-ai-clarify"><span><CircleAlert size={14}/>{item.clarification_question || 'Mahsulot aniq ko‘rinmayapti. Nima ekanini yozing.'}</span><input value={item.clarification} onChange={event => updateItem(index, 'clarification', event.target.value)} placeholder="Javobingiz"/></label>}
        </article>)}
        <button className="btn-red food-ai-calculate" disabled={!canCalculate || !aiConsent || !scanToken || !!busy} onClick={() => void calculate()}>{busy === 'calculate' ? 'Hisoblanmoqda…' : <>Kaloriyani hisoblash <ChevronRight size={15}/></>}</button>
      </div>}

      {step === 'result' && result && <div className="food-ai-result">
        <div className="food-ai-result-head"><div><div className="eyebrow muted">TAOM HISOBI · TAXMINIY</div><h4>{result.nutrition.name}</h4></div><button className="food-ai-reset" onClick={reset}><RotateCcw size={14}/> Yangi tahlil</button></div>
        <div className="food-ai-total"><b>{result.nutrition.calories.toLocaleString('uz-UZ')} <small>kkal</small></b><span>Oqsil {result.nutrition.protein_g}g</span><span>Yog‘ {result.nutrition.fat_g}g</span><span>Uglevod {result.nutrition.carbs_g}g</span></div>
        <div className="food-ai-item-results">{result.items.map((item, index) => <div key={`${item.name}-${index}`}><span>{item.name} · {item.grams} g</span><b>{item.calories} kkal</b></div>)}</div>
        <p className="food-ai-disclaimer">Natija rasmdagi tarkib, retsept va porsiya miqdoriga asoslangan taxmin. Yog‘, sous yoki retseptdagi farqlar sabab haqiqiy kaloriya o‘zgarishi mumkin.</p>
        <div className="food-ai-saved"><Check size={15}/> Kunlik balansga yozildi · bugun yana {remaining} ta tahlil</div>
      </div>}
    </>}
  </section>;
}

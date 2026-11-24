import { useEffect, useState } from 'react';
import { ShieldCheck } from './BootstrapIcons';
import { supabase } from '../lib/supabase';

type Kind = 'terms' | 'privacy' | 'refund';
const labels: Record<Kind, string> = { terms: 'Foydalanish shartlari', privacy: 'Maxfiylik siyosati', refund: 'To‘lov va bekor qilish' };
const fields = ['operatorName', 'taxId', 'address', 'phone', 'email', 'phonePurpose','phoneRetention','healthPurpose','healthRetention','termsText', 'privacyText', 'refundText', 'renewalText'];

export function legalReady(legal: any) {
  return legal?.ready === true && fields.every((key) => typeof legal?.[key] === 'string' && legal[key].trim().length > 4);
}

export function LegalPage({ kind }: { kind: Kind }) {
  const [legal, setLegal] = useState<any>(null);
  useEffect(() => {
    let alive = true;
    supabase?.from('about_content').select('content').eq('id', 1).maybeSingle().then(({ data }) => {
      if (alive) setLegal(data?.content?.legal || null);
    });
    return () => { alive = false; };
  }, []);
  const key = kind === 'terms' ? 'termsText' : kind === 'privacy' ? 'privacyText' : 'refundText';
  const ready = legalReady(legal);
  const text: string = typeof legal?.[key] === 'string' ? legal[key].trim() : '';
  const operatorKnown = ['operatorName', 'taxId', 'address', 'phone', 'email'].every((f) => typeof legal?.[f] === 'string' && legal[f].trim().length > 2);
  const paras = (value: string) => value.split(/\n{2,}/).map((p, i) => <p key={i}>{p}</p>);
  return <section className="legal-page">
    <div className="eyebrow"><i /> ARNIYGYM / HUQUQIY MA’LUMOT</div>
    <h1>{labels[kind]}</h1>
    {!ready && <div className="legal-status" role="status"><ShieldCheck size={20}/><div><b>Hujjat yakuniy tasdiqlash bosqichida.</b><p>Operatorning yuridik ma’lumotlari kiritilib, hujjat tasdiqlanmaguncha ro‘yxatdan o‘tish va pullik to‘lovlar yopiq turadi.</p></div></div>}
    {operatorKnown && <div className="legal-operator"><p><b>{legal.operatorName}</b> · STIR: {legal.taxId}</p><p>{legal.address}</p><p>Aloqa: <a href={`tel:${legal.phone.replace(/[^+\d]/g, '')}`}>{legal.phone}</a> · <a href={`mailto:${legal.email}`}>{legal.email}</a></p></div>}
    {text ? <div className="legal-copy">{paras(text)}{kind === 'terms' && legal?.renewalText && <><h2>Uzaytirish va eslatmalar</h2>{paras(legal.renewalText)}</>}{kind === 'privacy' && legal?.phonePurpose && <><h2>Ma’lumotlardan foydalanish va saqlash muddati</h2><p><b>Telefon raqami.</b> {legal.phonePurpose} {legal.phoneRetention}</p><p><b>Sog‘liq va ovqatlanish ma’lumotlari.</b> {legal.healthPurpose} {legal.healthRetention}</p></>}</div>
      : <div className="legal-copy"><p>Hujjat matni hali kiritilmagan.</p></div>}
  </section>;
}

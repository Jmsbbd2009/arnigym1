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
  return <section className="legal-page">
    <div className="eyebrow"><i /> ARNIYGYM / HUQUQIY MA’LUMOT</div>
    <h1>{labels[kind]}</h1>
    {!ready && <div className="legal-status" role="status"><ShieldCheck size={20}/><div><b>Bu sahifa hozircha loyiha uchun shablon.</b><p>To‘lov yoqilishidan oldin operatorning yuridik nomi va STIRi, manzil va aloqa ma’lumotlari, qaytarish tartibi hamda yakuniy matnlar kiritilib, yurist bilan tekshirilishi kerak. Shuning uchun hozirda pullik to‘lovlar bloklangan.</p></div></div>}
    {ready ? <div className="legal-copy"><p>{legal.operatorName} · STIR: {legal.taxId}</p><p>{legal.address}</p><p>Aloqa: {legal.phone} · {legal.email}</p><p>{legal[key]}</p>{kind === 'terms' && <p>{legal.renewalText}</p>}{kind==='privacy'&&<><h2>Ma’lumotlardan foydalanish va saqlash</h2><p><b>Telefon:</b> {legal.phonePurpose} Saqlash muddati: {legal.phoneRetention}</p><p><b>Sog‘liq va ovqatlanish ma’lumotlari:</b> {legal.healthPurpose} Saqlash muddati: {legal.healthRetention}</p></>}</div> : <div className="legal-copy"><p>Bu hujjat yakuniy ommaviy oferta yoki qonuniy maslahat emas. Aniqlashtirilmagan biznes va ma’lumot saqlash tafsilotlari o‘rniga soxta ma’lumot qo‘yilmadi.</p>{kind === 'privacy' && <ul><li>Hisobga kirish uchun telefon raqami Telegram orqali tekshiriladi.</li><li>Profil sozlamalari yoqilganda vazn, suv, qadam va ovqat tahlili yozuvlari Supabase loyihasida saqlanadi.</li><li>AI taom rasmini tahlil qilish faqat rozilik berilganda Google Gemini xizmatiga yuboradi.</li><li>Chek yuklanganda u yopiq Supabase Storage maydonida saqlanadi; videolar Cloudflare Stream’dan uzatiladi.</li><li>Operator ma’lumotlardan foydalanish maqsadi va saqlash muddatini belgilamaguncha pullik kirish yoqilmaydi.</li></ul>}{kind === 'refund' && <p>Qaytarish, bekor qilish va P2P to‘lovini ko‘rib chiqish shartlari operator tomonidan to‘ldirilmaguncha pullik buyurtmalar qabul qilinmaydi.</p>}</div>}
  </section>;
}

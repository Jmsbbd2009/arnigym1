import { useEffect, useState } from 'react';
import { ArrowDown, ArrowRight, ArrowUpRight, Clock3, Dumbbell, Instagram, MapPin, ShieldCheck, Sparkles } from './BootstrapIcons';
import { NewsSection } from './News';
import { invoke, supabase } from '../lib/supabase';
import { useLanguage } from './Language';

type Props = { onAuth: () => void; onNavigate: (page: string) => void; onOpenNews?: (id: string | null) => void };
export function LandingPage({ onAuth, onNavigate, onOpenNews }: Props) {
  const { language } = useLanguage();
  const [content, setContent] = useState<any>({});
  const [prices,setPrices]=useState<any[]>([]),[showRequest,setShowRequest]=useState(false),[fullName,setFullName]=useState(''),[phone,setPhone]=useState(''),[note,setNote]=useState(''),[requestBusy,setRequestBusy]=useState(false),[requestMessage,setRequestMessage]=useState('');
  useEffect(() => {
    Promise.all([supabase?.from('about_content').select('content').eq('id', 1).maybeSingle(),supabase?.from('plan_prices').select('plan_key,title,title_ru,amount_usd,amount_uzs').eq('active',true).order('plan_key')]).then(([about,plans])=>{setContent(about?.data?.content||{});setPrices(plans?.data||[])});
  }, []);
  const sendIntro=async(event:React.FormEvent)=>{event.preventDefault();setRequestBusy(true);setRequestMessage('');try{const result=await invoke<{notificationPending:boolean}>('gym-intro-request',{fullName,phone,note});setRequestMessage(result.notificationPending?'Ariza qabul qilindi. Zal ma’muriyati panelida ko‘rinadi.':'Ariza yuborildi. Tez orada siz bilan bog‘lanamiz.');setFullName('');setPhone('');setNote('')}catch(error:any){setRequestMessage(error?.message||'Ariza yuborilmadi. Qayta urinib ko‘ring.')}finally{setRequestBusy(false)}};
  const safeUrl = (value: unknown) => {
    try { const url = new URL(String(value || '')); return ['http:', 'https:'].includes(url.protocol) ? url.toString() : ''; }
    catch { return ''; }
  };
  const locationUrl = safeUrl(content.locationUrl);
  const telegramUrl = safeUrl(content.telegram);
  const instagramUrl = safeUrl(content.instagram);
  const hasContact = Boolean(content.address || content.hours || content.phone || content.email || locationUrl || telegramUrl || instagramUrl);
  const structuredData = content.address || content.phone ? {
    '@context': 'https://schema.org', '@type': 'ExerciseGym', name: 'ArniyGym', url: window.location.origin,
    ...(content.address ? { address: { '@type': 'PostalAddress', streetAddress: content.address, addressCountry: 'UZ' } } : {}),
    ...(content.phone ? { telephone: content.phone } : {}), ...(content.email ? { email: content.email } : {}),
    sameAs: [telegramUrl, instagramUrl].filter(Boolean),
  } : null;
  const structuredJson = structuredData ? JSON.stringify(structuredData).replace(/</g, '\\u003c') : '';
  return <div className="public-landing">
    {structuredData && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredJson }}/>}
    <section className="landing-hero">
      <div className="landing-copy">
        <div className="eyebrow"><i/> ARNIYGYM / FITNES PLATFORMA</div>
        <h1>{language==='ru'?(content.heroTitleRu||'Сильное тело. Заметный результат.'):(content.heroTitle||<>Kuchli tana.<br/><span>Aniq natija.</span></>)}</h1>
        <p>{language==='ru'?(content.descriptionRu||'Тренировки по группам мышц, видеоуроки и питание с учётом вашей цели. Последовательный подход на каждом шаге.'):(content.description||'Mushak guruhlari bo‘yicha mashqlar, videodarslar va maqsadga mos ovqatlanish vositalari. Har bir qadamda izchil yondashuv.')}</p>
        <div className="landing-actions"><button className="btn-red" onClick={onAuth}>Kirish va boshlash <ArrowRight size={15}/></button>{locationUrl&&<a className="btn-quiet" href={locationUrl} target="_blank" rel="noreferrer">Zal manzili <ArrowUpRight size={14}/></a>}</div>
        <div className="landing-stats"><span><Dumbbell/><b>Mashqlar</b><small>MUSHAK GURUHLARI BO‘YICHA</small></span><span><Sparkles/><b>Ovqatlanish</b><small>MASSA YOKI OZISH MAQSADI</small></span><span><ShieldCheck/><b>Progress</b><small>O‘ZING QAYD ETGAN NATIJA</small></span></div>
      </div>
      <div className="landing-photo-wrap"><img className="landing-photo" src="/images/coach-bobur.webp" alt="Sport mashg‘ulotidan lavha" width="412" height="554" fetchPriority="high" decoding="async"/><div className="landing-photo-shade"/><div className="photo-tag"><span className="live-dot"/> ARNIYGYM <small>MASHG‘ULOTDAN</small></div><div className="photo-stamp">ARNIYGYM<br/><b>MASHG‘ULOTNI MAQSAD BILAN</b></div></div>
      <a className="landing-scroll" href="#zal-haqida">PASTGA O‘TING <ArrowDown size={13}/></a>
    </section>

    <section className="landing-feature-row" id="zal-haqida">
      <div className="landing-feature-copy"><div className="eyebrow muted">ZAL VA PLATFORMА</div><h2>Reja bilan shug‘ullan.<br/><i>Natijani o‘lcha.</i></h2><p>ArniyGym mashg‘ulotlarni, ovqatlanish qaydlarini va shaxsiy progressni bir joyda yuritishga yordam beradi.</p><div className="landing-benefits"><span><Dumbbell/> 6 mushak guruhi</span><span><Clock3/> Dam olish taymeri</span><span><Sparkles/> AI taom tahlili</span></div><button className="btn-outline" onClick={() => onNavigate('about')}>Biz haqimizda <ArrowRight size={14}/></button></div>
      <div className="coach-portrait-card"><img src="/images/coach-portrait.webp" alt="ArniyGym uchun taqdim etilgan portret" width="225" height="225" loading="lazy" decoding="async"/><div><small>ARNIYGYM / PORTRET</small><b>Mashg‘ulotdan lavha</b><span>Platforma materiallari</span></div></div>
    </section>

    <NewsSection onOpen={id => onOpenNews ? onOpenNews(id) : location.assign(`/news/${id}`)} onAll={() => onOpenNews ? onOpenNews(null) : location.assign('/news')}/>

    <section className="landing-plan-band"><div><div className="eyebrow"><i/> O‘ZINGGA MOS TARIFNI TANLA</div><h2>Bugun boshlagin.<br/><span>Izchil davom et.</span></h2><p>Oylik yoki yillik a’zolik orqali platformadagi mashq va ovqatlanish materiallariga ulan.</p></div><div className="landing-plan-actions"><button className="btn-red" onClick={() => onNavigate('plans')}>Tariflarni ko‘rish <ArrowRight size={15}/></button><button className="btn-outline" onClick={onAuth}>Kirish / ro‘yxatdan o‘tish</button></div></section>

    {Array.isArray(content.gallery)&&content.gallery.length>0&&<section className="gym-landing-section"><div className="eyebrow muted">ARNIYGYM / GALEREYA</div><h2>Zaldan lavhalar.</h2><div className="gym-gallery">{content.gallery.map((item:any,index:number)=><img key={item.path||item.url||index} src={safeUrl(item.url)} alt={item.alt||'ArniyGym zalidan surat'} loading="lazy"/>)}</div></section>}
    {Array.isArray(content.coaches)&&content.coaches.length>0&&<section className="gym-landing-section"><div className="eyebrow muted">ARNIYGYM / JAMOA</div><h2>{language==='ru'?(content.teamTitleRu||'Тренеры'):(content.teamTitle||'Murabbiylar')}</h2><div className="gym-landing-grid">{content.coaches.map((coach:any,index:number)=><article className="gym-landing-card" key={`${coach.name}-${index}`}><h3>{coach.name}</h3><p><b>{language==='ru'?(coach.roleRu||coach.role):coach.role}</b></p>{(language==='ru'?(coach.bioRu||coach.bio):coach.bio)&&<p>{language==='ru'?(coach.bioRu||coach.bio):coach.bio}</p>}</article>)}</div></section>}
    {Array.isArray(content.testimonials)&&content.testimonials.length>0&&<section className="gym-landing-section"><div className="eyebrow muted">ARNIYGYM / FIKRLAR</div><h2>{language==='ru'?'Отзывы участников':'Mijozlar fikri.'}</h2><div className="gym-landing-grid">{content.testimonials.map((review:any,index:number)=><article className="gym-landing-card" key={`${review.name}-${index}`}><p className="gym-review-stars">★★★★★</p><p>“{language==='ru'?(review.textRu||review.text):review.text}”</p><h3>{review.name}</h3>{review.context&&<small>{review.context}</small>}</article>)}</div></section>}
    {Array.isArray(content.faqs)&&content.faqs.length>0&&<section className="gym-landing-section"><div className="eyebrow muted">ARNIYGYM / SAVOL-JAVOB</div><h2>{language==='ru'?'Частые вопросы':'Ko‘p so‘raladi.'}</h2>{content.faqs.map((faq:any,index:number)=><details className="gym-faq" key={`${faq.question}-${index}`}><summary>{language==='ru'?(faq.questionRu||faq.question):faq.question}</summary><p>{language==='ru'?(faq.answerRu||faq.answer):faq.answer}</p></details>)}</section>}
    {prices.length>0&&<section className="gym-landing-section"><div className="eyebrow muted">ARNIYGYM / NARXLAR</div><h2>Tariflar.</h2><div className="gym-landing-grid">{prices.map(row=><article className="gym-landing-card" key={row.plan_key}><h3>{language==='ru'?(row.title_ru|| (row.plan_key==='yearly'?'Годовое членство':'Месячное членство')):(row.title|| (row.plan_key==='yearly'?'Yillik a’zolik':'Oylik a’zolik'))}</h3><p><b>{Number(row.amount_uzs)>0?`${Number(row.amount_uzs).toLocaleString('uz-UZ')} so‘m`:''}</b>{Number(row.amount_uzs)>0&&Number(row.amount_usd)>0?' · ':''}<b>{Number(row.amount_usd)>0?`$${Number(row.amount_usd).toFixed(2)}`:''}</b></p><small>{row.plan_key==='yearly'?(language==='ru'?'12 месяцев':'12 oy'):(language==='ru'?'1 месяц':'1 oy')}</small></article>)}</div><button className="btn-outline" onClick={()=>onNavigate('plans')}>Tarifga ulanish <ArrowRight size={14}/></button></section>}
    <section className="gym-landing-section gym-first-session"><div><div className="eyebrow muted">ARNIYGYM / BIRINCHI MASHG‘ULOT</div><h2>Zal bilan tanishing.</h2><p>Ism va telefon raqamingizni qoldiring. Administrator siz bilan bog‘lanadi.</p></div><button className="btn-red" onClick={()=>setShowRequest(value=>!value)}>{showRequest?'Arizani yopish':'Birinchi mashg‘ulotga yozilish'} <ArrowRight size={14}/></button>{showRequest&&<form className="gym-intro-form" onSubmit={sendIntro}><label className="field-label">Ismingiz<input required minLength={2} maxLength={120} value={fullName} onChange={event=>setFullName(event.target.value)} placeholder="Ism familiya"/></label><label className="field-label">Telefon<input required type="tel" inputMode="tel" pattern="\+[1-9][0-9]{7,14}" value={phone} onChange={event=>setPhone(event.target.value)} placeholder="+998901234567"/></label><label className="field-label">Izoh (ixtiyoriy)<textarea maxLength={500} rows={2} value={note} onChange={event=>setNote(event.target.value)} placeholder="Qulay vaqt yoki savol"/></label><button className="btn-red" disabled={requestBusy}>{requestBusy?'Yuborilmoqda…':'Arizani yuborish'}</button>{requestMessage&&<p role="status">{requestMessage}</p>}</form>}</section>

    <section className="landing-contact"><div><div className="eyebrow muted">ARNIYGYM MANZIL VA ALOQA</div><h2>Ko‘rishguncha<br/><i>zalda.</i></h2></div>{hasContact?<div className="contact-links">
      {content.address&&<div className="contact-info"><MapPin/><span><b>Manzil</b><small>{content.address}</small></span>{locationUrl&&<a href={locationUrl} target="_blank" rel="noreferrer" aria-label="Manzilni xaritada ochish"><ArrowUpRight/></a>}</div>}
      {content.hours&&<div className="contact-info"><Clock3/><span><b>Ish vaqti</b><small>{content.hours}</small></span></div>}
      {content.phone&&<a href={`tel:${String(content.phone).replace(/[^+\d]/g,'')}`}><span className="contact-letter">TEL</span><span><b>Telefon</b><small>{content.phone}</small></span><ArrowUpRight/></a>}
      {content.email&&<a href={`mailto:${String(content.email).trim()}`}><span className="contact-letter">@</span><span><b>Email</b><small>{content.email}</small></span><ArrowUpRight/></a>}
      {telegramUrl&&<a href={telegramUrl} target="_blank" rel="noreferrer"><span className="contact-letter">TG</span><span><b>Telegram</b><small>Rasmiy kanal</small></span><ArrowUpRight/></a>}
      {instagramUrl&&<a href={instagramUrl} target="_blank" rel="noreferrer"><Instagram/><span><b>Instagram</b><small>Rasmiy sahifa</small></span><ArrowUpRight/></a>}
    </div>:<p className="contact-empty">Zal manzili, ish vaqti va aloqa ma’lumotlari admin tomonidan kiritilgach shu yerda ko‘rinadi.</p>}</section>
  </div>;
}

import type React from 'react';
import { useEffect, useState } from 'react';
import { invoke, supabase } from '../lib/supabase';

type Props = { session: any; notify: (message: string) => void };
const localDate = (value?: string | null) => value ? new Date(value).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent', dateStyle: 'medium' }) : '—';

export function ProfileBilling({ session, notify }: Props) {
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [automatedPayments, setAutomatedPayments] = useState<any[]>([]);
  const [confirmPhone, setConfirmPhone] = useState('');
  const [busy, setBusy] = useState('');
  const refresh = async () => {
    if (!supabase || !session?.user?.id) return;
    const [s, p, a] = await Promise.all([
      supabase.from('subscriptions').select('id,source,plan_key,status,current_period_end,provider_subscription_id,created_at').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('p2p_payments').select('id,amount_uzs,plan_key,status,created_at,reviewed_at,admin_note').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('payment_orders').select('id,provider,plan_key,amount_uzs,amount_usd,refunded_amount_usd,currency,status,created_at,paid_at').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(20),
    ]);
    if (s.error || p.error || a.error) notify('Obuna yoki to‘lovlar tarixi yuklanmadi.');
    setSubscriptions(s.data || []);
    setPayments(p.data || []);
    setAutomatedPayments(a.data || []);
  };
  useEffect(() => { void refresh(); }, [session?.user?.id]);
  const cancel = async (id: string) => {
    setBusy(id);
    try { await invoke('lemonsqueezy-cancel', { subscriptionId: id }); await refresh(); notify('Bekor qilish so‘rovi yuborildi. Joriy to‘langan muddat tugaguncha kirish saqlanadi.'); }
    catch { notify('Obunani bekor qilib bo‘lmadi. Keyinroq qayta urinib ko‘ring.'); }
    finally { setBusy(''); }
  };
  const exportData = async () => {
    setBusy('export');
    try {
      const content = await invoke<Record<string, unknown>>('export-user-data');
      const file = new Blob([JSON.stringify(content, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(file); const link = document.createElement('a');
      link.href = url; link.download = `arniygym-malumotlar-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url);
      notify('Shaxsiy ma’lumotlar eksport qilindi.');
    } catch (error: any) { notify(error?.message || 'Ma’lumotlar eksport qilinmadi.'); }
    finally { setBusy(''); }
  };
  const removeAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    const phone = session?.user?.user_metadata?.phone_e164;
    if (!phone || confirmPhone.trim() !== phone) return notify('Tasdiqlash uchun hisobingizdagi telefon raqamini kiriting.');
    setBusy('delete');
    try { await invoke('account-delete', { confirmPhone }); await supabase?.auth.signOut(); notify('Hisob va unga bog‘langan profil ma’lumotlari o‘chirildi.'); }
    catch { notify('Hisobni o‘chirishdan oldin faol obunani bekor qiling yoki muddati tugashini kuting.'); }
    finally { setBusy(''); }
  };
  return <section className="profile-billing">
    <div className="profile-identity"><span>Hisob telefon raqami</span><b>{session?.user?.user_metadata?.phone_e164 || '—'}</b><small>Foydalanuvchi ID: {session?.user?.id}</small></div>
    <h3>Obuna va to‘lovlar</h3>
    {subscriptions.length ? subscriptions.map((item) => <article className="billing-row" key={item.id}><div><b>{item.plan_key === 'yearly' ? 'Yillik PRO' : 'Oylik PRO'} · {item.source === 'p2p' ? 'P2P' : item.source === 'manual' ? 'Admin bergan' : 'Lemon Squeezy'}</b><small>{item.status} · {localDate(item.current_period_end)} gacha</small></div>{item.source === 'lemon_squeezy' && ['active', 'on_trial'].includes(item.status) && Date.parse(item.current_period_end || '') > Date.now() && <button className="btn-outline" disabled={busy === item.id} onClick={() => void cancel(item.provider_subscription_id)}>{busy === item.id ? 'Yuborilmoqda…' : 'Obunani bekor qilish'}</button>}</article>) : <p className="empty-state">Hali obuna qaydi yo‘q.</p>}
    <h4>Avtomatik to‘lov tarixi</h4>
    {automatedPayments.length ? automatedPayments.map((item) => <article className="billing-row" key={item.id}><div><b>{item.plan_key === 'yearly' ? 'Yillik PRO' : 'Oylik PRO'} · {item.currency === 'USD' ? `$${Number(item.amount_usd || 0).toFixed(2)}` : `${Number(item.amount_uzs || 0).toLocaleString('uz-UZ')} so‘m`}</b><small>{item.provider === 'payme' ? 'Payme' : 'Lemon Squeezy'} · {item.status}{Number(item.refunded_amount_usd||0)>0?` · $${Number(item.refunded_amount_usd).toFixed(2)} qaytarilgan`:''} · {localDate(item.paid_at || item.created_at)}</small></div></article>) : <p className="empty-state">Hali avtomatik to‘lov tarixi yo‘q.</p>}
    <h4>P2P chek tarixi</h4>
    <p className="billing-note">P2P orqali olingan a’zolik avtomatik uzaytirilmaydi. Muddati tugaganda yangi to‘lovni o‘zingiz yuborasiz.</p>
    {payments.length ? payments.map((item) => <article className="billing-row" key={item.id}><div><b>{item.plan_key === 'yearly' ? 'Yillik' : 'Oylik'} · {Number(item.amount_uzs).toLocaleString('uz-UZ')} so‘m</b><small>{item.status} · {localDate(item.created_at)}</small></div></article>) : <p className="empty-state">Yuborilgan chek yo‘q.</p>}
    <div className="privacy-export"><div><b>Shaxsiy ma’lumotlaringiz nusxasi</b><small>Profil, to‘lov, vazn, ovqatlanish va mashg‘ulot qaydlarini yuklab oling.</small></div><button className="btn-outline" disabled={busy==='export'} onClick={()=>void exportData()}>{busy==='export'?'Tayyorlanmoqda…':'Ma’lumotlarni eksport qilish'}</button></div>
    {session?.user?.user_metadata?.phone_e164 && <form className="account-delete" onSubmit={removeAccount}><h4>Hisobni o‘chirish</h4><p>Profil ma’lumotlari o‘chiriladi. Faol obuna muddati tugamaguncha hisobni o‘chirib bo‘lmaydi.</p><label className="field-label">Tasdiqlash uchun telefon<input type="tel" value={confirmPhone} onChange={(event) => setConfirmPhone(event.target.value)} placeholder={session.user.user_metadata.phone_e164} required/></label><button className="btn-outline" disabled={busy === 'delete'}>{busy === 'delete' ? 'O‘chirilmoqda…' : 'Hisobni va ma’lumotlarni o‘chirish'}</button></form>}
  </section>;
}

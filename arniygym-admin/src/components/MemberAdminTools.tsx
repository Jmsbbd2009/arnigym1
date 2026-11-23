import { useState } from 'react';
import { PersonPlus, Search } from './BootstrapIcons';
import { supabase } from '../lib/supabase';

type Member = { auth_user_id: string; display_name: string; phone_e164: string };

export function MemberAdminTools({ notify, onGrant }: { notify: (message: string) => void; onGrant: (row: any) => void }) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<Member[]>([]);
  const [selected, setSelected] = useState<Member | null>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [automatedPayments, setAutomatedPayments] = useState<any[]>([]);
  const [device, setDevice] = useState<any>(null);
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [busy, setBusy] = useState(false);

  const search = async () => {
    if (!supabase || query.trim().length < 2) return notify('Ism yoki telefon raqamidan kamida 2 ta belgi kiriting.');
    setBusy(true);
    try {
      const term = query.trim();
      const digits = term.replace(/\D/g, '');
      const searches = [supabase.from('members').select('auth_user_id,display_name,phone_e164').ilike('display_name', `%${term}%`).limit(20)];
      if (digits.length >= 4) searches.push(supabase.from('members').select('auth_user_id,display_name,phone_e164').ilike('phone_e164', `%${digits}%`).limit(20));
      const found = await Promise.all(searches);
      const merged = new Map<string, Member>();
      found.forEach(result => (result.data || []).forEach((row: any) => { if (row.auth_user_id) merged.set(row.auth_user_id, row); }));
      setMatches([...merged.values()]);
      setSelected(null);
      if (!merged.size) notify('Mos a’zo topilmadi.');
    } catch { notify('A’zolarni qidirib bo‘lmadi. Qayta urinib ko‘ring.'); }
    finally { setBusy(false); }
  };

  const choose = async (member: Member) => {
    if (!supabase) return;
    setSelected(member);
    setBusy(true);
    try {
      const [s, p, a, d] = await Promise.all([
        supabase.from('subscriptions').select('id,source,plan_key,status,current_period_end,created_at').eq('user_id', member.auth_user_id).order('created_at', { ascending: false }).limit(20),
        supabase.from('p2p_payments').select('id,amount_uzs,plan_key,status,created_at,reviewed_at').eq('user_id', member.auth_user_id).order('created_at', { ascending: false }).limit(20),
        supabase.from('payment_orders').select('id,provider,amount_uzs,amount_usd,refunded_amount_usd,currency,plan_key,status,created_at,paid_at').eq('user_id', member.auth_user_id).order('created_at', { ascending: false }).limit(20),
        supabase.from('active_devices').select('device_label,updated_at').eq('user_id', member.auth_user_id).maybeSingle(),
      ]);
      setSubscriptions(s.data || []);
      setPayments(p.data || []);
      setAutomatedPayments(a.data || []);
      setDevice(d.data || null);
      if (s.error || p.error || a.error || d.error) notify('A’zo tarixi to‘liq yuklanmadi.');
    } catch { notify('A’zo ma’lumotlarini yuklab bo‘lmadi.'); }
    finally { setBusy(false); }
  };

  const grant = async () => {
    if (!supabase || !selected) return;
    setBusy(true);
    try {
      const now = Date.now();
      const existingEnd = subscriptions
        .filter(row => ['active', 'on_trial', 'cancelled'].includes(row.status) && Date.parse(row.current_period_end || '') > now)
        .reduce((latest, row) => Math.max(latest, Date.parse(row.current_period_end)), now);
      const periodEnd = new Date(existingEnd + (plan === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase.from('subscriptions').insert({
        user_id: selected.auth_user_id, source: 'manual', provider_subscription_id: `manual:${crypto.randomUUID()}`,
        plan_key: plan, status: 'active', current_period_end: periodEnd,
      }).select().single();
      if (error) throw error;
      setSubscriptions(rows => [data, ...rows]);
      onGrant(data);
      notify('A’zoga qo‘lda berilgan muddat qo‘shildi.');
    } catch { notify('A’zolik muddatini berib bo‘lmadi.'); }
    finally { setBusy(false); }
  };

  return <section className="member-admin-tools">
    <div className="admin-table-top"><div><div className="eyebrow muted">A’ZO QIDIRISH</div><h3>Ism yoki telefon bo‘yicha topish</h3></div></div>
    <div className="member-search"><input value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void search(); }} placeholder="Ism yoki telefon raqami"/><button className="btn-outline" onClick={() => void search()} disabled={busy}><Search size={15}/> Qidirish</button></div>
    {matches.length > 0 && <div className="member-search-results">{matches.map(member => <button key={member.auth_user_id} className={selected?.auth_user_id === member.auth_user_id ? 'member-selected' : ''} onClick={() => void choose(member)}><b>{member.display_name || 'Ismi kiritilmagan'}</b><span>{member.phone_e164}</span></button>)}</div>}
    {selected && <div className="member-detail"><div><b>{selected.display_name || 'A’zo'}</b><span>{selected.phone_e164}</span><small>{selected.auth_user_id}</small></div>
      <div className="member-grant"><label className="field-label">Qo‘lda beriladigan tarif<select value={plan} onChange={event => setPlan(event.target.value as 'monthly' | 'yearly')}><option value="monthly">30 kun</option><option value="yearly">365 kun</option></select></label><button className="btn-red" disabled={busy} onClick={() => void grant()}><PersonPlus size={15}/> Muddat qo‘shish</button></div>
      <small className="member-manual-note">Bu qo‘lda berilgan a’zolik; avtomatik to‘lov yoki uzaytirish qilinmaydi.</small>
      <h4>Faol qurilma</h4><div className="member-history-row">{device ? `${device.device_label || 'Noma’lum qurilma'} · ${new Date(device.updated_at).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}` : 'Faol qurilma sessiyasi topilmadi.'}</div>
      <h4>Obunalar</h4>{subscriptions.length ? subscriptions.map(row => <div className="member-history-row" key={row.id}>{row.source} · {row.plan_key} · {row.status} · {row.current_period_end ? new Date(row.current_period_end).toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent' }) : '—'}</div>) : <p className="empty-state">Obuna tarixi yo‘q.</p>}
      <h4>Avtomatik to‘lovlar</h4>{automatedPayments.length ? automatedPayments.map(row => <div className="member-history-row" key={row.id}>{row.provider} · {row.plan_key} · {row.currency==='USD'?`$${Number(row.amount_usd||0).toFixed(2)}`:`${Number(row.amount_uzs||0).toLocaleString('uz-UZ')} so‘m`} · {row.status}</div>) : <p className="empty-state">Avtomatik to‘lov tarixi yo‘q.</p>}
      <h4>P2P to‘lovlar</h4>{payments.length ? payments.map(row => <div className="member-history-row" key={row.id}>{Number(row.amount_uzs).toLocaleString('uz-UZ')} so‘m · {row.plan_key} · {row.status}</div>) : <p className="empty-state">To‘lov tarixi yo‘q.</p>}
    </div>}
  </section>;
}

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const PAGE_SIZE = 50;
const localDate = (value?: string) => value ? new Date(value).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' }) : '—';
function downloadCsv(rows: any[]) {
  const header = ['id', 'provider', 'user_id', 'member', 'plan_key', 'currency', 'amount_uzs', 'amount_usd', 'refunded_amount_usd', 'status', 'created_at', 'paid_at'];
  const quote = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const csv = [header, ...rows.map(row => header.map(key => row[key]))].map(line => line.map(quote).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'arniygym-avtomatik-tolovlar.csv'; anchor.click(); URL.revokeObjectURL(url);
}

export function AutomatedPaymentsAdmin({ notify }: { notify: (message: string) => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [members, setMembers] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!supabase) return;
    let alive = true; setBusy(true);
    supabase.from('payment_orders').select('id,provider,provider_order_id,user_id,plan_key,currency,amount_uzs,amount_usd,refunded_amount_usd,status,created_at,paid_at', { count: 'exact' })
      .order('created_at', { ascending: false }).range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)
      .then(async ({ data, count, error }) => {
        if (!alive) return;
        if (error) { notify('Avtomatik to‘lovlar tarixini yuklab bo‘lmadi.'); setBusy(false); return; }
        const items = data || []; setRows(items); setTotal(count || 0);
        const ids = [...new Set(items.map(row => row.user_id))];
        if (ids.length) {
          const { data: names, error: namesError } = await supabase!.from('members').select('auth_user_id,display_name,phone_e164').in('auth_user_id', ids);
          if (namesError) notify('To‘lovlar uchun a’zo nomlari yuklanmadi.');
          else if (alive) setMembers(Object.fromEntries((names || []).map(member => [member.auth_user_id, `${member.display_name || 'A’zo'} · ${member.phone_e164}`])));
        }
        if (alive) setBusy(false);
      });
    return () => { alive = false; };
  }, [page]);
  const rowsForCsv = rows.map(row => ({ ...row, member: members[row.user_id] || row.user_id }));
  const pageCount = Math.ceil(total / PAGE_SIZE);
  return <section className="admin-table automated-payments-admin">
    <div className="admin-table-top"><div><div className="eyebrow muted">PAYME / LEMON SQUEEZY</div><h3>Avtomatik to‘lovlar</h3></div><span>{total} ta qayd · {busy ? 'yangilanmoqda…' : `${page + 1} / ${Math.max(pageCount, 1)}-sahifa`}</span></div>
    {rows.map(row => <article className="automated-payment-row" key={row.id}><div><b>{members[row.user_id] || `A’zo · ${row.user_id.slice(0, 8)}`}</b><small>{row.provider === 'payme' ? 'Payme' : 'Lemon Squeezy'} · {row.plan_key} · {row.provider_order_id.slice(0, 16)}</small></div><strong>{row.currency === 'USD' ? `$${Number(row.amount_usd || 0).toFixed(2)}${Number(row.refunded_amount_usd||0)>0?` · -$${Number(row.refunded_amount_usd).toFixed(2)}`:''}` : `${Number(row.amount_uzs || 0).toLocaleString('uz-UZ')} so‘m`}</strong><span className={`payment-status payment-${row.status}`}>{row.status}</span><small>{row.status === 'paid' ? localDate(row.paid_at) : localDate(row.created_at)}</small></article>)}
    {!rows.length && <p className="empty-state">Avtomatik to‘lov qaydlari yo‘q.</p>}
    <div className="automated-payment-controls"><button className="btn-outline" disabled={page === 0} onClick={() => setPage(value => Math.max(0, value - 1))}>Oldingi</button><button className="btn-outline" disabled={page + 1 >= pageCount} onClick={() => setPage(value => Math.min(Math.max(pageCount - 1, 0), value + 1))}>Keyingi</button><button className="btn-outline" disabled={!rows.length} onClick={() => downloadCsv(rowsForCsv)}>CSV eksport</button></div>
  </section>;
}

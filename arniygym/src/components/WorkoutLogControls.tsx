import { useEffect, useState } from 'react';
import { Check, Clock3, Plus, TrendingUp } from './BootstrapIcons';
import { supabase } from '../lib/supabase';

type Props = { exerciseId: string; session: any; notify: (message: string) => void };
type LogRow = { id: string; set_count: number; reps_count: number; weight_kg: number; performed_at: string };

export function WorkoutLogControls({ exerciseId, session, notify }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [sets, setSets] = useState('3');
  const [reps, setReps] = useState('10');
  const [weight, setWeight] = useState('0');
  const [history, setHistory] = useState<LogRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => { setHistory([]); setLoaded(false); setExpanded(false); }, [exerciseId, session?.user?.id]);

  const open = async () => {
    if (!session?.user?.id || !supabase) return notify('Mashg‘ulot jurnalini ishlatish uchun avval Telegram orqali kiring.');
    const next = !expanded;
    setExpanded(next);
    if (!next || loaded) return;
    const { data, error } = await supabase.from('workout_logs').select('id,set_count,reps_count,weight_kg,performed_at').eq('exercise_id', exerciseId).order('performed_at', { ascending: false }).limit(5);
    if (error) { notify('Mashg‘ulot tarixi yuklanmadi.'); return; }
    setHistory((data || []) as LogRow[]);
    setLoaded(true);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session?.user?.id || !supabase) return notify('Mashg‘ulotni saqlash uchun tizimga kiring.');
    const s = Number(sets), r = Number(reps), w = Number(weight);
    if (!Number.isInteger(s) || s < 1 || s > 30 || !Number.isInteger(r) || r < 1 || r > 200 || !Number.isFinite(w) || w < 0 || w > 1000) return notify('Set, takror va vazn miqdorini tekshiring.');
    setBusy(true);
    const { data, error } = await supabase.from('workout_logs').insert({ user_id: session.user.id, exercise_id: exerciseId, set_count: s, reps_count: r, weight_kg: w }).select('id,set_count,reps_count,weight_kg,performed_at').single();
    setBusy(false);
    if (error) return notify('Mashg‘ulot qaydi saqlanmadi.');
    setHistory(rows => [data as LogRow, ...rows].slice(0, 5));
    setLoaded(true);
    notify('Mashg‘ulot qaydi saqlandi.');
  };

  return <div className="workout-journal">
    <button type="button" className="workout-journal-toggle" aria-expanded={expanded} onClick={() => void open()}><TrendingUp size={14}/>{expanded ? 'Jurnalni yopish' : 'Jurnalga qayd'}</button>
    {expanded && <div className="workout-journal-panel">
      <form onSubmit={save} className="workout-journal-form">
        <label>Set<input type="number" min="1" max="30" value={sets} onChange={event => setSets(event.target.value)} required/></label>
        <label>Takror<input type="number" min="1" max="200" value={reps} onChange={event => setReps(event.target.value)} required/></label>
        <label>Og‘irlik (kg)<input type="number" min="0" max="1000" step="0.5" value={weight} onChange={event => setWeight(event.target.value)} required/></label>
        <button type="submit" className="btn-red" disabled={busy}>{busy ? 'Saqlanmoqda…' : <>Saqlash <Plus size={14}/></>}</button>
      </form>
      {history.length > 0 ? <div className="workout-journal-history"><b><Clock3 size={13}/> Oxirgi qaydlar</b>{history.map(row => <span key={row.id}>{new Date(row.performed_at).toLocaleDateString('uz-UZ', { timeZone: 'Asia/Tashkent', day: 'numeric', month: 'short' })} · {row.set_count} × {row.reps_count} · {Number(row.weight_kg).toLocaleString('uz-UZ')} kg</span>)}</div>
        : loaded && <p className="workout-journal-empty">Hali mashg‘ulot qaydi yo‘q.</p>}
      <p className="workout-journal-private"><Check size={12}/> Qaydlar faqat sizga ko‘rinadi.</p>
    </div>}
  </div>;
}

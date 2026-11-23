import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import { BellRing, Flame } from './BootstrapIcons';
import { supabase } from '../lib/supabase';
import { startOfTashkentDay, todayInTashkent } from '../lib/dates';
import { FoodAnalyzer } from './FoodAnalyzer';

type Props = { session: any; onAuth: () => void; onPlans: () => void; notify: (message: string) => void };
const daily = (rows: any[]) => rows.reduce((sum, row) => sum + Number(row.calories || 0), 0);

export function HomeOverview({ session, onAuth, onPlans, notify }: Props) {
  const [baseGoal, setBaseGoal] = useState<number | null>(null), [goalInput, setGoalInput] = useState(''), [logs, setLogs] = useState<any[]>([]), [steps, setSteps] = useState(0), [exerciseInput, setExerciseInput] = useState('');
  const [premium, setPremium] = useState(false);
  useEffect(() => {
    if (!session || !supabase) return;
    const since = startOfTashkentDay();
    Promise.all([
      supabase.from('calorie_settings').select('base_goal').eq('user_id', session.user.id).maybeSingle(),
      supabase.from('calorie_logs').select('*').eq('user_id', session.user.id).gte('logged_at', since.toISOString()),
      supabase.from('subscriptions').select('id').eq('user_id', session.user.id).in('status', ['active', 'on_trial', 'cancelled']).gt('current_period_end', new Date().toISOString()).limit(1),
      supabase.from('steps_logs').select('steps').eq('user_id', session.user.id).eq('logged_on', todayInTashkent()).maybeSingle(),
    ]).then(([settings, dayLogs, subscriptions, stepLog]) => {
      if (settings.data?.base_goal) { setBaseGoal(Number(settings.data.base_goal)); setGoalInput(String(settings.data.base_goal)); }
      setLogs(dayLogs.data || []);
      setPremium(!!subscriptions.data?.length);
      setSteps(Number(stepLog.data?.steps || 0));
    });
  }, [session?.user?.id]);
  const food = useMemo(() => daily(logs.filter(item => item.source !== 'exercise')), [logs]);
  const burned = useMemo(() => daily(logs.filter(item => item.source === 'exercise')), [logs]);
  const remainingCalories = baseGoal === null ? null : Math.max(0, baseGoal - food + burned);
  const progress = baseGoal ? Math.min(100, Math.round(food / baseGoal * 100)) : 0;

  const saveGoal = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = Math.floor(Number(goalInput));
    if (!session || !supabase) return onAuth();
    if (!Number.isFinite(value) || value < 800 || value > 8000) return notify('Kunlik maqsadni 800–8 000 kkal oralig‘ida kiriting.');
    const { error } = await supabase.from('calorie_settings').upsert({ user_id: session.user.id, base_goal: value }, { onConflict: 'user_id' });
    if (error) return notify('Kaloriya maqsadi saqlanmadi. Qayta urinib ko‘ring.');
    setBaseGoal(value);
    notify('Kunlik kaloriya maqsadi saqlandi.');
  };

  const addExercise = async () => {
    const calories = Math.round(Number(exerciseInput));
    if (!calories || calories < 1 || calories > 3000) return notify('Mashq kaloriyasini 1–3000 oralig‘ida kiriting.');
    if (!session || !supabase) return onAuth();
    const { data, error } = await supabase.from('calorie_logs').insert({ user_id: session.user.id, meal_name: 'Mashq', calories, source: 'exercise' }).select().single();
    if (error) return notify('So‘rov muvaffaqiyatsiz. Qayta urinib ko‘ring.');
    setLogs(rows => [...rows, data]); setExerciseInput('');
  };
  const saveSteps = async () => {
    const count = Math.floor(Number(steps));
    if (!session || !supabase) return onAuth();
    if (!Number.isFinite(count) || count < 0 || count > 100000) return notify('Qadam sonini 0–100 000 oralig‘ida kiriting.');
    const { error } = await supabase.from('steps_logs').upsert({ user_id: session.user.id, logged_on: todayInTashkent(), steps: count }, { onConflict: 'user_id' });
    if (error) return notify('Qadamlar saqlanmadi. Keyinroq urinib ko‘ring.');
    notify('Bugungi qadamlar saqlandi.');
  };
  return <>
    <section className="member-welcome"><div><div className="eyebrow"><i/> SHAXSIY KABINET</div><h1>Bugungi rejang.</h1><p>Kaloriya, faollik va kunlik odatlaringni bir joyda kuzat.</p></div><div className={`member-status ${premium ? 'member-active' : ''}`}><span/>{premium ? 'FAOL OBUNA' : 'OBUNA FAOL EMAS'}</div></section>
    <section className="calorie-dashboard"><div className="dashboard-head"><div><div className="eyebrow muted">BUGUNGI BALANS</div><h2>Kaloriya dashboardi</h2></div></div><div className="dashboard-grid"><div className="calorie-ring" style={{ '--ring': `${progress}%` } as CSSProperties}><div><small>{baseGoal === null ? 'MAQSAD YO‘Q' : 'QOLGAN'}</small><b>{remainingCalories === null ? '—' : remainingCalories.toLocaleString()}</b><span>{remainingCalories === null ? 'maqsadni kiriting' : 'kkal'}</span></div></div><div className="calorie-stats"><span><small>ASOSIY MAQSAD</small><b>{baseGoal === null ? 'Belgilanmagan' : `${baseGoal.toLocaleString()} kkal`}</b></span><span><small>OVQAT</small><b>{food.toLocaleString()} kkal</b></span><span><small>MASHQ</small><b>+{burned.toLocaleString()} kkal</b></span><form className="calorie-goal-form" onSubmit={saveGoal}><label htmlFor="daily-calorie-goal">Kunlik maqsad (kkal)</label><div><input id="daily-calorie-goal" type="number" min="800" max="8000" step="50" value={goalInput} onChange={event => setGoalInput(event.target.value)} placeholder="Masalan 2 000" required/><button type="submit">Saqlash</button></div></form></div><div className="activity-cards"><label>QADAMLAR<div><input aria-label="Bugungi qadamlar" type="number" min="0" max="100000" value={steps} onChange={event => setSteps(Math.max(0, Number(event.target.value) || 0))}/><button type="button" onClick={saveSteps}>Saqlash</button></div><small>Qo‘lda kiritilgan; telefon sensori bilan avtomatik sanalmaydi.</small></label><label>MASHQ +<div><input type="number" min="1" placeholder="kkal" value={exerciseInput} onChange={event => setExerciseInput(event.target.value)}/><button onClick={addExercise}>+</button></div><small>yoqilgan kaloriya</small></label><span className="weight-mini"><Flame/><small>VAZN PROGRESSI +</small><b>Profil oynasida kuzating</b></span></div></div></section>
    <FoodAnalyzer session={session} notify={notify} onAuth={onAuth} onPlans={onPlans} onLogged={nutrition => setLogs(rows => [...rows, { ...nutrition, meal_name: nutrition.name, source: 'ai_scan' }])} compact/>
    <PushCard session={session} notify={notify}/>
  </>;
}

function PushCard({ session, notify }: { session: any; notify: (message: string) => void }) {
  const [busy, setBusy] = useState(false);
  const activate = async () => {
    if (!session) return notify('Eslatmalar uchun Telegram orqali kiring.');
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return notify('Bu brauzer push bildirishnomalarini qo‘llamaydi.');
    const key = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!key) return notify('Web Push kaliti .env.local faylida sozlanmagan.');
    setBusy(true);
    try {
      if (await Notification.requestPermission() !== 'granted') throw new Error('Bildirishnoma ruxsati berilmadi.');
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: Uint8Array.from(atob(key.replaceAll('-', '+').replaceAll('_', '/')), char => char.charCodeAt(0)) });
      const { error } = await supabase!.from('push_subscriptions').upsert({ user_id: session.user.id, endpoint: subscription.endpoint, p256dh: subscription.toJSON().keys?.p256dh, auth: subscription.toJSON().keys?.auth, user_agent: navigator.userAgent, updated_at: new Date().toISOString() }, { onConflict: 'endpoint' });
      if (error) throw error;
      notify('Suv, ovqatlanish va mashq eslatmalari yoqildi.');
    } catch (error: any) { notify('So‘rov muvaffaqiyatsiz. Qayta urinib ko‘ring.'); }
    finally { setBusy(false); }
  };
  return <section className="push-card"><BellRing/><div><b>Kundalik eslatmalar</b><small>Suv, ovqatlanish va mashq vaqtini eslatib turamiz.</small></div><button className="btn-outline" onClick={activate} disabled={busy}>{busy ? 'Yoqilmoqda…' : 'Yoqish'}</button></section>;
}

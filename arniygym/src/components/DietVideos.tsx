import { useEffect, useState } from 'react';
import { ArrowRight, LockKeyhole, Play, Video } from './BootstrapIcons';
import { SecureHlsPlayer } from './SecureHlsPlayer';
import { supabase } from '../lib/supabase';
import { useLanguage } from './Language';

type Props = {
  goal: 'gain' | 'cut';
  dietPlanId?: string;
  session: any;
  onAuth: () => void;
  onPlans: () => void;
  notify: (message: string) => void;
};
type Lesson = { id: string; title: string; title_ru?: string | null; description: string; description_ru?: string | null; stream_video_id: string };

export function DietVideos({ goal, dietPlanId, session, onAuth, onPlans, notify }: Props) {
  const { language } = useLanguage();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [access, setAccess] = useState<'checking' | 'guest' | 'locked' | 'open'>('checking');
  const [active, setActive] = useState('');
  const goalTitle = language === 'ru' ? (goal === 'gain' ? 'Набор массы' : 'Снижение веса') : (goal === 'gain' ? 'Massa yig‘ish' : 'Ozish');

  useEffect(() => {
    let alive = true;
    setLessons([]);
    setActive('');
    if (!session?.user?.id) {
      setAccess('guest');
      return () => { alive = false; };
    }
    if (!dietPlanId || !supabase) {
      setAccess('open');
      return () => { alive = false; };
    }
    setAccess('checking');
    const load = async () => {
      const userId = session.user.id;
      const until = new Date().toISOString();
      const [{ data: subscription }, { data: admin }] = await Promise.all([
        supabase.from('subscriptions').select('id').eq('user_id', userId).in('status', ['active', 'on_trial', 'cancelled']).gt('current_period_end', until).limit(1).maybeSingle(),
        supabase.from('admin_roles').select('user_id').eq('user_id', userId).maybeSingle(),
      ]);
      if (!alive) return;
      if (!subscription && !admin) {
        setAccess('locked');
        return;
      }
      const { data, error } = await supabase.from('diet_plan_media').select('id,title,title_ru,description,description_ru,stream_video_id').eq('diet_plan_id', dietPlanId).order('created_at', { ascending: false });
      if (!alive) return;
      if (error) {
        notify('So‘rov muvaffaqiyatsiz. Qayta urinib ko‘ring.');
        setLessons([]);
      } else setLessons(data || []);
      setAccess('open');
    };
    load().catch(error => {
      if (alive) {
        notify('So‘rov muvaffaqiyatsiz. Qayta urinib ko‘ring.');
        setAccess('open');
      }
    });
    return () => { alive = false; };
  }, [dietPlanId, session?.user?.id]);

  return <section className="diet-video-section">
    <div className="diet-video-heading"><span className="food-ai-icon"><Video size={18}/></span><div><div className="eyebrow muted">CLOUDFLARE STREAM / DARS VIDEOLARI</div><h3>{language === 'ru' ? `Видеоуроки: ${goalTitle}` : `${goalTitle} uchun videolar`}</h3><p>{language === 'ru' ? `Видеоуроки по питанию и тренировкам для цели «${goalTitle.toLowerCase()}».` : goal === 'gain' ? 'Massa yig‘ish uchun ovqatlanish va mashq bo‘yicha video darslar.' : 'Vazn tashlash uchun ovqatlanish va mashq bo‘yicha video darslar.'}</p></div></div>
    {access === 'guest' ? <div className="diet-video-empty"><LockKeyhole size={17}/><div><b>Video darslar a’zolar uchun.</b><small>Kirish uchun telefon raqamingizni tasdiqlang.</small></div><button className="btn-outline" onClick={onAuth}>Kirish <ArrowRight size={14}/></button></div>
      : access === 'checking' ? <div className="diet-video-empty"><LockKeyhole size={17}/><div><b>Obuna tekshirilmoqda…</b><small>Video darslarga ruxsat tekshirilmoqda.</small></div></div>
      : access === 'locked' ? <div className="diet-video-empty"><LockKeyhole size={17}/><div><b>Video darslar uchun faol obuna kerak.</b><small>Tariflarni ko‘rib, obunani faollashtiring.</small></div><button className="btn-red" onClick={onPlans}>Tariflar <ArrowRight size={14}/></button></div>
      : lessons.length ? <div className="diet-video-grid">{lessons.map((lesson, index) => <article className="diet-video-card" key={lesson.id}>
        <div className="diet-video-card-head"><span className="diet-video-number">{String(index + 1).padStart(2, '0')}</span><div><b>{language === 'ru' ? lesson.title_ru || lesson.title : lesson.title}</b><p>{language === 'ru' ? lesson.description_ru || lesson.description || `${goalTitle} — видеоурок.` : lesson.description || `${goalTitle} bo‘yicha video dars.`}</p></div><button className="watch-btn" onClick={() => setActive(active === lesson.id ? '' : lesson.id)}>{active === lesson.id ? 'YOPISH' : <><Play size={13}/> KO‘RISH</>}</button></div>
        {active === lesson.id && <SecureHlsPlayer videoId={lesson.stream_video_id} accountTag={`ID · ${session.user.id}`}/>}
      </article>)}</div>
      : <div className="diet-video-empty"><Play size={16}/><div><b>{language === 'ru' ? `Видеоуроки для цели «${goalTitle}» пока не загружены.` : `${goalTitle} uchun videolar hozircha yuklanmagan.`}</b><small>{language === 'ru' ? 'Загрузите видео в Cloudflare Stream через раздел «Питание» в панели администратора.' : 'Admin paneldagi Dieta bo‘limidan Cloudflare Stream’ga video yuklang.'}</small></div></div>}
  </section>;
}

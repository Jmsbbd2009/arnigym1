import { useMemo } from 'react';

const fields = [
  ['heroTitle', 'Sarlavha (o‘zbekcha)'], ['heroTitleRu', 'Sarlavha (ruscha)'], ['description', 'Qisqa ta’rif (o‘zbekcha)'], ['descriptionRu', 'Qisqa ta’rif (ruscha)'], ['missionTitle', 'Maqsad sarlavhasi'], ['mission', 'Maqsad matni'],
  ['teamTitle', 'Jamoa sarlavhasi (o‘zbekcha)'], ['teamTitleRu', 'Jamoa sarlavhasi (ruscha)'], ['team', 'Jamoa matni'], ['socialTitle', 'Ijtimoiy tarmoq sarlavhasi'],
  ['address', 'Zal manzili'], ['hours', 'Ish vaqti'], ['phone', 'Aloqa telefoni'], ['email', 'Aloqa emaili'],
  ['locationUrl', 'Xarita havolasi'], ['telegram', 'Telegram havolasi'], ['instagram', 'Instagram havolasi'],
] as const;

export function AboutContentEditor({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const content = useMemo(() => { try { return JSON.parse(value || '{}'); } catch { return {}; } }, [value]);
  const set = (key: string, nextValue: string) => onChange(JSON.stringify({ ...content, [key]: nextValue }, null, 2));
  return <div className="about-content-editor"><p>Saytda ko‘rsatiladigan ma’lumotlarni kiriting. Aniqlanmagan manzil, vaqt yoki aloqa raqamini taxmin qilib yozmang.</p>{fields.map(([key, label]) => <label className="field-label" key={key}>{label}{['description','descriptionRu','mission','team'].includes(key) ? <textarea rows={3} value={content[key] || ''} onChange={event => set(key, event.target.value)}/> : <input value={content[key] || ''} onChange={event => set(key, event.target.value)} placeholder={key.endsWith('Url') || key === 'telegram' || key === 'instagram' ? 'https://…' : ''}/>}</label>)}</div>;
}

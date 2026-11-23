import { Plus, Trash2 } from './BootstrapIcons';

type Meal = { time: string; name: string; details: string; nameRu: string; detailsRu: string };
type Content = { kcal: string; meals: Meal[]; tips: string[]; tipsRu: string[] };

const emptyMeal = (): Meal => ({ time: '', name: '', details: '', nameRu: '', detailsRu: '' });

function readContent(value: string): Content {
  try {
    const raw = JSON.parse(value || '{}');
    const source = Array.isArray(raw.items) ? raw.items : Array.isArray(raw.meals) ? raw.meals : [];
    return {
      kcal: String(raw.kcal ?? ''),
      meals: source.map((meal: any) => Array.isArray(meal)
        ? { time: String(meal[0] ?? ''), name: String(meal[1] ?? ''), details: String(meal[2] ?? ''), nameRu: String(meal[3] ?? ''), detailsRu: String(meal[4] ?? '') }
        : { time: String(meal.time ?? ''), name: String(meal.name ?? ''), details: String(meal.details ?? meal.description ?? ''), nameRu: String(meal.nameRu ?? meal.name_ru ?? ''), detailsRu: String(meal.detailsRu ?? meal.details_ru ?? '') }),
      tips: Array.isArray(raw.tips) ? raw.tips.map(String) : [],
      tipsRu: Array.isArray(raw.tips_ru) ? raw.tips_ru.map(String) : Array.isArray(raw.tipsRu) ? raw.tipsRu.map(String) : [],
    };
  } catch {
    return { kcal: '', meals: [], tips: [], tipsRu: [] };
  }
}

export function DietContentEditor({ value, onChange }: { value: string; onChange: (next: string) => void }) {
  const content = readContent(value);
  const update = (next: Content) => onChange(JSON.stringify({ kcal: next.kcal, items: next.meals.map(meal => [meal.time, meal.name, meal.details, meal.nameRu, meal.detailsRu]), tips: next.tips, tips_ru: next.tipsRu }, null, 2));
  const updateMeal = (index: number, key: keyof Meal, nextValue: string) => update({ ...content, meals: content.meals.map((meal, i) => i === index ? { ...meal, [key]: nextValue } : meal) });

  return <div className="diet-content-editor">
    <label className="field-label">Kunlik kaloriya tavsiyasi<input value={content.kcal} onChange={event => update({ ...content, kcal: event.target.value })} placeholder="Masalan: 2 100–2 300"/></label>
    <div className="diet-editor-section"><div className="diet-editor-title"><b>Kunlik ovqatlanish rejasi</b><button type="button" className="btn-outline" onClick={() => update({ ...content, meals: [...content.meals, emptyMeal()] })}><Plus size={14}/> Taom qo‘shish</button></div>
      {content.meals.map((meal, index) => <div className="diet-editor-meal" key={index}>
        <label className="field-label">Vaqt<input value={meal.time} onChange={event => updateMeal(index, 'time', event.target.value)} placeholder="08:00"/></label>
        <label className="field-label">Taom nomi<input value={meal.name} onChange={event => updateMeal(index, 'name', event.target.value)} placeholder="Nonushta"/></label>
        <label className="field-label">Taom nomi (ruscha)<input value={meal.nameRu} onChange={event => updateMeal(index, 'nameRu', event.target.value)} placeholder="Завтрак"/></label>
        <label className="field-label">Tarkibi / izoh<input value={meal.details} onChange={event => updateMeal(index, 'details', event.target.value)} placeholder="Taom tarkibi yoki porsiya"/></label>
        <label className="field-label">Tarkibi / izoh (ruscha)<input value={meal.detailsRu} onChange={event => updateMeal(index, 'detailsRu', event.target.value)} placeholder="Состав блюда или порция"/></label>
        <button type="button" className="icon-danger" aria-label="Taomni olib tashlash" onClick={() => update({ ...content, meals: content.meals.filter((_, i) => i !== index) })}><Trash2 size={15}/></button>
      </div>)}
      {!content.meals.length && <p className="empty-state">Hozircha taomlar qo‘shilmagan.</p>}
    </div>
    <label className="field-label">“Qanday qilish kerak?” tavsiyalari<textarea value={content.tips.join('\n')} onChange={event => update({ ...content, tips: event.target.value.split('\n').map(line => line.trim()).filter(Boolean) })} placeholder={'Har bir tavsiyani alohida qatorda yozing.'}/></label>
    <label className="field-label">“Qanday qilish kerak?” (ruscha)<textarea value={content.tipsRu.join('\n')} onChange={event => update({ ...content, tipsRu: event.target.value.split('\n').map(line => line.trim()).filter(Boolean) })} placeholder={'Каждую рекомендацию укажите с новой строки.'}/></label>
  </div>;
}

import { useMemo, useState } from 'react';
import { Plus, Trash2, Upload } from './BootstrapIcons';
import { supabase } from '../lib/supabase';

type Props={value:string;onChange:(value:string)=>void;notify:(message:string)=>void};
export function GymLandingEditor({value,onChange,notify}:Props){
 const [busy,setBusy]=useState(false);
 const content=useMemo(()=>{try{return JSON.parse(value||'{}')}catch{return {}}},[value]);
 const update=(key:string,next:any)=>onChange(JSON.stringify({...content,[key]:next},null,2));
 const list=(key:string)=>Array.isArray(content[key])?content[key]:[];
 const updateListItem=(key:string,index:number,field:string,next:string)=>update(key,list(key).map((item:any,i:number)=>i===index?{...item,[field]:next}:item));
 const add=(key:string,blank:any)=>update(key,[...list(key),blank]);
 const remove=(key:string,index:number)=>update(key,list(key).filter((_:any,i:number)=>i!==index));
 const uploadGallery=async(file:File)=>{
  if(!supabase)return notify('Supabase sozlanmagan.');
  if(!file.type.startsWith('image/'))return notify('Rasm faylini tanlang.');
  setBusy(true);
  try{
   const bitmap=await createImageBitmap(file);const scale=Math.min(1,1800/Math.max(bitmap.width,bitmap.height));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   const context=canvas.getContext('2d');if(!context)throw new Error('Rasm qayta ishlanmadi.');context.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
   const webp=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('WebP formatiga o‘girib bo‘lmadi.')),'image/webp',.84));
   if(webp.size>10*1024*1024)throw new Error('Rasm 10 MB dan katta. Kichikroq rasm tanlang.');
   const path=`gallery/${crypto.randomUUID()}.webp`;const {error}=await supabase.storage.from('gym-gallery').upload(path,webp,{contentType:'image/webp',upsert:false});if(error)throw error;
   const {data}=supabase.storage.from('gym-gallery').getPublicUrl(path);update('gallery',[...list('gallery'),{path,url:data.publicUrl,alt:file.name.replace(/\.[^.]+$/,'').slice(0,120)||'ArniyGym zalidan surat'}]);notify('WebP rasm yuklandi. Sayt matnlarini saqlang.');
  }catch(error:any){notify(error?.message||'Rasm yuklanmadi.');}
  finally{setBusy(false)}
 };
 const deleteGallery=async(index:number)=>{const item=list('gallery')[index];if(item?.path&&supabase){const {error}=await supabase.storage.from('gym-gallery').remove([item.path]);if(error)return notify('Rasm ombordan o‘chirilmadi.');}remove('gallery',index)};
 return <section className="gym-content-editor">
  <div className="gym-editor-block"><div><h3>Zal galereyasi</h3><p>Rasmlar avtomatik WebP formatiga o‘tkaziladi. Faqat ruxsatingiz bor rasmlarni joylang.</p></div><label className="file-pick"><Upload size={15}/>{busy?'WebP tayyorlanmoqda…':'WebP galereyaga yuklash'}<input type="file" accept="image/*" disabled={busy} onChange={event=>{const file=event.target.files?.[0];if(file)void uploadGallery(file);event.currentTarget.value=''}}/></label></div>
  {list('gallery').map((item:any,index:number)=><div className="gym-editor-row gym-gallery-editor" key={item.path||index}><img src={item.url} alt="Galereya oldindan ko‘rinishi"/><label>Rasm tavsifi<input value={item.alt||''} maxLength={120} onChange={event=>updateListItem('gallery',index,'alt',event.target.value)}/></label><button type="button" className="icon-danger" aria-label="Galereya rasmini o‘chirish" onClick={()=>void deleteGallery(index)}><Trash2 size={15}/></button></div>)}
  <div className="gym-editor-block"><div><h3>Murabbiylar</h3><p>Faqat haqiqiy va rozilik bergan murabbiylarni qo‘shing.</p></div><button type="button" className="btn-outline" onClick={()=>add('coaches',{name:'',role:'',bio:''})}>Murabbiy qo‘shish <Plus size={14}/></button></div>
  {list('coaches').map((item:any,index:number)=><div className="gym-editor-entry" key={`coach-${index}`}><label>Ism<input value={item.name||''} maxLength={120} onChange={event=>updateListItem('coaches',index,'name',event.target.value)}/></label><label>Lavozim (UZ)<input value={item.role||''} maxLength={120} onChange={event=>updateListItem('coaches',index,'role',event.target.value)}/></label><label>Должность (RU)<input value={item.roleRu||''} maxLength={120} onChange={event=>updateListItem('coaches',index,'roleRu',event.target.value)}/></label><label className="wide-label">Qisqa ma’lumot (UZ)<textarea rows={2} value={item.bio||''} maxLength={500} onChange={event=>updateListItem('coaches',index,'bio',event.target.value)}/></label><label className="wide-label">Краткое описание (RU)<textarea rows={2} value={item.bioRu||''} maxLength={500} onChange={event=>updateListItem('coaches',index,'bioRu',event.target.value)}/></label><button type="button" className="icon-danger" aria-label="Murabbiyni olib tashlash" onClick={()=>remove('coaches',index)}><Trash2 size={15}/></button></div>)}
  <div className="gym-editor-block"><div><h3>Mijozlar sharhlari</h3><p>Faqat haqiqiy va e’lon qilishga rozilik olingan fikrlarni kiriting.</p></div><button type="button" className="btn-outline" onClick={()=>add('testimonials',{name:'',text:'',context:''})}>Sharh qo‘shish <Plus size={14}/></button></div>
  {list('testimonials').map((item:any,index:number)=><div className="gym-editor-entry" key={`review-${index}`}><label>Ism<input value={item.name||''} maxLength={120} onChange={event=>updateListItem('testimonials',index,'name',event.target.value)}/></label><label>Kontekst (ixtiyoriy)<input value={item.context||''} maxLength={120} onChange={event=>updateListItem('testimonials',index,'context',event.target.value)}/></label><label className="wide-label">Sharh (UZ)<textarea rows={3} value={item.text||''} maxLength={1000} onChange={event=>updateListItem('testimonials',index,'text',event.target.value)}/></label><label className="wide-label">Отзыв (RU)<textarea rows={3} value={item.textRu||''} maxLength={1000} onChange={event=>updateListItem('testimonials',index,'textRu',event.target.value)}/></label><button type="button" className="icon-danger" aria-label="Sharhni olib tashlash" onClick={()=>remove('testimonials',index)}><Trash2 size={15}/></button></div>)}
  <div className="gym-editor-block"><div><h3>Savol-javob</h3><p>Mehmonlarga kerakli aniq javoblarni qo‘shing.</p></div><button type="button" className="btn-outline" onClick={()=>add('faqs',{question:'',answer:''})}>Savol qo‘shish <Plus size={14}/></button></div>
  {list('faqs').map((item:any,index:number)=><div className="gym-editor-entry" key={`faq-${index}`}><label>Savol (UZ)<input value={item.question||''} maxLength={250} onChange={event=>updateListItem('faqs',index,'question',event.target.value)}/></label><label>Вопрос (RU)<input value={item.questionRu||''} maxLength={250} onChange={event=>updateListItem('faqs',index,'questionRu',event.target.value)}/></label><label className="wide-label">Javob (UZ)<textarea rows={2} value={item.answer||''} maxLength={1000} onChange={event=>updateListItem('faqs',index,'answer',event.target.value)}/></label><label className="wide-label">Ответ (RU)<textarea rows={2} value={item.answerRu||''} maxLength={1000} onChange={event=>updateListItem('faqs',index,'answerRu',event.target.value)}/></label><button type="button" className="icon-danger" aria-label="Savolni olib tashlash" onClick={()=>remove('faqs',index)}><Trash2 size={15}/></button></div>)}
 </section>;
}

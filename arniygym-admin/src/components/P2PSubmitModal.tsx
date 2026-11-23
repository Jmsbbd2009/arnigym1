import { useEffect, useState } from 'react';
import { Upload } from './BootstrapIcons';
import { Modal } from './SupportModals';
import { invoke, supabase } from '../lib/supabase';

type Props={session:any;notify:(message:string)=>void;onClose:()=>void};
export function P2PSubmitModal({session,notify,onClose}:Props){
 const [plan,setPlan]=useState<'monthly'|'yearly'>('monthly'),[file,setFile]=useState<File|null>(null),[info,setInfo]=useState<any>(null),[prices,setPrices]=useState<any[]>([]),[busy,setBusy]=useState(false);
 useEffect(()=>{let alive=true;Promise.all([supabase?.from('payment_info').select('*').eq('id',1).maybeSingle(),supabase?.from('plan_prices').select('plan_key,amount_uzs').eq('active',true)]).then(([payment,plans])=>{if(!alive)return;setInfo(payment?.data||null);setPrices(plans?.data||[])});return()=>{alive=false}},[]);
 const amount=prices.find(item=>item.plan_key===plan)?.amount_uzs;
 const submit=async(event:React.FormEvent)=>{
  event.preventDefault();if(!supabase||!file||!session?.user?.id)return;
  if(file.size>10*1024*1024){notify('Chek fayli 10 MB dan oshmasin.');return}
  setBusy(true);let uploadedPath='';
  try{
   const extension=file.name.split('.').pop()?.toLowerCase()||'jpg';
   uploadedPath=`${session.user.id}/${crypto.randomUUID()}.${extension}`;
   const {error:uploadError}=await supabase.storage.from('p2p-receipts').upload(uploadedPath,file,{contentType:file.type,upsert:false});
   if(uploadError)throw uploadError;
   await invoke('p2p-submit',{plan,receiptPath:uploadedPath});
   notify(`Chek ${Number(amount).toLocaleString('uz-UZ')} so‘m uchun yuborildi. Admin tasdig‘i kutilmoqda.`);onClose();
  }catch(error:any){if(uploadedPath)await supabase.storage.from('p2p-receipts').remove([uploadedPath]);notify(error?.message||'Chek yuborilmadi. Qayta urinib ko‘ring.');}
  finally{setBusy(false)}
 };
 return <Modal onClose={onClose}><div className="eyebrow">UZCARD / HUMO</div><h2>Chekni yubor.</h2><p>Tarif narxini tekshirib, bank ilovasida o‘tkazmani amalga oshiring va chekni yuklang.</p>{info?<div className="payment-info"><small>KARTA RAQAMI</small><b>{info.card_number}</b><span>{info.cardholder}</span><p>{info.instructions}</p></div>:<div className="form-error">Karta rekvizitlari admin tomonidan sozlanmagan.</div>}<form onSubmit={submit}><label className="field-label">Tarif<select value={plan} onChange={event=>setPlan(event.target.value as 'monthly'|'yearly')}><option value="monthly">PRO oylik</option><option value="yearly">PRO yillik</option></select></label><div className="p2p-amount-preview"><small>ADMIN NARX JADVALIDAGI SUMMA</small><b>{amount?`${Number(amount).toLocaleString('uz-UZ')} so‘m`:'Narx sozlanmagan'}</b><span>Tasdiqlashda summa qayta tekshiriladi.</span></div><label className="field-label">To‘lov cheki<input required type="file" accept="image/png,image/jpeg,image/webp,application/pdf" onChange={event=>setFile(event.target.files?.[0]||null)}/></label><button className="btn-red full-btn" disabled={busy||!file||!info||!amount}>{busy?'Yuborilmoqda…':'Chekni yuborish'} <Upload size={14}/></button></form></Modal>;
}

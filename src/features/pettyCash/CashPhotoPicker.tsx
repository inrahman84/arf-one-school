import React,{useEffect,useState} from 'react';
import {validateImageFile} from '../../services/imageStorageService';
import type {NamedCashPhoto} from '../../services/cashService';
import {Camera,Trash2} from 'lucide-react';

export type SelectedCashPhoto=NamedCashPhoto & {id:string};

function Thumbnail({file}:{file:File}){
  const [src,setSrc]=useState('');
  useEffect(()=>{
    const url=URL.createObjectURL(file);
    setSrc(url);
    return()=>URL.revokeObjectURL(url);
  },[file]);
  return src?<img className="h-16 w-16 rounded-lg border object-cover shrink-0" src={src} alt="Pratinjau foto"/>:null;
}
export const CashPhotoPicker:React.FC<{
 title:string;photos:SelectedCashPhoto[];onChange:(next:SelectedCashPhoto[])=>void;
 onError:(message:string)=>void;
}>=({title,photos,onChange,onError})=>{
 const add=(files:FileList|null)=>{
   if(!files)return;
   const incoming=Array.from(files);
   if(photos.length+incoming.length>12){
     onError('Maksimal 12 foto pada kategori '+title+'.');
     return;
   }
   try{
     incoming.forEach(validateImageFile);
     onChange([...photos,...incoming.map(file=>({
       id:crypto.randomUUID(),file,name:file.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').slice(0,150)
     }))]);
     onError('');
   }catch(e){onError(e instanceof Error?e.message:String(e));}
 };
 return <section className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-3 min-w-0">
   <div className="flex flex-wrap items-center justify-between gap-2">
     <h4 className="text-sm font-bold text-[#073b2d]">{title} <span className="text-red-600">*</span></h4>
     <span className="text-xs text-gray-500">{photos.length}/12 foto</span>
   </div>
   <label className="flex items-center justify-center gap-2 cursor-pointer rounded-lg border border-dashed border-[#3f6276] bg-white px-3 py-3 text-xs font-semibold text-[#073b2d]">
     <Camera size={17}/>Pilih beberapa foto
     <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only"
       onChange={e=>{add(e.target.files);e.target.value='';}}/>
   </label>
   <p className="text-xs text-gray-500">JPG, PNG, WebP. Maksimal 5 MB per gambar. Beri nama setiap foto sebelum menyimpan.</p>
   {photos.map((photo,i)=><div key={photo.id} className="flex gap-2 items-center min-w-0 rounded-lg bg-white p-2 border">
     <Thumbnail file={photo.file}/>
     <label className="min-w-0 flex-1 text-xs font-medium">Nama Foto {i+1}
       <input type="text" maxLength={150} required
        className="block w-full min-w-0 border rounded-lg mt-1 px-2 py-2 text-sm"
        value={photo.name} placeholder="Contoh: Pembelian alat tulis, Nota 001"
        onChange={e=>onChange(photos.map(p=>p.id===photo.id?{...p,name:e.target.value}:p))}/>
       <span className="block text-gray-500 truncate mt-1" title={photo.file.name}>{photo.file.name}</span>
     </label>
     <button type="button" aria-label={'Hapus foto '+(i+1)}
       className="shrink-0 p-2 rounded-lg text-red-700 hover:bg-red-50"
       onClick={()=>onChange(photos.filter(p=>p.id!==photo.id))}><Trash2 size={16}/></button>
   </div>)}
 </section>;
};

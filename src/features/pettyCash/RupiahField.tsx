import React,{useEffect,useState} from 'react';

/** Text field avoids the browser's spinner buttons and allows direct Rupiah typing. */
export const RupiahField:React.FC<{
 label:string;value:number;onChange:(value:number)=>void;required?:boolean;id?:string;
}>=({label,value,onChange,required,id})=>{
 const [focused,setFocused]=useState(false);
 const [raw,setRaw]=useState(value>0?String(value):'');
 useEffect(()=>{if(!focused)setRaw(value>0?String(value):'');},[value,focused]);
 const text=focused?raw:value>0?value.toLocaleString('id-ID'):'';
 return <label className="block text-xs min-w-0">{label}
   <div className="flex items-center rounded-lg border border-gray-300 bg-white overflow-hidden mt-1 focus-within:ring-2 focus-within:ring-[#c89b55]">
     <span className="px-3 py-2 bg-gray-50 border-r text-gray-600 font-semibold">Rp</span>
     <input id={id} aria-label={label} type="text" inputMode="numeric" autoComplete="off"
       placeholder="Ketik nominal"
       required={required} className="w-full min-w-0 px-3 py-2 text-sm outline-none tabular-nums"
       value={text}
       onFocus={()=>{setFocused(true);setRaw(value>0?String(value):'');}}
       onBlur={()=>setFocused(false)}
       onChange={e=>{
         const digits=e.target.value.replace(/\D/g,'').slice(0,15);
         setRaw(digits);
         const next=Number(digits||'0');
         if(Number.isSafeInteger(next))onChange(next);
       }}/>
   </div>
 </label>;
};

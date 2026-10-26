import React,{useState} from 'react';
import {KeyRound,ShieldCheck} from 'lucide-react';
import {supabase} from '../../lib/supabase';

/** Shown only after Supabase Auth has exchanged the invited user's token
 * for a session. Password is updated by the user's own authenticated session. */
export const SetPasswordView:React.FC=()=>{
 const [password,setPassword]=useState('');
 const [confirmation,setConfirmation]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const submit=async(e:React.FormEvent)=>{
   e.preventDefault();setError('');
   if(password.length<12||!/[a-zA-Z]/.test(password)||!/\d/.test(password)){
     setError('Sandi minimal 12 karakter dan harus mengandung huruf serta angka.');return;
   }
   if(password!==confirmation){setError('Konfirmasi sandi belum sama.');return;}
   setBusy(true);
   try{
     const {data:{user},error:sessionError}=await supabase.auth.getUser();
     if(sessionError||!user)throw new Error('Sesi undangan tidak valid atau kedaluwarsa. Minta undangan baru.');
     const {error:updateError}=await supabase.auth.updateUser({password});
     if(updateError)throw updateError;
     // Remove setup flag without retaining invitation tokens in the URL.
     window.location.replace(window.location.origin+window.location.pathname);
   }catch(err){setError(err instanceof Error?err.message:'Gagal menyimpan sandi baru.');
   }finally{setBusy(false);}
 };
 return <div className="min-h-screen bg-[#f6f3ec] flex items-center justify-center p-4">
   <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-7 shadow-lg">
     <div className="mb-5 flex items-center gap-2">
       <ShieldCheck className="h-6 w-6 text-[#073b2d]"/>
       <h1 className="text-lg font-bold text-[#073b2d]">Aktivasi Akun ARF One School</h1>
     </div>
     <p className="mb-5 text-sm text-gray-600">
       Buat sandi pribadi untuk akun baru atau akun yang menerima tautan pengaturan ulang sandi.
     </p>
     {error&&<p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</p>}
     <form onSubmit={e=>void submit(e)} className="space-y-4">
       <label className="block text-xs font-semibold">Sandi Baru
         <input type="password" autoComplete="new-password" minLength={12} required
           value={password} onChange={e=>setPassword(e.target.value)}
           className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm"/>
       </label>
       <label className="block text-xs font-semibold">Konfirmasi Sandi Baru
         <input type="password" autoComplete="new-password" minLength={12} required
           value={confirmation} onChange={e=>setConfirmation(e.target.value)}
           className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm"/>
       </label>
       <button disabled={busy} type="submit"
         className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#073b2d] p-3 text-sm font-semibold text-white disabled:opacity-50">
         <KeyRound className="h-4 w-4"/> {busy?'Menyimpan...':'Simpan Sandi dan Lanjutkan'}
       </button>
     </form>
   </div>
 </div>;
};

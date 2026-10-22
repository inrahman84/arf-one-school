import React, { useState } from 'react';
import { ShieldCheck, Sparkles, AlertCircle, Mail, UserRoundPlus, ArrowLeft, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { GOOGLE_OAUTH_ENABLED } from '../../services/authService';

type AuthMode='login'|'register'|'email-link';

export const LoginView: React.FC = () => {
  const {loginWithGoogle, loginWithEmail, loginWithPassword, registerWithEmail, loading}=useAuth();
  const [mode,setMode]=useState<AuthMode>('login');
  const [manualEmail,setManualEmail]=useState('');
  const [fullName,setFullName]=useState('');
  const [password,setPassword]=useState('');
  const [confirmPassword,setConfirmPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [errorMsg,setErrorMsg]=useState<string|null>(null);
  const [notice,setNotice]=useState<string|null>(null);

  const switchMode=(next:AuthMode)=>{
    setMode(next);setErrorMsg(null);setNotice(null);
    setPassword('');setConfirmPassword('');
  };

  const handleSubmit=async(e:React.FormEvent)=>{
    e.preventDefault();
    if(busy||loading)return;
    setErrorMsg(null);setNotice(null);
    if(mode==='register' && password!==confirmPassword){
      setErrorMsg('Konfirmasi kata sandi belum sama.');return;
    }
    setBusy(true);
    try{
      if(mode==='login'){
        await loginWithPassword(manualEmail,password);
      }else if(mode==='register'){
        const result=await registerWithEmail(manualEmail,password,fullName);
        setNotice(result.confirmationRequired
          ? 'Pendaftaran diterima. Silakan periksa kotak masuk email untuk verifikasi. Setelah itu, akses ke data sekolah memerlukan persetujuan Super Admin.'
          : 'Akun terdaftar. Akses data sekolah tetap menunggu persetujuan Super Admin.');
        setPassword('');setConfirmPassword('');
      }else{
        await loginWithEmail(manualEmail);
        setNotice('Jika email terdaftar dan pengiriman email diaktifkan, tautan masuk akan dikirim. Periksa kotak masuk atau folder spam.');
      }
    }catch(err:any){
      const message=String(err?.message || 'Proses autentikasi gagal.');
      setErrorMsg(message.includes('provider is not enabled')
        ? 'Penyedia login belum aktif. Gunakan email dan kata sandi.'
        : message);
    }finally{setBusy(false);}
  };

  const handleGoogle=async()=>{
    if(!GOOGLE_OAUTH_ENABLED||busy)return;
    setErrorMsg(null);setNotice(null);setBusy(true);
    try{await loginWithGoogle();}
    catch(err:any){setErrorMsg(err?.message||'Google OAuth belum tersedia. Gunakan login email.');}
    finally{setBusy(false);}
  };

  const inputClass='w-full p-3 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#073b2d]/30';
  const busyNow=busy||loading;

  return(
    <div className="min-h-screen bg-[#f6f3ec] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200/80 overflow-hidden">
        <div className="p-8 text-center bg-[#073b2d]">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-[#c89b55] to-[#9c7536] text-white font-black text-2xl items-center justify-center shadow-lg mb-4">ARF</div>
          <h1 className="text-xl font-bold text-white tracking-wide">Abdul Rasyid Foundation</h1>
          <p className="text-xs text-emerald-200/80 mt-1 font-medium tracking-wider uppercase">ARF One School</p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-700/50 text-[11px] text-[#c89b55] font-semibold">
            <Sparkles className="w-3 h-3"/>
            <span>One Foundation - One Standard - One Schools</span>
          </div>
        </div>
        <div className="p-8 space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-base font-bold text-gray-900">
              {mode==='register'?'Daftar Email Pengguna':mode==='email-link'?'Masuk dengan Tautan Email':'Masuk ke ARF One School'}
            </h2>
            <p className="text-xs text-[#5f5d5d]">
              {mode==='register'?'Daftarkan identitas Anda. Akses data memerlukan persetujuan administrator.'
               :mode==='email-link'?'Kirim tautan verifikasi ke akun email yang sudah terdaftar.'
               :'Portal manajemen dan pemantauan mutu sekolah ARF.'}
            </p>
          </div>

          {errorMsg && <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5"/><span>{errorMsg}</span></div>}
          {notice && <div role="status" className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">{notice}</div>}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode==='register' && <div>
              <label htmlFor="arf-fullname" className="block text-xs font-semibold text-gray-700 mb-1">Nama Lengkap</label>
              <input id="arf-fullname" type="text" autoComplete="name" required maxLength={100}
                value={fullName} onChange={e=>setFullName(e.target.value)}
                placeholder="Nama sesuai identitas" className={inputClass}/>
            </div>}
            <div>
              <label htmlFor="arf-email" className="block text-xs font-semibold text-gray-700 mb-1">Email Pengguna</label>
              <input id="arf-email" type="email" autoComplete="username" required
                value={manualEmail} onChange={e=>setManualEmail(e.target.value)}
                placeholder="nama@organisasi.sch.id" className={inputClass}/>
            </div>
            {mode!=='email-link' && <div>
              <label htmlFor="arf-password" className="block text-xs font-semibold text-gray-700 mb-1">Kata Sandi</label>
              <input id="arf-password" type="password" autoComplete={mode==='register'?'new-password':'current-password'}
                required minLength={mode==='register'?10:1} value={password} onChange={e=>setPassword(e.target.value)}
                placeholder={mode==='register'?'Minimal 10 karakter':'Masukkan kata sandi'} className={inputClass}/>
            </div>}
            {mode==='register' && <div>
              <label htmlFor="arf-confirm" className="block text-xs font-semibold text-gray-700 mb-1">Konfirmasi Kata Sandi</label>
              <input id="arf-confirm" type="password" autoComplete="new-password" required minLength={10}
                value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}
                placeholder="Ulangi kata sandi" className={inputClass}/>
            </div>}
            <button type="submit" disabled={busyNow}
              className="w-full rounded-xl bg-[#073b2d] px-4 py-3 text-white text-sm font-semibold hover:bg-[#0d4d3b] disabled:opacity-60">
              {busyNow?'Memproses...':mode==='register'?'Daftar Email Pengguna':mode==='email-link'?'Kirim Tautan Masuk':'Masuk'}
            </button>
          </form>

          {mode==='login' ? <div className="text-center flex flex-wrap justify-center gap-x-4 gap-y-2 text-xs font-semibold">
            <button type="button" onClick={()=>switchMode('register')} className="text-[#3f6276] hover:underline flex items-center gap-1"><UserRoundPlus className="w-3.5 h-3.5"/>Daftar Email Pengguna</button>
            <button type="button" onClick={()=>switchMode('email-link')} className="text-[#3f6276] hover:underline flex items-center gap-1"><Mail className="w-3.5 h-3.5"/>Masuk via Email</button>
          </div> : <button type="button" onClick={()=>switchMode('login')}
            className="flex items-center gap-1 mx-auto text-xs text-[#3f6276] font-semibold hover:underline"><ArrowLeft className="w-3.5 h-3.5"/>Kembali ke Login</button>}

          <div className="border-t border-gray-100 pt-4 space-y-2">
            <button type="button" onClick={handleGoogle} disabled={!GOOGLE_OAUTH_ENABLED||busyNow}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-gray-300 text-gray-700 font-semibold text-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-gray-50">
              <span className="font-bold text-base text-[#4285F4]">G</span>
              <span>{GOOGLE_OAUTH_ENABLED?'Masuk dengan Google':'Masuk dengan Google (belum aktif)'}</span>
            </button>
            {!GOOGLE_OAUTH_ENABLED && <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 flex gap-2 items-start">
              <Info className="w-3.5 h-3.5 shrink-0 mt-0.5"/>
              Google OAuth belum dikonfigurasi oleh administrator. Gunakan email dan kata sandi terlebih dahulu.
            </p>}
          </div>
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 space-y-1.5 text-[11px] text-[#5f5d5d]">
            <div className="font-semibold text-gray-800 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[#3f6276]"/>
              <span>Persetujuan Pengguna oleh Super Admin</span>
            </div>
            <p className="leading-relaxed">
              Pendaftaran email tidak otomatis memberikan akses ke data sekolah. Super Admin menetapkan peran, wilayah, serta sekolah yang boleh diakses.
            </p>
          </div>
        </div>
        <div className="px-8 py-3 bg-gray-50 border-t border-gray-100 text-center text-[11px] text-gray-400">
          ARF One School &copy; 2026 Abdul Rasyid Foundation
        </div>
      </div>
    </div>
  );
};

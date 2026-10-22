import React, { useState } from 'react';
import { Shield, Sparkles, Building, CheckCircle2, AlertCircle, ArrowRight, Mail } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LoginView: React.FC = () => {
  const { loginWithGoogle, loginWithEmail, loading } = useAuth();
  const [emailSent, setEmailSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [manualEmail, setManualEmail] = useState('');
  const [showEmailInput, setShowEmailInput] = useState(false);

  const handleGoogleLogin=async()=>{setErrorMsg(null);try{await loginWithGoogle();}catch(err:any){setErrorMsg(err?.message||'Google Sign-In belum dikonfigurasi di Supabase.');}};
  const handleManualEmailSubmit=async(e:React.FormEvent)=>{e.preventDefault();setErrorMsg(null);setEmailSent(false);
    try{await loginWithEmail(manualEmail.trim());setEmailSent(true);}
    catch(err:any){setErrorMsg(err?.message||'Tidak dapat mengirim tautan masuk.');}
  };

  return (
    <div className="min-h-screen bg-[#f6f3ec] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200/80 overflow-hidden">
        {/* Top Header Banner with Brand Dark Green */}
        <div className="p-8 text-center" style={{ backgroundColor: '#073b2d' }}>
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-[#c89b55] to-[#9c7536] text-white font-black text-2xl items-center justify-center shadow-lg mb-4">
            ARF
          </div>
          <h1 className="text-xl font-bold text-white tracking-wide">
            Abdul Rasyid Foundation
          </h1>
          <p className="text-xs text-emerald-200/80 mt-1 font-medium tracking-wider uppercase">
            ARF One School
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-700/50 text-[11px] text-[#c89b55] font-semibold">
            <Sparkles className="w-3 h-3" />
            <span>One Foundation. One Standard. Better Schools.</span>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-8 space-y-5">
          <div className="text-center space-y-1">
            <h2 className="text-base font-bold text-gray-900">
              Masuk ke Portal Manajemen Sekolah
            </h2>
            <p className="text-xs text-[#5f5d5d]">
              Sistem informasi terpadu pemantauan dan pengelolaan sekolah Wave 1.
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {emailSent && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">Tautan masuk telah dikirim. Buka email Anda dan klik tautan untuk masuk. Pastikan alamat email terdaftar pada ARF One School.</div>}
          {/* 2. Google OAuth Button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold text-xs transition-all disabled:opacity-60 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Masuk dengan Google (OAuth)</span>
          </button>

          {/* Supabase verified email Magic Link */}
          <div>
            {!showEmailInput ? (
              <button
                type="button"
                onClick={() => setShowEmailInput(true)}
                className="w-full text-center text-xs text-[#3f6276] hover:underline font-semibold"
              >
                Masuk dengan email (tautan verifikasi) &rarr;
              </button>
            ) : (
              <form onSubmit={handleManualEmailSubmit} className="space-y-2 mt-2 pt-2 border-t border-gray-100">
                <label className="block text-[11px] font-semibold text-gray-700">Email Akun Terdaftar ARF</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={manualEmail}
                    onChange={(e) => setManualEmail(e.target.value)}
                    placeholder="nama@sumbermassarana.sch.id"
                    className="flex-1 text-xs p-2 rounded-lg border border-gray-300"
                    required
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-3 py-2 rounded-lg bg-[#073b2d] text-white text-xs font-semibold"
                  >
                    Masuk
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Institutional Access Policy Information */}
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200/80 space-y-1.5 text-[11px] text-[#5f5d5d]">
            <div className="font-semibold text-gray-800 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-[#3f6276]" />
              <span>Otorisasi Berbasis Peran Terpadu</span>
            </div>
            <p className="leading-relaxed">
              Data disimpan permanen pada basis data Supabase PostgreSQL ARF One School. Setelah masuk, evaluator dapat beralih peran simulasi di navigasi atas untuk menguji otorisasi per jenjang.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-3 bg-gray-50 border-t border-gray-100 text-center text-[11px] text-gray-400">
          ARF One School &copy; 2026 Abdul Rasyid Foundation
        </div>
      </div>
    </div>
  );
};

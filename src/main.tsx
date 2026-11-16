import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';

/**
 * Keep the application shell visible even when a dependency (for example a
 * missing Vercel Preview Supabase environment variable) prevents App from
 * importing. A static App import fails before React can mount anything.
 */
function LoadFailure({detail}:{detail?:string}) {
  return (
    <main className="min-h-screen bg-[#f6f3ec] flex items-center justify-center p-5">
      <section role="alert" className="w-full max-w-lg bg-white border border-rose-200 rounded-2xl shadow-sm p-7 space-y-4 text-center">
        <div className="mx-auto h-12 w-12 bg-[#073b2d] text-white rounded-xl flex items-center justify-center font-bold">ARF</div>
        <h1 className="text-xl font-bold text-[#073b2d]">ARF One School belum dapat dimuat</h1>
        <p className="text-sm text-gray-700">Aplikasi mengalami kesalahan saat memulai. Data sekolah tidak terhapus. Silakan muat ulang halaman, atau hubungi administrator jika masalah berulang.</p>
        {detail && <p className="text-xs text-gray-500">{detail}</p>}
        <button type="button" onClick={() => window.location.reload()}
          className="rounded-xl bg-[#073b2d] px-5 py-2.5 text-sm font-semibold text-white">Muat Ulang</button>
      </section>
    </main>
  );
}
class AppBoundary extends React.Component<{children:React.ReactNode},{failed:boolean}> {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error:Error){console.error('ARF One School render failure:',error);}
  render(){return this.state.failed?<LoadFailure detail="Terjadi kesalahan saat menampilkan halaman."/>:this.props.children;}
}

const element=document.getElementById('root');
if(!element)throw new Error('ARF One School root element missing');
const root=createRoot(element);
root.render(<main className="min-h-screen bg-[#f6f3ec] flex items-center justify-center">
  <p className="text-sm font-semibold text-[#073b2d]">Memuat ARF One School...</p>
</main>);

// Delayed module import keeps the error screen available when configuration is
// absent, rather than failing the entire module graph before React mounts.
void import('./App.tsx').then(({default:App})=>{
  root.render(<AppBoundary><App/></AppBoundary>);
}).catch(error=>{
  console.error('ARF One School startup failure:',error);
  const configurationIssue=error instanceof Error && /konfigurasi Supabase|koneksi Supabase|supabaseUrl is required|supabaseKey is required/i.test(error.message);
  root.render(<LoadFailure detail={configurationIssue
    ? 'Konfigurasi koneksi Supabase untuk lingkungan deployment ini belum lengkap.'
    : 'Terjadi kegagalan memuat modul aplikasi.'}/>);
});

/**
 * Prevent a write that is stalled by a disconnected Supabase backend from
 * permanently disabling an editor. Timeouts do NOT cancel Supabase writes;
 * their eventual server outcome can be unknown.
 */
export class OperationTimeoutError extends Error {
  readonly code = 'operation/timeout';
  readonly stage: 'upload' | 'download-url' | 'firestore' | 'cleanup';
  constructor(stage: 'upload' | 'download-url' | 'firestore' | 'cleanup', timeoutMs: number) {
    super(`${stage} tidak memberikan respons dalam ${Math.round(timeoutMs / 1000)} detik.`);
    this.stage = stage;
    this.name = 'OperationTimeoutError';
  }
}

export function withTimeout<T>(
  operation: PromiseLike<T>,
  timeoutMs: number,
  stage: OperationTimeoutError['stage'],
  onTimeout?: () => void
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      try { onTimeout?.(); } catch (error) { console.warn('Gagal membatalkan operasi:', error); }
      reject(new OperationTimeoutError(stage, timeoutMs));
    }, timeoutMs);

    Promise.resolve(operation).then(
      result => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        resolve(result);
      },
      error => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export const DATABASE_SAVE_TIMEOUT_MS = 25_000;

export function photoSaveErrorMessage(error: unknown): string {
  if (error instanceof OperationTimeoutError) {
    if (error.stage === 'firestore') {
      return 'Penyimpanan ke Supabase melebihi 25 detik. Status penyimpanan belum dapat dipastikan. Periksa daftar data setelah koneksi pulih sebelum mencoba Simpan lagi agar tidak terjadi duplikasi.';
    }
    if (error.stage === 'upload') {
      return 'Upload gambar melebihi batas waktu. Proses dihentikan agar tombol Simpan dapat digunakan kembali. Periksa koneksi internet, Supabase Storage, dan Storage Rules, lalu coba lagi.';
    }
    if (error.stage === 'download-url') {
      return 'Foto mungkin berhasil diunggah, tetapi alamat gambar tidak dapat diperoleh. Periksa Supabase Storage dan izin membaca foto, lalu coba lagi.';
    }
    return 'Pembersihan gambar lama terlalu lama. Data yang sudah tersimpan tidak dibatalkan.';
  }
  const code = (error as { code?: string } | null)?.code;
  if (code === 'storage/unauthenticated') {
    return 'Upload foto memerlukan sesi Supabase Auth yang terverifikasi. Masuk melalui tautan email atau Google OAuth.';
  }
  if (code === 'storage/unauthorized') {
    return 'Supabase Storage menolak akses (storage/unauthorized). Pastikan pengguna login dengan Supabase Authentication dan Storage Rules telah diterapkan.';
  }
  if (code === 'storage/bucket-not-found' || code === 'storage/project-not-found') {
    return 'Bucket Supabase Storage belum tersedia atau tidak cocok dengan konfigurasi aplikasi. Aktifkan Storage di Supabase Console dan periksa bucket Storage.';
  }
  if (code === 'storage/retry-limit-exceeded' || code === 'storage/network-request-failed') {
    return 'Koneksi ke Supabase Storage gagal atau terlalu lambat. Periksa internet, konfigurasi Storage, dan izin akses lalu ulangi.';
  }
  if (code === 'storage/canceled') return 'Proses upload gambar dibatalkan.';
  if (code?.startsWith('storage/')) return `Gagal mengunggah foto (${code}). Periksa Supabase Storage dan Storage Rules.`;
  const rawMessage = error instanceof Error ? error.message : String(error || 'Gagal menyimpan data.');
  // handleSupabaseError may encode a JSON diagnostics payload; keep the UI readable.
  try {
    const details = JSON.parse(rawMessage);
    const description = String(details.error || '');
    if (description.includes('permission') || description.includes('PERMISSION_DENIED')) {
      return 'Supabase menolak penyimpanan (permission-denied). Periksa login Supabase Authentication dan aturan Supabase untuk data aset/fasilitas.';
    }
    if (description.includes('offline') || description.includes('unavailable')) {
      return 'Supabase tidak dapat dihubungi. Periksa koneksi internet dan status Supabase, lalu coba lagi.';
    }
    return 'Gagal menyimpan data di Supabase. Periksa koneksi serta aturan akses pada Supabase Console.';
  } catch { /* Ordinary errors need no JSON parsing. */ }
  return rawMessage;
}

import { createClient } from '@supabase/supabase-js';

/**
 * ARF One School must use its OWN Supabase project and Auth user pool.
 * Do not silently fall back to the ARF Workspace/Planner instance: that would
 * create learner records and users in the wrong Supabase project.
 */
const url = String(import.meta.env.VITE_SUPABASE_URL || '').trim();
const key = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();
const expectedProjectRef = 'tyonogxpoyzzzuxiwpwc';
const parsed = /^https:\/\/([a-z0-9]+)\.supabase\.co\/?$/.exec(url);
const projectRef = parsed?.[1] || '';
const disallowedSharedProject = 'ovfygxeqgpjezdhbidmo';

if (!url || !key) {
  throw new Error('ARF One School: konfigurasi Supabase khusus aplikasi belum lengkap. Tetapkan VITE_SUPABASE_URL dan VITE_SUPABASE_PUBLISHABLE_KEY dari project tyonogxpoyzzzuxiwpwc di Vercel.');
}
if (!projectRef || projectRef !== expectedProjectRef || projectRef === disallowedSharedProject) {
  throw new Error('ARF One School: koneksi Supabase tidak sesuai atau masih menuju proyek bersama. Akses diblokir untuk melindungi pemisahan data dan akun.');
}

export const supabase = createClient(url, key, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
});
export const STORAGE_BUCKET = 'arf-one-school';

import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || 'https://ovfygxeqgpjezdhbidmo.supabase.co';
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_LoGl9qSxmOMW5l1c3L0onA_JBVgmofJ';
export const supabase = createClient(url, key, {
  auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true },
});
export const STORAGE_BUCKET = 'arf-one-school';

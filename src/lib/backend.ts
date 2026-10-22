import { supabase } from './supabase';
export const db = {};
export const auth = {
  currentUser: null as null | { uid: string; email: string | null; displayName: string | null },
};
void supabase.auth.getSession().then(({data}) => {
  if (data.session?.user) auth.currentUser = { uid: data.session.user.id, email: data.session.user.email ?? null, displayName: data.session.user.user_metadata?.full_name ?? null };
});
supabase.auth.onAuthStateChange((_event, session) => {
  auth.currentUser = session?.user ? { uid: session.user.id, email: session.user.email ?? null, displayName: session.user.user_metadata?.full_name ?? null } : null;
});
export enum OperationType { CREATE='create', UPDATE='update', DELETE='delete', LIST='list', GET='get', WRITE='write' }
export function handleSupabaseError(error: unknown, op: OperationType, path: string | null): never {
  console.error('Supabase operation failed', { op, path, error });
  throw error instanceof Error ? error : new Error(String(error));
}

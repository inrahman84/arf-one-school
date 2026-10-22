/** Compatibility adapter: original Supabase-style data paths backed by dedicated
 * Supabase PostgreSQL document rows. No Supabase runtime dependencies.
 */
import { supabase } from './supabase';
export type DocumentRef = { path: string; id: string; kind: 'doc' };
export type CollectionRef = { path: string; kind: 'collection' };
export type Condition = { kind: 'where' | 'orderBy' | 'limit'; field?: string; op?: string; value?: any };
export type QueryRef = { path: string; kind: 'query'; conditions: Condition[] };
const pathFor = (args: unknown[]) => args.filter(v => typeof v === 'string').join('/');
export function collection(_db: unknown, ...segments: string[]): CollectionRef { return { path: pathFor(segments), kind: 'collection' }; }
export function doc(_db: unknown, ...segments: string[]): DocumentRef {
  const path = pathFor(segments); return { path, id: path.split('/').at(-1) || '', kind: 'doc' };
}
export function where(field: string, op: string, value: any): Condition { return { kind: 'where', field, op, value }; }
export function orderBy(field: string, value: string = 'asc'): Condition { return { kind: 'orderBy', field, value }; }
export function limit(value: number): Condition { return { kind: 'limit', value }; }
export function query(ref: CollectionRef, ...conditions: Condition[]): QueryRef { return { path: ref.path, kind: 'query', conditions }; }
function schoolFromPath(path: string): string | null {
  const segments = path.split('/');
  return segments[0] === 'schools' && segments[1] ? segments[1] : null;
}
function unwrap(row: { doc_id: string; content: any; path: string }) {
  return { id: row.doc_id, ref: { path: row.path, id: row.doc_id, kind: 'doc' } as DocumentRef,
    data: () => ({ ...row.content }) };
}
export async function getDocs(ref: CollectionRef | QueryRef) {
  // Pagination prevents the PostgREST default of truncating collection results.
  const rows: { doc_id: string; content: any; path: string }[] = [];
  let from = 0; const pageSize = 500;
  while (true) {
    const {data, error} = await supabase.from('arf_school_documents')
      .select('doc_id,content,path').eq('collection_path', ref.path).range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  let list = rows;
  for (const c of (ref.kind === 'query' ? ref.conditions : [])) {
    if (c.kind === 'where') {
      list = list.filter(x => {
        const value = x.content?.[c.field || ''];
        if (c.op === '==') return value === c.value;
        if (c.op === '!=') return value !== c.value;
        if (c.op === 'in') return Array.isArray(c.value) && c.value.includes(value);
        return false;
      });
    }
    if (c.kind === 'orderBy') list.sort((a,b) => {
      const va=a.content?.[c.field || '']; const vb=b.content?.[c.field || ''];
      const cmp=String(va??'').localeCompare(String(vb??''));
      return c.value === 'desc' ? -cmp : cmp;
    });
    if (c.kind === 'limit') list = list.slice(0, Number(c.value));
  }
  const docs=list.map(unwrap);
  return { docs, empty: docs.length === 0, size: docs.length };
}
export async function getDoc(ref: DocumentRef) {
  const {data,error} = await supabase.from('arf_school_documents')
    .select('doc_id,content,path').eq('path',ref.path).maybeSingle();
  if (error) throw error;
  return { id: ref.id, exists: () => !!data, data: () => data?.content ?? {}, ref };
}
export async function setDoc(ref: DocumentRef, payload: Record<string, any>, opts?: {merge?: boolean}) {
  const segments=ref.path.split('/');
  const collectionPath=segments.slice(0,-1).join('/');
  const data=opts?.merge ? {...(await getDoc(ref)).data(), ...payload} : payload;
  const {error} = await supabase.from('arf_school_documents').upsert({
    path: ref.path, collection_path: collectionPath, doc_id: ref.id,
    school_id: schoolFromPath(ref.path), content: data,
  }, {onConflict:'path'});
  if (error) throw error;
}
export async function updateDoc(ref: DocumentRef, payload: Record<string, any>) {
  const existing = await getDoc(ref);
  if (!existing.exists()) throw new Error('Data tidak ditemukan: '+ref.path);
  return setDoc(ref, payload, {merge:true});
}
export async function deleteDoc(ref: DocumentRef) {
  const {error} = await supabase.from('arf_school_documents').delete().eq('path',ref.path);
  if (error) throw error;
}
export async function addDoc(ref: CollectionRef, payload: Record<string, any>) {
  const id=crypto.randomUUID();
  const target={path:`${ref.path}/${id}`,id,kind:'doc' as const};
  await setDoc(target,payload);return target;
}

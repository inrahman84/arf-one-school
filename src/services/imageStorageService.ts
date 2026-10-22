import { supabase,STORAGE_BUCKET } from '../lib/supabase';
import { withTimeout } from './operationTimeout';
export interface StoredImage {url:string;path:string}
export const MAX_IMAGE_SIZE=5*1024*1024;
export const IMAGE_UPLOAD_TIMEOUT_MS=30_000;
const ALLOWED:Record<string,string>={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
export function validateImageFile(file:File):void {if(!ALLOWED[file.type])throw new Error('Format foto harus JPG, PNG, atau WebP.');if(!file.size||file.size>MAX_IMAGE_SIZE)throw new Error('Ukuran foto maksimal 5 MB.');}
function safe(v:string){return v.replace(/[^a-zA-Z0-9_-]/g,'_').slice(0,100)||'unknown';}
export function checkImageUploadReady(){if(typeof navigator!=='undefined'&&!navigator.onLine)throw new Error('Perangkat sedang offline.');}
export const imageStorageService={
  async getImageUrl(path?:string):Promise<string|undefined>{
    if(!path)return undefined;
    const {data,error}=await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path,3600);
    if(error){console.warn('Foto tidak dapat dibaca:',error.message);return undefined;}
    return data.signedUrl;
  },
  async uploadImage(file:File,schoolId:string,recordType:'assets'|'facilities',recordId:string,
    photoType:'asset'|'physical'|'damage',onProgress?:(percent:number)=>void):Promise<StoredImage>{
    validateImageFile(file);checkImageUploadReady();
    const {data:session}=await supabase.auth.getSession();if(!session.session)throw new Error('Harus login ke Supabase sebelum mengunggah foto.');
    const path=`schools/${safe(schoolId)}/${recordType}/${safe(recordId)}/${photoType}/${crypto.randomUUID()}.${ALLOWED[file.type]}`;
    onProgress?.(10);
    const {error}=await withTimeout(supabase.storage.from(STORAGE_BUCKET).upload(path,file,{contentType:file.type,upsert:false}),IMAGE_UPLOAD_TIMEOUT_MS,'upload');
    if(error)throw error;onProgress?.(100);
    const url=await this.getImageUrl(path);
    if(!url)throw new Error('Unggahan berhasil tetapi URL foto tidak dapat diperoleh. Periksa Storage RLS.');
    return {url,path};
  },
  async removeImage(path?:string):Promise<void>{
    if(!path?.startsWith('schools/'))return;
    const {error}=await withTimeout(supabase.storage.from(STORAGE_BUCKET).remove([path]),10000,'cleanup');if(error)throw error;
  },
  async cleanupImages(paths:(string|undefined)[]):Promise<void>{
    const results=await Promise.allSettled(paths.filter(Boolean).map(path=>this.removeImage(path)));
    for(const result of results)if(result.status==='rejected')console.warn('Gagal menghapus foto:',result.reason);
  },
};

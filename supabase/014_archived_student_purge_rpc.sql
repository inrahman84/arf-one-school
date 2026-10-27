-- ARF One School: irreversible student archive purge, only on dedicated target.
-- Data from other applications and the shared ARF Workspace project is never touched.
-- This function runs as SECURITY DEFINER because studentPrivate has tighter RLS.
-- Only an authenticated ACTIVE SUPER_ADMIN of this project may invoke it.
create or replace function public.arf_purge_archived_student(p_school_id text,p_student_id text)
returns void
language plpgsql security definer set search_path = ''
as $function$
declare
  v_actor uuid;
  v_path text;
  v_roster jsonb;
  v_audit_id text;
begin
  v_actor := (select auth.uid());
  if v_actor is null or not exists (
    select 1 from public.arf_school_members m
    where m.user_id=v_actor and m.role='SUPER_ADMIN'
      and m.status='ACTIVE' and m.deleted_at is null
  ) then
    raise exception 'Hanya Super Admin aktif yang boleh menghapus permanen peserta didik.'
      using errcode='42501';
  end if;

  if p_school_id is null or p_student_id is null
    or length(p_school_id) not between 1 and 128
    or length(p_student_id) not between 1 and 200
    or position('/' in p_school_id)>0 or position('/' in p_student_id)>0
  then
    raise exception 'Identitas sekolah atau peserta didik tidak valid.';
  end if;

  v_path := 'schools/' || p_school_id || '/students/' || p_student_id;
  select d.content into v_roster from public.arf_school_documents d
  where d.path=v_path and d.collection_path='schools/'||p_school_id||'/students'
    and d.school_id=p_school_id and d.doc_id=p_student_id
  for update;
  if not found then
    raise exception 'Peserta didik tidak ditemukan pada sekolah yang dimaksud.';
  end if;
  if nullif(btrim(v_roster->>'archived_at'),'') is null then
    raise exception 'Peserta didik harus diarsipkan terlebih dahulu sebelum dihapus permanen.';
  end if;

  -- Delete the exact student's confidential child/family document.
  delete from public.arf_school_documents d
   where d.path='schools/'||p_school_id||'/studentPrivate/'||p_student_id
     and d.collection_path='schools/'||p_school_id||'/studentPrivate'
     and d.school_id=p_school_id and d.doc_id=p_student_id;

  -- Delete associated per-student movement events, not unrelated school events.
  delete from public.arf_school_documents d
   where d.collection_path='schools/'||p_school_id||'/studentMovements'
     and d.school_id=p_school_id and d.content->>'student_id'=p_student_id;

  delete from public.arf_school_documents d
   where d.path=v_path and d.school_id=p_school_id and d.doc_id=p_student_id
     and d.collection_path='schools/'||p_school_id||'/students';

  -- Retain a minimal accountability event. Do not log names, ID numbers,
  -- address, private details, or copies of the deleted data.
  v_audit_id := gen_random_uuid()::text;
  insert into public.arf_school_documents
    (path,collection_path,doc_id,school_id,content)
  values (
    'auditLogs/'||v_audit_id,'auditLogs',v_audit_id,null,
    jsonb_build_object(
      'actorUid',v_actor::text,
      'action','PURGE_ARCHIVED_STUDENT',
      'entity','StudentRecord',
      'entityId','[deleted]',
      'schoolId',p_school_id,
      'details','Arsip peserta didik dan dokumen terkait dihapus permanen oleh Super Admin',
      'timestamp',now()
    )
  );
end;
$function$;

revoke all on function public.arf_purge_archived_student(text,text) from public,anon;
grant execute on function public.arf_purge_archived_student(text,text) to authenticated;
comment on function public.arf_purge_archived_student(text,text) is
 'Irreversibly deletes ONLY an archived student record, private details and related movement events after verifying the current authenticated user is ACTIVE SUPER_ADMIN. Audit event retained.';

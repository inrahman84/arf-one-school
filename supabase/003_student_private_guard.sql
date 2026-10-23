-- Additional RLS restriction for highly sensitive child/family/banking/health details.
-- Base arf_doc_* school access policies still apply.
create or replace function arf_internal.student_private_doc_allowed(p_collection text)
returns boolean language sql stable security definer set search_path = ''
as $$
 select case
 when p_collection ~ '^schools/[^/]+/studentPrivate$' then exists(
  select 1 from public.arf_school_members m
  where m.user_id=(select auth.uid()) and m.status='ACTIVE'
   and m.role in ('SUPER_ADMIN','SCHOOL_PRINCIPAL','SCHOOL_OPERATOR')
 )
 else true end
$$;
revoke all on function arf_internal.student_private_doc_allowed(text) from public;
grant usage on schema arf_internal to authenticated;
grant execute on function arf_internal.student_private_doc_allowed(text) to authenticated;
drop policy if exists arf_student_private_guard on public.arf_school_documents;
create policy arf_student_private_guard on public.arf_school_documents as restrictive
for all to authenticated
using (arf_internal.student_private_doc_allowed(collection_path))
with check (arf_internal.student_private_doc_allowed(collection_path));

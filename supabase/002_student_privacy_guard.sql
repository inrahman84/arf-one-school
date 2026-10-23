-- ARF One School: additional restriction for identifiable child records.
-- Existing school membership RLS remains mandatory; this policy only narrows access
-- for the students and studentMovements school-scoped document collections.
-- Role grants are checked from arf_school_members, NEVER mutable JWT user_metadata.
create or replace function arf_internal.student_doc_role_allowed(p_collection text)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select case
    when p_collection ~ '^schools/[^/]+/(students|studentMovements)$'
    then exists (
      select 1
      from public.arf_school_members m
      where m.user_id = (select auth.uid())
        and m.status = 'ACTIVE'
        and m.role in ('SUPER_ADMIN','FOUNDATION_MANAGER','REGIONAL_LEAD','SCHOOL_PRINCIPAL','SCHOOL_OPERATOR')
    )
    else true
  end;
$$;
revoke all on function arf_internal.student_doc_role_allowed(text) from public;
grant usage on schema arf_internal to authenticated;
grant execute on function arf_internal.student_doc_role_allowed(text) to authenticated;
drop policy if exists arf_student_privacy_guard on public.arf_school_documents;
create policy arf_student_privacy_guard
on public.arf_school_documents
as restrictive for all to authenticated
using (arf_internal.student_doc_role_allowed(collection_path))
with check (arf_internal.student_doc_role_allowed(collection_path));

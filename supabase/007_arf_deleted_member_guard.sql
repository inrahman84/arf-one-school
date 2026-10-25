-- Deleted ARF members may not be revived through a simple UPDATE status.
-- The underlying auth.users row belongs to shared Auth and is not deleted.
ALTER TABLE public.arf_school_members
 DROP CONSTRAINT IF EXISTS arf_school_member_deleted_inactive;
ALTER TABLE public.arf_school_members
 ADD CONSTRAINT arf_school_member_deleted_inactive
 CHECK (deleted_at IS NULL OR status='INACTIVE');
CREATE OR REPLACE FUNCTION arf_internal.is_school_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 select exists(select 1 from public.arf_school_members m
  where m.user_id=(select auth.uid()) and m.status='ACTIVE'
    and m.role='SUPER_ADMIN' and m.deleted_at is null);
$$;

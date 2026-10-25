-- ARF user provisioning and scoped soft removal.
-- Do NOT delete auth.users: the Supabase Auth instance also serves other apps.
ALTER TABLE public.arf_school_members
 ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_arf_school_members_active_email
 ON public.arf_school_members (lower(email)) WHERE deleted_at IS NULL;
-- New signups receive operator as default; no assigned schools/regions.
ALTER TABLE public.arf_school_members ALTER COLUMN status SET DEFAULT 'ACTIVE';
CREATE OR REPLACE FUNCTION arf_internal.add_arf_school_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF new.email IS NULL THEN RETURN new; END IF;
 INSERT INTO public.arf_school_members(
    user_id,email,display_name,position,role,
    assigned_schools,assigned_regions,status
 )
 VALUES (
   new.id,lower(new.email),
   left(coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'),''),
         split_part(new.email,'@',1)),150),
   null,'SCHOOL_OPERATOR',ARRAY[]::text[],ARRAY[]::text[],'ACTIVE'
 )
 ON CONFLICT (user_id) DO NOTHING;
 RETURN new;
END;
$$;
-- User management is admin-only; directly granting role from untrusted
-- metadata or a userInvitations document is intentionally prohibited.

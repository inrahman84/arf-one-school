-- Bootstrap exactly one verified email owner on dedicated Supabase ARF One School.
-- Run ONLY AFTER the legitimate owner signs up and confirms their email.
-- Target project: tyonogxpoyzzzuxiwpwc. NEVER run on ARF Workspace/Planner.
-- Operator must independently verify target DB connection and own the account.
BEGIN;
DO $$
DECLARE
  v_user_id uuid;
  v_admins int;
BEGIN
  SELECT count(*) INTO v_admins FROM public.arf_school_members
   WHERE role='SUPER_ADMIN' AND status='ACTIVE' AND deleted_at IS NULL;
  IF v_admins <> 0 THEN
    RAISE EXCEPTION 'Bootstrap refused: target already has % active Super Admin(s)',v_admins;
  END IF;

  SELECT id INTO v_user_id FROM auth.users
   WHERE lower(email)='iswahyudhi.r@sumbermassarana.sch.id'
     AND email_confirmed_at IS NOT NULL
   LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Bootstrap refused: owner Auth identity does not exist or email is not verified in dedicated project';
  END IF;
  -- Preserve the auth account and user-selected password; only the dedicated
  -- One School membership changes. Authorization is NOT derived from user_metadata.
  INSERT INTO public.arf_school_members
    (user_id,email,display_name,role,status,assigned_schools,assigned_regions)
  SELECT id,lower(email),
    coalesce(nullif(trim(raw_user_meta_data->>'full_name'),''),
             split_part(email,'@',1)),
    'SUPER_ADMIN','ACTIVE',array[]::text[],array[]::text[]
  FROM auth.users WHERE id=v_user_id
  ON CONFLICT (user_id) DO UPDATE
    SET role='SUPER_ADMIN',status='ACTIVE',deleted_at=NULL,
        assigned_schools=array[]::text[],
        assigned_regions=array[]::text[],updated_at=now();
END $$;
COMMIT;

SELECT count(*)::int AS verified_active_super_admins
FROM public.arf_school_members m JOIN auth.users u ON u.id=m.user_id
WHERE m.role='SUPER_ADMIN' AND m.status='ACTIVE'
  AND m.deleted_at IS NULL AND u.email_confirmed_at IS NOT NULL
  AND lower(u.email)='iswahyudhi.r@sumbermassarana.sch.id';

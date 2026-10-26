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
   WHERE lower(email)='iswahyudhi.nr@gmail.com'
     AND email_confirmed_at IS NOT NULL
   LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Bootstrap refused: owner Auth identity does not exist or email is not verified in dedicated project';
  END IF;
  -- Must match the current school-operator membership; refuse revival of
  -- deleted or otherwise unapproved accounts.
  IF NOT EXISTS (
    SELECT 1 FROM public.arf_school_members
    WHERE user_id=v_user_id AND status='ACTIVE'
      AND role='SCHOOL_OPERATOR' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Bootstrap refused: account is not an active, nondeleted SCHOOL_OPERATOR';
  END IF;
  -- Preserve the auth account and user-selected password; only the dedicated
  -- One School membership changes. Authorization is NOT derived from user_metadata.
  UPDATE public.arf_school_members
   SET role='SUPER_ADMIN', assigned_schools=array[]::text[],
       assigned_regions=array[]::text[], updated_at=now()
   WHERE user_id=v_user_id AND role='SCHOOL_OPERATOR'
     AND status='ACTIVE' AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'Bootstrap update did not complete'; END IF;
END $$;
COMMIT;

SELECT count(*)::int AS verified_active_super_admins
FROM public.arf_school_members m JOIN auth.users u ON u.id=m.user_id
WHERE m.role='SUPER_ADMIN' AND m.status='ACTIVE'
  AND m.deleted_at IS NULL AND u.email_confirmed_at IS NOT NULL
  AND lower(u.email)='iswahyudhi.nr@gmail.com';

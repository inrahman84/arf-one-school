-- Profile membership mutations must be authorized on the server, never by
-- direct authenticated PostgREST UPDATE. Edge Function service_role bypasses
-- RLS after validating the caller's live session and active Super Admin role.
DROP POLICY IF EXISTS arf_member_admin_update ON public.arf_school_members;

-- Apply ONLY to the dedicated ARF One School Supabase project.
-- Legacy pre-authorization must not grant roles through INSERT; the trusted
-- admin Edge Function now handles membership grants after JWT verification.
DROP TRIGGER IF EXISTS on_arf_school_invite_insert ON public.arf_school_documents;
DROP FUNCTION IF EXISTS arf_internal.activate_arf_school_invitation();

-- Fix Supabase Studio CSV import: SQL NULL sometimes arrives as text 'null'.
-- Applies ONLY to ARF One School target, never ARF Workspace/Planner.
-- Preserve strict school_id identity for all school and nested-school rows.
BEGIN;
DO $$
BEGIN
 IF (SELECT project_ref FROM arf_migration.project_identity WHERE singleton IS TRUE)
    IS DISTINCT FROM 'tyonogxpoyzzzuxiwpwc' THEN
    RAISE EXCEPTION 'Wrong Supabase project; refusing CSV validation change';
 END IF;
 IF (SELECT count(*) FROM arf_migration.csv_inbox)<>0 THEN
    RAISE EXCEPTION 'CSV inbox is not empty; investigate import before changing constraints';
 END IF;
END $$;
ALTER TABLE arf_migration.csv_inbox
 DROP CONSTRAINT csv_inbox_school_scope;
ALTER TABLE arf_migration.csv_inbox
 ADD CONSTRAINT csv_inbox_school_scope CHECK (
   (collection_path='schools' AND school_id=doc_id)
   OR (collection_path LIKE 'schools/%' AND school_id=split_part(path,'/',2))
   OR (collection_path<>'schools' AND collection_path NOT LIKE 'schools/%'
       AND (school_id IS NULL OR lower(btrim(school_id)) IN ('null','')))
 );
COMMIT;

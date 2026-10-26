-- Stage 2.2: RUN ONLY AFTER privileged Table Editor import populated
-- arf_migration.csv_inbox on project tyonogxpoyzzzuxiwpwc.
-- No user secrets, source DB, or Auth tables are touched.
-- Stage is PRIVATE; no live school records are changed by this file.
BEGIN;
DO $$
DECLARE v_import_count integer; v_stage_count integer; v_invalid integer;
BEGIN
 IF (SELECT project_ref FROM arf_migration.project_identity WHERE singleton) <> 'tyonogxpoyzzzuxiwpwc'
 THEN RAISE EXCEPTION 'WRONG PROJECT: abort import'; END IF;
 SELECT count(*) INTO v_import_count FROM arf_migration.csv_inbox;
 IF v_import_count <> 133
 THEN RAISE EXCEPTION 'Expected 133 imported source rows, got %; source may have changed, do not continue',v_import_count; END IF;
 SELECT count(*) INTO v_stage_count FROM arf_migration.document_stage;
 IF v_stage_count <> 0 THEN
   RAISE EXCEPTION 'Destination private staging already has % rows, review before importing',v_stage_count;
 END IF;
 SELECT count(*) INTO v_invalid FROM arf_migration.csv_inbox
 WHERE collection_path='userInvitations';
 IF v_invalid <> 2 THEN
   RAISE EXCEPTION 'Legacy invitation count %, expected 2; review before importing',v_invalid;
 END IF;
END
$$;
INSERT INTO arf_migration.document_stage
 (path,collection_path,doc_id,school_id,content,created_at,updated_at)
SELECT path,collection_path,doc_id,school_id,
       convert_from(decode(content_b64,'base64'),'UTF8')::jsonb,
       created_at,updated_at
FROM arf_migration.csv_inbox
ORDER BY path;
-- Snapshot integrity check: stage must match inbox document count and
-- each content must be decodable to JSON object (protected by stage constraint).
DO $$
DECLARE v_inbox integer; v_stage integer; v_differences integer;
BEGIN
 SELECT count(*) INTO v_inbox FROM arf_migration.csv_inbox;
 SELECT count(*) INTO v_stage FROM arf_migration.document_stage;
 IF v_stage<>v_inbox THEN
   RAISE EXCEPTION 'Import mismatch: inbox % vs stage %',v_inbox,v_stage;
 END IF;
 SELECT count(*) INTO v_differences
 FROM arf_migration.csv_inbox i JOIN arf_migration.document_stage s USING (path)
 WHERE i.collection_path IS DISTINCT FROM s.collection_path
    OR i.doc_id IS DISTINCT FROM s.doc_id
    OR i.school_id IS DISTINCT FROM s.school_id
    OR convert_from(decode(i.content_b64,'base64'),'UTF8')::jsonb IS DISTINCT FROM s.content
    OR i.created_at IS DISTINCT FROM s.created_at
    OR i.updated_at IS DISTINCT FROM s.updated_at;
 IF v_differences<>0 THEN
   RAISE EXCEPTION 'Data corrupted or mismatched in % rows',v_differences;
 END IF;
END
$$;
COMMIT;
-- No personal data in verification query:
SELECT collection_path,count(*) AS stage_rows,
  encode(sha256(convert_to(string_agg(path||':'||
  encode(sha256(convert_to(content::text,'UTF8')),'hex'),E'\n' ORDER BY path),'UTF8')),'hex') AS collection_checksum
FROM arf_migration.document_stage
GROUP BY collection_path ORDER BY collection_path;

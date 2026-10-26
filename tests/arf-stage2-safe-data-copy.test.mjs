import {spawnSync as nodeSpawnSync} from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('stage2 private schema cannot be accessed by app roles and schema has privacy-friendly constraints',()=>{
 const sql=read('supabase/010_stage2_private_document_staging.sql');
 assert.match(sql,/create schema if not exists arf_migration/i);
 assert.match(sql,/revoke all on schema arf_migration from public, anon, authenticated/i);
 assert.match(sql,/alter table arf_migration\.document_stage enable row level security/i);
 assert.match(sql,/revoke all on arf_migration\.document_stage from public, anon, authenticated/i);
 assert.match(sql,/constraint stage_path_identity check/i);
 assert.match(sql,/constraint stage_school_scope check/i);
 assert.match(sql,/content jsonb not null/i);
});
test('stage2 promotion refuses conflicts and never overrides old or pending invitation records',()=>{
 const sql=read('supabase/stage2_promote_verified_documents.sql');
 assert.match(sql,/begin;/i);
 assert.match(sql,/set local arf_migration\.expected_stage_rows = '133'/i);
 assert.match(sql,/staged_rows <> expected_rows/i);
 assert.match(sql,/conflict_rows>0/);
 assert.match(sql,/raise exception 'Found % conflicting target documents/);
 assert.match(sql,/bad_private_roster>0/);
 assert.match(sql,/collection_path <> 'userInvitations'/);
 assert.match(sql,/on conflict\(path\) do nothing/i);
 assert.doesNotMatch(sql,/delete from public\.arf_school_documents/i);
 assert.doesNotMatch(sql,/update public\.arf_school_documents/i);
});
test('encrypted stage2 transfer never outputs plaintext snapshots to disk',()=>{
 const sh=read('scripts/arf_stage2_encrypted_transfer.sh');
 assert.match(sh,/set -Eeuo pipefail/);
 assert.match(sh,/umask 077/);
 assert.match(sh,/SOURCE_SERVICE/);
 assert.match(sh,/TARGET_SERVICE/);
 assert.match(sh,/age -r "\$AGE_RECIPIENT" -o "\$ENCRYPTED_EXPORT"/);
 assert.match(sh,/age -d -i "\$AGE_IDENTITY_FILE" "\$ENCRYPTED_EXPORT"/);
 assert.match(sh,/age -d .*?\|\s*psql/s);
 assert.match(sh,/select count\(\*\) from arf_migration\.document_stage/);
 assert.match(sh,/tyonogxpoyzzzuxiwpwc/);
 assert.doesNotMatch(sh,/> .*\.csv(\s|$)/);
 assert.doesNotMatch(sh,/\bTRUNCATE\b/i);
});
test('docs explicitly block migration before backup and production cutover',()=>{
 const guide=read('PANDUAN-TAHAP-2-MIGRASI-DATA-ARF-ONE-SCHOOL.md');
 assert.match(guide,/Backup terenkripsi Tahap 1/);
 assert.match(guide,/belum terkonfirmasi/);
 assert.match(guide,/write freeze/);
 assert.match(guide,/131/);
 assert.match(guide,/0 aktif/);
});

// Run syntax check on the script without connecting to Supabase or reading secrets.
test('stage2 script passes bash syntax check and guards the target project identity',()=>{
 const {spawnSync}=requireBuiltinSpawn();
 const result=spawnSync('bash',['-n',new URL('../scripts/arf_stage2_encrypted_transfer.sh',import.meta.url).pathname],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 const source=read('scripts/arf_stage2_encrypted_transfer.sh');
 assert.match(source,/arf_migration\.project_identity/);
 assert.match(source,/source_manifest/);
 assert.match(source,/target_manifest/);
 assert.match(source,/CHECKSUM PASS/);
});
function requireBuiltinSpawn(){return {spawnSync:nodeSpawnSync};}

test('Studio CSV literal null is accepted only for unscoped document schools and normalized on staging',()=>{
 const migration=read('supabase/013_fix_csv_import_literal_null_school_id.sql');
 const importSql=read('supabase/stage2_import_private_csv_inbox_to_staging.sql');
 assert.match(migration,/lower\(btrim\(school_id\)\) IN \('null',''\)/i);
 assert.match(migration,/collection_path LIKE 'schools\/%' AND school_id=split_part/i);
 assert.match(migration,/project_ref FROM arf_migration\.project_identity/);
 assert.match(importSql,/CASE WHEN collection_path<>'schools' AND collection_path NOT LIKE 'schools\/%'/);
 assert.match(importSql,/CASE WHEN i\.collection_path<>'schools' AND i\.collection_path NOT LIKE 'schools\/%'/);
 assert.match(importSql,/IS DISTINCT FROM s\.school_id/);
});

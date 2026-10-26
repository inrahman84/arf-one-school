-- Execute from the TARGET database ONLY after:
-- (1) original source remains intact; an operator-held CSV snapshot was exported,
-- (2) compare SHA-256 of all source vs staging collections immediately before promotion,
-- (3) all source rows have arrived in arf_migration.document_stage,
-- (4) SOURCE and imported CSV snapshot have identical full collection digests.
--
-- Use psql with -v ON_ERROR_STOP=1 against the dedicated target,
-- NEVER the ARF Workspace / Planner source.
-- Adjust the expected count to the actual verified source snapshot if needed.
begin;
set local arf_migration.expected_stage_rows = '133';

do $$
declare
  expected_rows integer;
  staged_rows integer;
  conflict_rows integer;
  bad_private_roster integer;
  to_promote integer;
  legacy_invites integer;
begin
  if (select project_ref from arf_migration.project_identity where singleton=true) is distinct from 'tyonogxpoyzzzuxiwpwc' then
    raise exception 'Incorrect destination project; abort';
  end if;
  expected_rows := nullif(current_setting('arf_migration.expected_stage_rows',true),'')::integer;
  select count(*) into staged_rows from arf_migration.document_stage;
  if expected_rows is null or expected_rows <= 0 or staged_rows <> expected_rows then
    raise exception 'Stage row count %, expected %: abort', staged_rows, expected_rows;
  end if;

  select count(*) into legacy_invites from arf_migration.document_stage
  where collection_path='userInvitations';
  if legacy_invites <> 2 then raise exception 'Expected 2 archived legacy invitations, found %', legacy_invites; end if;

  -- Destination contents must NEVER be overwritten if they differ.
  select count(*) into conflict_rows
  from arf_migration.document_stage s
  join public.arf_school_documents d on d.path=s.path
  where d.collection_path is distinct from s.collection_path
     or d.doc_id is distinct from s.doc_id
     or d.school_id is distinct from s.school_id
     or d.content is distinct from s.content;
  if conflict_rows>0 then
    raise exception 'Found % conflicting target documents: manual resolution required',conflict_rows;
  end if;

  -- Check privacy/roster constraints before touching the live app table.
  select count(*) into bad_private_roster
  from arf_migration.document_stage s
  where s.collection_path ~ '^schools/[^/]+/students$'
   and s.content ?| array[
    'nik','family_card_number','father','mother','guardian',
    'bank','bank_account','bank_account_name','religion','address',
    'special_needs','latitude','longitude','birth_date',
    'weight_kg','height_cm','head_circumference_cm',
    'kip_number','kps_number','kks_number','pip_reason'
   ];
  if bad_private_roster>0 then
    raise exception 'Found % roster rows containing private fields: abort',bad_private_roster;
  end if;

  select count(*) into to_promote from arf_migration.document_stage s
    where s.collection_path<>'userInvitations'
    and not exists(select 1 from public.arf_school_documents d where d.path=s.path);
  raise notice 'Staged %, legacy invitations excluded %, new rows to promote %, conflicts 0',
    staged_rows,legacy_invites,to_promote;
end $$;

-- A single idempotent insert, constrained by destination RLS/constraints.
-- Historical pending invitations deliberately stay ONLY in private staging.
insert into public.arf_school_documents (
  path,collection_path,doc_id,school_id,content,created_at,updated_at
)
select s.path,s.collection_path,s.doc_id,s.school_id,s.content,s.created_at,s.updated_at
from arf_migration.document_stage s
where s.collection_path <> 'userInvitations'
on conflict(path) do nothing;

-- Atomic end-of-transaction verification. Stop and rollback on ANY mismatch.
do $
declare v_live integer; v_diff integer; v_extra integer;
begin
  select count(*) into v_live from public.arf_school_documents;
  if v_live <> 131 then
    raise exception 'Expected 131 live documents, found %, rolling back', v_live;
  end if;
  select count(*) into v_diff
  from arf_migration.document_stage s
  left join public.arf_school_documents d on s.path=d.path
  where s.collection_path <> 'userInvitations'
    and (d.path is null or d.content is distinct from s.content
         or d.doc_id is distinct from s.doc_id
         or d.school_id is distinct from s.school_id
         or d.collection_path is distinct from s.collection_path);
  if v_diff <> 0 then
    raise exception '% restored documents differ from staging, rolling back', v_diff;
  end if;
  select count(*) into v_extra from public.arf_school_documents
  where collection_path='userInvitations';
  if v_extra <> 0 then
    raise exception 'Archived invitations present in live documents, rolling back';
  end if;
end $;
commit;

-- Verification: ZERO conflicts; source needs its own parallel checksum
-- validation before cutover and once more after the final delta.
select collection_path,count(*)::integer as destination_count,
 encode(sha256(convert_to(coalesce(string_agg(
  path || ':' || encode(sha256(convert_to(content::text,'UTF8')),'hex'),
  E'\n' order by path),''),'UTF8')),'hex') as destination_collection_sha256
from public.arf_school_documents
group by collection_path order by collection_path;

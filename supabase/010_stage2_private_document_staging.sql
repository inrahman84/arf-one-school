-- STAGE 2: Private landing zone for encrypted, selective document migration.
-- Apply ONLY on Supabase ARF ONE SCHOOL (tyonogxpoyzzzuxiwpwc).
-- Never apply on source ARF Workspace / Planner.
-- Source database and auth.users are never modified by this migration.
create schema if not exists arf_migration;
revoke all on schema arf_migration from public, anon, authenticated;
create table if not exists arf_migration.document_stage (
  path text primary key,
  collection_path text not null,
  doc_id text not null,
  school_id text,
  content jsonb not null,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  loaded_at timestamptz not null default now(),
  constraint stage_path_identity check (path=collection_path||'/'||doc_id),
  constraint stage_school_scope check (
    (collection_path='schools' and school_id=doc_id)
    or (collection_path like 'schools/%' and school_id=split_part(path,'/',2))
    or (collection_path<>'schools' and collection_path not like 'schools/%' and school_id is null)
  ),
  constraint stage_json_object check (jsonb_typeof(content)='object')
);
alter table arf_migration.document_stage enable row level security;
revoke all on arf_migration.document_stage from public, anon, authenticated;
create index if not exists stage_collection_idx on arf_migration.document_stage(collection_path);
comment on table arf_migration.document_stage is
  'Private, server-import-only staging for ARF One School migration. Never expose via Data API. Contains child records; delete under retention policy after verification.';

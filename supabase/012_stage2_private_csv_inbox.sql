-- Private CSV inbox for a no-terminal transfer initiated in Supabase Dashboard.
-- ONLY apply on dedicated target tyonogxpoyzzzuxiwpwc.
-- Base64 is transport encoding, NOT encryption. Source contains child/family data.
create table if not exists arf_migration.csv_inbox (
 path text primary key,
 collection_path text not null,
 doc_id text not null,
 school_id text,
 content_b64 text not null,
 created_at timestamptz not null,
 updated_at timestamptz not null,
 imported_at timestamptz not null default now(),
 constraint csv_inbox_path_identity check(path=collection_path||'/'||doc_id),
 constraint csv_inbox_school_scope check (
   (collection_path='schools' and school_id=doc_id)
   or (collection_path like 'schools/%' and school_id=split_part(path,'/',2))
   or (collection_path<>'schools' and collection_path not like 'schools/%' and school_id is null)
 ),
 constraint csv_inbox_b64_format check(content_b64~'^[A-Za-z0-9+/]+={0,2}$')
);
revoke all on arf_migration.csv_inbox from public,anon,authenticated;
alter table arf_migration.csv_inbox enable row level security;
comment on table arf_migration.csv_inbox is
 'PRIVATE CSV import inbox using Base64-encoded JSONB for one-time browser transfer. Encoding is NOT encryption. Access only via privileged Supabase Studio. Delete after verified restoration and retention authorization.';

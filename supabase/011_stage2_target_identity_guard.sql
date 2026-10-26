-- Migration endpoint guard. Apply ONLY in Supabase project tyonogxpoyzzzuxiwpwc.
-- Not exposed to PostgREST. Used by offline encrypted migration to reject
-- mistaken connections to ARF Workspace / Planner.
create table if not exists arf_migration.project_identity (
  singleton boolean primary key default true check(singleton),
  project_ref text not null check(project_ref='tyonogxpoyzzzuxiwpwc')
);
revoke all on arf_migration.project_identity from public, anon, authenticated;
alter table arf_migration.project_identity enable row level security;
insert into arf_migration.project_identity(singleton,project_ref)
values(true,'tyonogxpoyzzzuxiwpwc')
on conflict(singleton) do nothing;

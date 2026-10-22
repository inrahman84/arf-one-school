-- ARF One School, isolated from existing ARF Planner tables.
-- The source application's Firestore collection paths are preserved in content JSONB.
create schema if not exists arf_internal;
revoke all on schema arf_internal from public, anon;
grant usage on schema arf_internal to authenticated;

create table if not exists public.arf_school_members (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null,
 display_name text not null default '',
 position text,
 role text not null default 'SCHOOL_OPERATOR' check (role in
 ('SUPER_ADMIN','FOUNDATION_MANAGER','REGIONAL_LEAD','SCHOOL_PRINCIPAL','SCHOOL_OPERATOR','HR_OFFICER','ASSET_OFFICER')),
 assigned_regions text[] not null default '{}',
 assigned_schools text[] not null default '{}',
 status text not null default 'INVITED' check (status in ('ACTIVE','INACTIVE','INVITED')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.arf_school_documents (
 path text primary key,
 collection_path text not null,
 doc_id text not null,
 school_id text,
 content jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint arf_doc_nonempty_path check (length(path)>1 and length(collection_path)>0 and length(doc_id)>0)
);
create index if not exists arf_school_docs_collection_idx on public.arf_school_documents(collection_path);
create index if not exists arf_school_docs_school_idx on public.arf_school_documents(school_id);
create index if not exists arf_school_members_email_idx on public.arf_school_members(lower(email));

-- Membership is the exclusive, server-trusted source for RBAC (never user_metadata).
create or replace function arf_internal.is_school_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.arf_school_members m
    where m.user_id=(select auth.uid()) and m.status='ACTIVE' and m.role='SUPER_ADMIN');
$$;
revoke all on function arf_internal.is_school_admin() from public,anon;
grant execute on function arf_internal.is_school_admin() to authenticated;

create or replace function arf_internal.school_doc_allowed(
 p_collection text,p_school text,p_doc_id text,p_content jsonb,p_write boolean
) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare m public.arf_school_members%rowtype;
        target_school text; related_region text;
begin
 if auth.uid() is null then return false; end if;
 select * into m from public.arf_school_members where user_id=auth.uid() and status='ACTIVE';
 if not found then return false; end if;
 if m.role='SUPER_ADMIN' then return true; end if;
 if p_collection='userInvitations' or p_collection='users' then return false; end if;
 if p_collection='auditLogs' then return p_write or m.role='FOUNDATION_MANAGER'; end if;
 if p_collection='academicYears' or p_collection='regions' then
    return not p_write or m.role='FOUNDATION_MANAGER';
 end if;
 if m.role='FOUNDATION_MANAGER' then return true; end if;
 target_school:=coalesce(p_school,case when p_collection='schools' then p_doc_id end);
 if target_school is null then return false; end if;
 if target_school=any(m.assigned_schools) then return true; end if;
 if m.role='REGIONAL_LEAD' and cardinality(m.assigned_regions)>0 then
   if p_collection='schools' then related_region:=p_content->>'regional_id';
   else
     select content->>'regional_id' into related_region from public.arf_school_documents
     where path='schools/'||target_school;
   end if;
   return related_region=any(m.assigned_regions);
 end if;
 return false;
end;
$$;
revoke all on function arf_internal.school_doc_allowed(text,text,text,jsonb,boolean) from public,anon;
grant execute on function arf_internal.school_doc_allowed(text,text,text,jsonb,boolean) to authenticated;

alter table public.arf_school_members enable row level security;
alter table public.arf_school_documents enable row level security;
drop policy if exists arf_member_read on public.arf_school_members;
create policy arf_member_read on public.arf_school_members for select to authenticated
 using(user_id=(select auth.uid()) or (select arf_internal.is_school_admin()));
drop policy if exists arf_member_admin_update on public.arf_school_members;
create policy arf_member_admin_update on public.arf_school_members for update to authenticated
 using((select arf_internal.is_school_admin())) with check((select arf_internal.is_school_admin()));
drop policy if exists arf_doc_read on public.arf_school_documents;
create policy arf_doc_read on public.arf_school_documents for select to authenticated
 using(arf_internal.school_doc_allowed(collection_path,school_id,doc_id,content,false));
drop policy if exists arf_doc_insert on public.arf_school_documents;
create policy arf_doc_insert on public.arf_school_documents for insert to authenticated
 with check(arf_internal.school_doc_allowed(collection_path,school_id,doc_id,content,true));
drop policy if exists arf_doc_update on public.arf_school_documents;
create policy arf_doc_update on public.arf_school_documents for update to authenticated
 using(arf_internal.school_doc_allowed(collection_path,school_id,doc_id,content,true))
 with check(arf_internal.school_doc_allowed(collection_path,school_id,doc_id,content,true));
drop policy if exists arf_doc_delete on public.arf_school_documents;
create policy arf_doc_delete on public.arf_school_documents for delete to authenticated
 using(arf_internal.school_doc_allowed(collection_path,school_id,doc_id,content,true));

grant select on public.arf_school_members to authenticated;
grant update (role,assigned_regions,assigned_schools,position,status,updated_at) on public.arf_school_members to authenticated;
grant select,insert,update,delete on public.arf_school_documents to authenticated;

-- Publicly invited emails cannot confer themselves a privileged role.
-- Invitations must first be created by an authenticated Super Admin (RLS above).
create or replace function arf_internal.add_arf_school_member()
returns trigger language plpgsql security definer set search_path = '' as $$
declare inv jsonb; assigned_role text := 'SCHOOL_OPERATOR'; new_status text := 'INVITED';
begin
 select d.content into inv from public.arf_school_documents d
 where d.collection_path='userInvitations'
 and lower(d.content->>'email')=lower(new.email)
 and d.content->>'status'='PENDING' order by d.created_at desc limit 1;
 if lower(new.email)='iswahyudhi.r@sumbermassarana.sch.id' then
   assigned_role:='SUPER_ADMIN';new_status:='ACTIVE';
 elsif inv is not null then
   assigned_role:=coalesce(inv->>'role','SCHOOL_OPERATOR');new_status:='ACTIVE';
 end if;
 insert into public.arf_school_members(user_id,email,display_name,position,role,
   assigned_schools,assigned_regions,status)
 values(new.id,new.email,coalesce(new.raw_user_meta_data->>'full_name',split_part(new.email,'@',1)),
   inv->>'position',assigned_role,
   coalesce(array(select jsonb_array_elements_text(inv->'assignedSchools')),'{}'),
   coalesce(array(select jsonb_array_elements_text(inv->'assignedRegions')),'{}'),new_status)
 on conflict(user_id) do nothing;
 return new;
end;
$$;
revoke all on function arf_internal.add_arf_school_member() from public,anon,authenticated;
drop trigger if exists on_arf_school_auth_user_created on auth.users;
create trigger on_arf_school_auth_user_created after insert on auth.users
 for each row execute function arf_internal.add_arf_school_member();

-- For invites sent to existing Supabase accounts (e.g., existing ARF Planner users).
create or replace function arf_internal.activate_arf_school_invitation()
returns trigger language plpgsql security definer set search_path = '' as $$
declare u auth.users%rowtype;
begin
 if new.collection_path <> 'userInvitations' or new.content->>'status' <> 'PENDING' then return new; end if;
 select * into u from auth.users where lower(email)=lower(new.content->>'email') limit 1;
 if not found then return new; end if;
 insert into public.arf_school_members(user_id,email,display_name,position,role,
   assigned_schools,assigned_regions,status)
 values(u.id,u.email,coalesce(new.content->>'displayName',split_part(u.email,'@',1)),
   new.content->>'position',coalesce(new.content->>'role','SCHOOL_OPERATOR'),
   coalesce(array(select jsonb_array_elements_text(new.content->'assignedSchools')),'{}'),
   coalesce(array(select jsonb_array_elements_text(new.content->'assignedRegions')),'{}'),'ACTIVE')
 on conflict(user_id) do update set
   status='ACTIVE', role=excluded.role, assigned_schools=excluded.assigned_schools,
   assigned_regions=excluded.assigned_regions,position=excluded.position,updated_at=now()
 where public.arf_school_members.status='INVITED';
 return new;
end;
$$;
revoke all on function arf_internal.activate_arf_school_invitation() from public,anon,authenticated;
drop trigger if exists on_arf_school_invite_insert on public.arf_school_documents;
create trigger on_arf_school_invite_insert after insert on public.arf_school_documents
 for each row execute function arf_internal.activate_arf_school_invitation();

-- Enroll the already-existing account (if any) for the named initial administrator.
insert into public.arf_school_members(user_id,email,display_name,role,status)
 select u.id,u.email,coalesce(u.raw_user_meta_data->>'full_name',split_part(u.email,'@',1)),
 'SUPER_ADMIN','ACTIVE' from auth.users u
 where lower(u.email)='iswahyudhi.r@sumbermassarana.sch.id'
 on conflict(user_id) do nothing;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('arf-one-school','arf-one-school',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create or replace function arf_internal.school_storage_allowed(p_name text, p_write boolean)
returns boolean language sql stable security definer set search_path = '' as $$
 select split_part(p_name,'/',1)='schools'
 and arf_internal.school_doc_allowed('schools/'||split_part(p_name,'/',2)||'/assets',split_part(p_name,'/',2),'',null,p_write);
$$;
revoke all on function arf_internal.school_storage_allowed(text,boolean) from public,anon;
grant execute on function arf_internal.school_storage_allowed(text,boolean) to authenticated;

drop policy if exists arf_school_photo_read on storage.objects;
create policy arf_school_photo_read on storage.objects for select to authenticated
 using(bucket_id='arf-one-school' and arf_internal.school_storage_allowed(name,false));
drop policy if exists arf_school_photo_insert on storage.objects;
create policy arf_school_photo_insert on storage.objects for insert to authenticated
 with check(bucket_id='arf-one-school' and arf_internal.school_storage_allowed(name,true));
drop policy if exists arf_school_photo_delete on storage.objects;
create policy arf_school_photo_delete on storage.objects for delete to authenticated
 using(bucket_id='arf-one-school' and arf_internal.school_storage_allowed(name,true));

-- Path consistency prevents tenants writing documents under another school by spoofing the collection path.
alter table public.arf_school_documents
 add constraint arf_doc_path_identity check (path = collection_path || '/' || doc_id),
 add constraint arf_doc_school_scope check (
   (collection_path = 'schools' and school_id = doc_id)
   or (collection_path like 'schools/%' and school_id = split_part(path,'/',2))
   or (collection_path <> 'schools' and collection_path not like 'schools/%' and school_id is null)
 );

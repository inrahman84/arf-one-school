-- Enforce separation: no private attributes on student roster documents that may feed dashboards.
-- Existing production roster checked before deployment (0 violating rows).
alter table public.arf_school_documents
 drop constraint if exists arf_student_roster_no_private_fields;
alter table public.arf_school_documents
 add constraint arf_student_roster_no_private_fields
 check (
   collection_path !~ '^schools/[^/]+/students$'
   or not (content ?| array[
    'nik','family_card_number','father','mother','guardian',
    'bank','bank_account','bank_account_name','religion','address',
    'special_needs','latitude','longitude','birth_date',
    'weight_kg','height_cm','head_circumference_cm',
    'kip_number','kps_number','kks_number','pip_reason'
   ])
 );

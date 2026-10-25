-- One-time, idempotent data repair: archived students must not retain an active class relation.
-- Preserve the historical class name/id/grade in separate audit fields.
UPDATE public.arf_school_documents AS d
SET content=d.content || jsonb_build_object(
 'archived_class_id',coalesce(nullif(d.content->>'archived_class_id',''),d.content->>'class_id',''),
 'archived_class_name',coalesce(nullif(d.content->>'archived_class_name',''),d.content->>'class_name',''),
 'archived_grade_level',coalesce(nullif(d.content->>'archived_grade_level',''),d.content->>'grade_level',''),
 'class_id','',
 'class_name','',
 'grade_level','',
 'updated_at',to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"')
)
WHERE d.collection_path ~ '^schools/[^/]+/students$'
 AND coalesce(d.content->>'archived_at','') <> ''
 AND coalesce(d.content->>'class_id','') <> '';

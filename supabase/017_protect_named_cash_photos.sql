-- Migration 017: protect supplementary named Petty Cash photos against deletion.
-- The initial storage cleanup policy guarded the two primary image columns only.
-- With multiple named attachments, every referenced path must be immutable.
DROP POLICY IF EXISTS arf_cash_storage_delete_unlinked ON storage.objects;
CREATE POLICY arf_cash_storage_delete_unlinked ON storage.objects FOR DELETE TO authenticated
 USING(
  bucket_id='arf-one-school'
  AND split_part(name,'/',1)='schools'
  AND split_part(name,'/',3)='petty-cash'
  AND owner_id=auth.uid()::text
  AND arf_internal.cash_treasurer(split_part(name,'/',2))
  AND NOT EXISTS (
    SELECT 1 FROM public.arf_cash_transactions t
    WHERE t.item_photo_path=name OR t.receipt_photo_path=name
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.arf_cash_transaction_attachments a
    WHERE a.file_path=name
  )
);

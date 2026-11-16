-- Migration 016: named multi-photo evidence for BKU transactions.
-- Existing two primary image columns remain for compatibility and audit; all new
-- attachments are written atomically alongside the BKU transaction by RPC.
CREATE TABLE IF NOT EXISTS public.arf_cash_transaction_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.arf_cash_transactions(id) ON DELETE RESTRICT,
  school_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('ITEM','RECEIPT')),
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 150),
  file_path text NOT NULL UNIQUE,
  sort_order int NOT NULL CHECK (sort_order BETWEEN 1 AND 12),
  created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(transaction_id,kind,sort_order),
  CONSTRAINT evidence_path_scope CHECK (
    file_path LIKE ('schools/'||school_id||'/petty-cash/'||transaction_id||'/%')
  )
);
CREATE INDEX IF NOT EXISTS arf_cash_attachments_by_transaction
 ON public.arf_cash_transaction_attachments(transaction_id,kind,sort_order);
ALTER TABLE public.arf_cash_transaction_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY arf_cash_attachments_read ON public.arf_cash_transaction_attachments
 FOR SELECT TO authenticated USING (arf_internal.cash_readable(school_id));
GRANT SELECT ON public.arf_cash_transaction_attachments TO authenticated;
-- No direct INSERT, UPDATE, DELETE grants/policies. The RPC inserts verified
-- evidence within the same transaction that creates the BKU entry.

CREATE OR REPLACE FUNCTION public.arf_cash_create_transaction(
  p_id uuid,
  p_school_id text,
  p_transaction_date date,
  p_description text,
  p_direction text,
  p_amount bigint,
  p_notes text,
  p_items jsonb,
  p_receipts jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  j jsonb; kind text; arr jsonb; number_in_list integer;
  file_path text; display_name text;
  first_item text; first_receipt text;
  storage_owner text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesi login tidak valid'; END IF;
  IF p_id IS NULL OR p_school_id IS NULL OR
     NOT arf_internal.cash_treasurer(p_school_id) THEN
    RAISE EXCEPTION 'Hanya Bendahara Sekolah atau Super Admin berwenang yang boleh mencatat BKU';
  END IF;
  IF p_transaction_date IS NULL OR p_description IS NULL OR
     length(btrim(p_description)) NOT BETWEEN 3 AND 500 OR
     p_direction NOT IN ('IN','OUT') OR
     p_amount IS NULL OR p_amount<=0 THEN
    RAISE EXCEPTION 'Tanggal, uraian, jenis, dan jumlah transaksi BKU wajib valid';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items)<>'array' OR
     jsonb_array_length(p_items) NOT BETWEEN 1 AND 12 OR
     p_receipts IS NULL OR jsonb_typeof(p_receipts)<>'array' OR
     jsonb_array_length(p_receipts) NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'Wajib melampirkan 1–12 foto item dan 1–12 foto kuitansi';
  END IF;
  -- Verify every evidence path belongs to this transaction, is uploaded by the
  -- authenticated actor, and has a meaningful user-provided caption.
  FOR kind,arr IN SELECT 'ITEM',p_items UNION ALL SELECT 'RECEIPT',p_receipts LOOP
    number_in_list:=0;
    FOR j IN SELECT value FROM jsonb_array_elements(arr) LOOP
      number_in_list:=number_in_list+1;
      IF jsonb_typeof(j)<>'object' OR
         jsonb_typeof(j->'path')<>'string' OR jsonb_typeof(j->'name')<>'string' THEN
        RAISE EXCEPTION 'Data lampiran harus memiliki path dan nama';
      END IF;
      file_path:=j->>'path';
      display_name:=btrim(j->>'name');
      IF length(display_name) NOT BETWEEN 1 AND 150 OR display_name ~ '[[:cntrl:]]' THEN
        RAISE EXCEPTION 'Nama foto harus 1–150 karakter tanpa karakter kontrol';
      END IF;
      IF file_path NOT LIKE
        ('schools/'||p_school_id||'/petty-cash/'||p_id||'/'||
          CASE WHEN kind='ITEM' THEN 'item' ELSE 'receipt' END||'/%') THEN
        RAISE EXCEPTION 'Foto tidak sesuai sekolah, transaksi, atau jenis lampiran';
      END IF;
      SELECT o.owner_id INTO storage_owner FROM storage.objects o
       WHERE o.bucket_id='arf-one-school' AND o.name=file_path;
      IF storage_owner IS DISTINCT FROM auth.uid()::text THEN
        RAISE EXCEPTION 'Foto belum terunggah atau bukan milik akun pencatat';
      END IF;
      IF kind='ITEM' AND number_in_list=1 THEN first_item:=file_path; END IF;
      IF kind='RECEIPT' AND number_in_list=1 THEN first_receipt:=file_path; END IF;
    END LOOP;
  END LOOP;

  -- Existing guarded transaction trigger checks cut-off, role, school, actor,
  -- and primary images. Attachment inserts are part of this same database
  -- transaction and roll back together if any check fails.
  INSERT INTO public.arf_cash_transactions
   (id,school_id,transaction_date,description,direction,amount,
    item_photo_path,receipt_photo_path,notes,created_by)
  VALUES
   (p_id,p_school_id,p_transaction_date,btrim(p_description),p_direction,p_amount,
    first_item,first_receipt,coalesce(p_notes,''),auth.uid());

  FOR kind,arr IN SELECT 'ITEM',p_items UNION ALL SELECT 'RECEIPT',p_receipts LOOP
    number_in_list:=0;
    FOR j IN SELECT value FROM jsonb_array_elements(arr) LOOP
      number_in_list:=number_in_list+1;
      INSERT INTO public.arf_cash_transaction_attachments
       (transaction_id,school_id,kind,display_name,file_path,sort_order,created_by)
      VALUES (p_id,p_school_id,kind,btrim(j->>'name'),j->>'path',number_in_list,auth.uid());
    END LOOP;
  END LOOP;
  RETURN p_id;
END;
$$;
REVOKE ALL ON FUNCTION public.arf_cash_create_transaction(
 uuid,text,date,text,text,bigint,text,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.arf_cash_create_transaction(
 uuid,text,date,text,text,bigint,text,jsonb,jsonb) TO authenticated;

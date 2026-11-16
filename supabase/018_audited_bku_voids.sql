-- 018: Audited, non-destructive "Hapus Transaksi" on BKU.
-- Never physically delete cash transaction rows or their original receipt images.
-- Deny voiding a transaction once a weekly count or monthly report uses its date.

CREATE TABLE IF NOT EXISTS public.arf_cash_transaction_voids (
 transaction_id uuid PRIMARY KEY REFERENCES public.arf_cash_transactions(id) ON DELETE RESTRICT,
 school_id text NOT NULL,
 reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 10 AND 500),
 voided_by uuid NOT NULL REFERENCES auth.users(id),
 voided_at timestamptz NOT NULL DEFAULT now(),
 transaction_snapshot jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS arf_cash_voids_school_date_idx
 ON public.arf_cash_transaction_voids(school_id,voided_at DESC);

ALTER TABLE public.arf_cash_transaction_voids ENABLE ROW LEVEL SECURITY;
CREATE POLICY arf_cash_voids_select ON public.arf_cash_transaction_voids
 FOR SELECT TO authenticated USING (arf_internal.cash_readable(school_id));
REVOKE ALL ON public.arf_cash_transaction_voids FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.arf_cash_transaction_voids TO authenticated;

-- Same function signature as migration 015: all existing weekly and monthly
-- reconciliation triggers immediately start excluding voided transactions.
CREATE OR REPLACE FUNCTION arf_internal.cash_ledger(p_school text,p_as_of date)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(sum(CASE WHEN t.direction='IN' THEN t.amount ELSE -t.amount END),0)::bigint
 FROM public.arf_cash_transactions t
 WHERE t.school_id=p_school AND t.transaction_date<=p_as_of
 AND NOT EXISTS (
   SELECT 1 FROM public.arf_cash_transaction_voids v WHERE v.transaction_id=t.id
 );
$$;
REVOKE ALL ON FUNCTION arf_internal.cash_ledger(text,date) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.arf_cash_void_transaction(
 p_transaction_id uuid,
 p_reason text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
 tx public.arf_cash_transactions%ROWTYPE;
 audit_reason text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesi login diperlukan'; END IF;
 audit_reason:=btrim(coalesce(p_reason,''));
 IF length(audit_reason) NOT BETWEEN 10 AND 500 OR audit_reason ~ '[[:cntrl:]]' THEN
  RAISE EXCEPTION 'Alasan menghapus transaksi wajib diisi 10–500 karakter';
 END IF;
 -- Look up school first for the same advisory lock used by weekly and
 -- monthly cash opname. Re-check the row once the school lock is held.
 SELECT * INTO tx FROM public.arf_cash_transactions WHERE id=p_transaction_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Transaksi BKU tidak ditemukan'; END IF;
 IF NOT arf_internal.cash_treasurer(tx.school_id) THEN
  RAISE EXCEPTION 'Hanya Bendahara sekolah terkait atau Super Admin yang boleh menghapus transaksi BKU';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext('arf-cash:'||tx.school_id));
 SELECT * INTO tx FROM public.arf_cash_transactions WHERE id=p_transaction_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Transaksi BKU tidak ditemukan'; END IF;
 IF EXISTS (SELECT 1 FROM public.arf_cash_transaction_voids v
   WHERE v.transaction_id=p_transaction_id) THEN
  RAISE EXCEPTION 'Transaksi BKU ini sudah dihapus';
 END IF;
 IF EXISTS (SELECT 1 FROM public.arf_cash_weekly_counts w
   WHERE w.school_id=tx.school_id AND w.week_ending>=tx.transaction_date) THEN
  RAISE EXCEPTION 'Tidak dapat menghapus: transaksi sudah termasuk cash opname mingguan yang dilaporkan';
 END IF;
 IF EXISTS (SELECT 1 FROM public.arf_cash_reports r
   WHERE r.school_id=tx.school_id AND r.period_end>=tx.transaction_date) THEN
  RAISE EXCEPTION 'Tidak dapat menghapus: sudah ada draft atau laporan LPJ bulanan yang mencakup saldo transaksi';
 END IF;
 INSERT INTO public.arf_cash_transaction_voids(
   transaction_id,school_id,reason,voided_by,transaction_snapshot
 ) VALUES (
   tx.id,tx.school_id,audit_reason,auth.uid(),to_jsonb(tx)
 );
 RETURN tx.id;
END;
$$;

REVOKE ALL ON FUNCTION public.arf_cash_void_transaction(uuid,text)
 FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.arf_cash_void_transaction(uuid,text)
 TO authenticated;

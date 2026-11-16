-- Modul Petty Cash per sekolah. Migration 015. Execute only after review.
-- Funds are stored in integer Rupiah; approval transitions run on the server.
ALTER TABLE public.arf_school_members DROP CONSTRAINT IF EXISTS arf_school_members_role_check;
ALTER TABLE public.arf_school_members ADD CONSTRAINT arf_school_members_role_check
 CHECK (role IN ('SUPER_ADMIN','FOUNDATION_MANAGER','REGIONAL_LEAD','SCHOOL_PRINCIPAL',
 'SCHOOL_OPERATOR','HR_OFFICER','ASSET_OFFICER','SCHOOL_TREASURER','ARF_HEAD_TU'));

create or replace function arf_internal.school_doc_allowed(
 p_collection text,p_school text,p_doc_id text,p_content jsonb,p_write boolean
) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare m public.arf_school_members%rowtype;
        target_school text; related_region text;
begin
 if auth.uid() is null then return false; end if;
 select * into m from public.arf_school_members where user_id=auth.uid() and status='ACTIVE';
 if not found then return false; end if;
 if m.deleted_at is not null then return false; end if;
 -- Treasury has READ-ONLY access to its assigned school identity and regions, not student/admin documents.
 if m.role='SCHOOL_TREASURER' then
   return NOT p_write AND (p_collection='regions' OR (p_collection='schools' AND p_doc_id=ANY(m.assigned_schools)));
 end if;
 -- Foundation Head TU can read school directory for finance reporting, not write school records.
 if m.role='ARF_HEAD_TU' then
   return NOT p_write AND p_collection IN ('regions','schools');
 end if;
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
CREATE OR REPLACE FUNCTION arf_internal.cash_readable(p_school text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(
  SELECT 1 FROM public.arf_school_members m
  WHERE m.user_id=(SELECT auth.uid()) AND m.status='ACTIVE' AND m.deleted_at IS NULL
  AND (m.role IN ('SUPER_ADMIN','FOUNDATION_MANAGER','ARF_HEAD_TU')
       OR (m.role IN ('SCHOOL_TREASURER','SCHOOL_PRINCIPAL')
           AND p_school=ANY(m.assigned_schools)))
 );
$$;
CREATE OR REPLACE FUNCTION arf_internal.cash_treasurer(p_school text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.arf_school_members m
 WHERE m.user_id=(SELECT auth.uid()) AND m.status='ACTIVE' AND m.deleted_at IS NULL
 AND m.role='SCHOOL_TREASURER' AND p_school=ANY(m.assigned_schools));
$$;
CREATE OR REPLACE FUNCTION arf_internal.cash_role(p_school text, p_role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT EXISTS(SELECT 1 FROM public.arf_school_members m
 WHERE m.user_id=(SELECT auth.uid()) AND m.status='ACTIVE' AND m.deleted_at IS NULL
 AND m.role=p_role AND
 (p_role IN ('FOUNDATION_MANAGER','ARF_HEAD_TU')
  OR p_school=ANY(m.assigned_schools)));
$$;
REVOKE ALL ON FUNCTION arf_internal.cash_readable(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION arf_internal.cash_treasurer(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION arf_internal.cash_role(text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION arf_internal.cash_readable(text),
 arf_internal.cash_treasurer(text), arf_internal.cash_role(text,text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.arf_cash_transactions(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id text NOT NULL,
 transaction_date date NOT NULL,
 description text NOT NULL CHECK(length(trim(description)) BETWEEN 3 AND 500),
 direction text NOT NULL CHECK(direction IN ('IN','OUT')),
 amount bigint NOT NULL CHECK(amount>0),
 item_photo_path text NOT NULL,
 receipt_photo_path text NOT NULL,
 notes text NOT NULL DEFAULT '',
 created_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT arf_cash_transaction_image_scope CHECK (
  item_photo_path LIKE ('schools/'||school_id||'/petty-cash/%')
  AND receipt_photo_path LIKE ('schools/'||school_id||'/petty-cash/%'))
);
CREATE INDEX IF NOT EXISTS arf_cash_transactions_period_idx
 ON public.arf_cash_transactions(school_id,transaction_date,created_at);

CREATE TABLE IF NOT EXISTS public.arf_cash_weekly_counts(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id text NOT NULL,
 week_ending date NOT NULL,
 denominations jsonb NOT NULL DEFAULT '{}'::jsonb,
 bank_balance bigint NOT NULL DEFAULT 0 CHECK(bank_balance>=0),
 damaged_cash bigint NOT NULL DEFAULT 0 CHECK(damaged_cash>=0),
 stamps_value bigint NOT NULL DEFAULT 0 CHECK(stamps_value>=0),
 unposted_value bigint NOT NULL DEFAULT 0 CHECK(unposted_value>=0),
 physical_total bigint NOT NULL DEFAULT 0,
 ledger_balance bigint NOT NULL DEFAULT 0,
 variance bigint NOT NULL DEFAULT 0,
 receipts_verified boolean NOT NULL DEFAULT false,
 notes text NOT NULL DEFAULT '',
 submitted_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 submitted_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(school_id,week_ending)
);

CREATE TABLE IF NOT EXISTS public.arf_cash_reports(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 school_id text NOT NULL,
 period_start date NOT NULL,
 period_end date NOT NULL,
 count_date date NOT NULL,
 denominations jsonb NOT NULL DEFAULT '{}'::jsonb,
 bank_balance bigint NOT NULL DEFAULT 0 CHECK(bank_balance>=0),
 damaged_cash bigint NOT NULL DEFAULT 0 CHECK(damaged_cash>=0),
 stamps_value bigint NOT NULL DEFAULT 0 CHECK(stamps_value>=0),
 unposted_value bigint NOT NULL DEFAULT 0 CHECK(unposted_value>=0),
 reimbursement_pending bigint NOT NULL DEFAULT 0 CHECK(reimbursement_pending>=0),
 physical_total bigint NOT NULL DEFAULT 0,
 book_balance_at_count bigint NOT NULL DEFAULT 0,
 variance bigint NOT NULL DEFAULT 0,
 notes text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN
  ('DRAFT','PENDING_PRINCIPAL','PENDING_HEAD_TU','PENDING_MANAGER','APPROVED','RETURNED')),
 submitted_by uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(school_id,period_start,period_end)
);

CREATE TABLE IF NOT EXISTS public.arf_cash_approval_events(
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 report_id uuid NOT NULL REFERENCES public.arf_cash_reports(id),
 school_id text NOT NULL,
 action text NOT NULL CHECK(action IN ('SUBMIT','APPROVE','RETURN','RESUBMIT')),
 from_status text NOT NULL,
 to_status text NOT NULL,
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 actor_role text NOT NULL,
 actor_name text NOT NULL,
 comment text NOT NULL DEFAULT '',
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS arf_cash_approval_events_report_idx
 ON public.arf_cash_approval_events(report_id,occurred_at);

ALTER TABLE public.arf_cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arf_cash_weekly_counts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arf_cash_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arf_cash_approval_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY arf_cash_tx_read ON public.arf_cash_transactions FOR SELECT TO authenticated
 USING(arf_internal.cash_readable(school_id));
CREATE POLICY arf_cash_tx_insert ON public.arf_cash_transactions FOR INSERT TO authenticated
 WITH CHECK(arf_internal.cash_treasurer(school_id) AND created_by=(SELECT auth.uid()));

CREATE POLICY arf_cash_week_read ON public.arf_cash_weekly_counts FOR SELECT TO authenticated
 USING(arf_internal.cash_readable(school_id));
CREATE POLICY arf_cash_week_insert ON public.arf_cash_weekly_counts FOR INSERT TO authenticated
 WITH CHECK(arf_internal.cash_treasurer(school_id) AND submitted_by=(SELECT auth.uid()));

CREATE POLICY arf_cash_report_read ON public.arf_cash_reports FOR SELECT TO authenticated
 USING(arf_internal.cash_readable(school_id));
CREATE POLICY arf_cash_report_insert ON public.arf_cash_reports FOR INSERT TO authenticated
 WITH CHECK(arf_internal.cash_treasurer(school_id) AND submitted_by=(SELECT auth.uid()) AND status='DRAFT');
CREATE POLICY arf_cash_report_draft_update ON public.arf_cash_reports FOR UPDATE TO authenticated
 USING(status IN ('DRAFT','RETURNED') AND arf_internal.cash_treasurer(school_id))
 WITH CHECK(status='DRAFT' AND arf_internal.cash_treasurer(school_id));
CREATE POLICY arf_cash_events_read ON public.arf_cash_approval_events FOR SELECT TO authenticated
 USING(arf_internal.cash_readable(school_id));

GRANT SELECT,INSERT ON public.arf_cash_transactions TO authenticated;
GRANT SELECT,INSERT ON public.arf_cash_weekly_counts TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.arf_cash_reports TO authenticated;
GRANT SELECT ON public.arf_cash_approval_events TO authenticated;

-- Calculate physical denominations without relying on user-provided totals.
CREATE OR REPLACE FUNCTION arf_internal.cash_denominations(p_data jsonb)
RETURNS bigint LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE k text; v text; total bigint:=0;
BEGIN
 IF p_data IS NULL OR jsonb_typeof(p_data)<>'object' THEN
  RAISE EXCEPTION 'Daftar pecahan uang harus berbentuk objek';
 END IF;
 FOR k,v IN SELECT key,value FROM jsonb_each_text(p_data) LOOP
  IF k <> ALL(ARRAY['100000','75000','50000','20000','10000','5000','2000','1000','500','200','100','50']) THEN
   RAISE EXCEPTION 'Pecahan uang tidak dikenal: %',k;
  END IF;
  IF v !~ '^[0-9]{1,8}$' THEN RAISE EXCEPTION 'Jumlah lembar/koin tidak valid'; END IF;
  total:=total+k::bigint*v::bigint;
 END LOOP;
 RETURN total;
END;
$$;
CREATE OR REPLACE FUNCTION arf_internal.cash_ledger(p_school text,p_as_of date)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce(sum(CASE WHEN direction='IN' THEN amount ELSE -amount END),0)::bigint
 FROM public.arf_cash_transactions WHERE school_id=p_school AND transaction_date<=p_as_of;
$$;
REVOKE ALL ON FUNCTION arf_internal.cash_denominations(jsonb),
 arf_internal.cash_ledger(text,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION arf_internal.cash_denominations(jsonb),
 arf_internal.cash_ledger(text,date) TO authenticated;

CREATE OR REPLACE FUNCTION arf_internal.cash_transaction_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE last_friday date;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Transaksi BKU bersifat append-only. Buat transaksi koreksi.'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('arf-cash:'||NEW.school_id));
 IF NOT arf_internal.cash_treasurer(NEW.school_id) THEN RAISE EXCEPTION 'Hanya Bendahara Sekolah yang dapat mencatat BKU'; END IF;
 IF NEW.created_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Identitas pencatat tidak valid'; END IF;
 IF NEW.item_photo_path NOT LIKE ('schools/'||NEW.school_id||'/petty-cash/'||NEW.id||'/item/%')
  OR NEW.receipt_photo_path NOT LIKE ('schools/'||NEW.school_id||'/petty-cash/'||NEW.id||'/receipt/%')
  OR NEW.item_photo_path=NEW.receipt_photo_path THEN
   RAISE EXCEPTION 'Path bukti foto tidak sesuai identitas transaksi';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM storage.objects s WHERE s.bucket_id='arf-one-school'
    AND s.name=NEW.item_photo_path AND s.owner_id=auth.uid()::text)
  OR NOT EXISTS(SELECT 1 FROM storage.objects s WHERE s.bucket_id='arf-one-school'
    AND s.name=NEW.receipt_photo_path AND s.owner_id=auth.uid()::text) THEN
   RAISE EXCEPTION 'Foto item dan kuitansi harus diunggah dan dimiliki akun Bendahara';
 END IF;
 IF length(trim(NEW.item_photo_path))=0 OR length(trim(NEW.receipt_photo_path))=0 THEN
  RAISE EXCEPTION 'Foto item dan kuitansi wajib dilampirkan';
 END IF;
 IF NEW.transaction_date > (now() AT TIME ZONE 'Asia/Jakarta')::date THEN RAISE EXCEPTION 'Tanggal transaksi tidak boleh di masa depan'; END IF;
 SELECT max(week_ending) INTO last_friday FROM public.arf_cash_weekly_counts WHERE school_id=NEW.school_id;
 IF last_friday IS NOT NULL AND NEW.transaction_date<=last_friday THEN
  RAISE EXCEPTION 'Tanggal BKU sudah termasuk cash opname yang dikunci. Catat koreksi pada periode terbuka.';
 END IF;
 IF EXISTS(SELECT 1 FROM public.arf_cash_reports r WHERE r.school_id=NEW.school_id
  AND r.status NOT IN ('DRAFT','RETURNED') AND NEW.transaction_date BETWEEN r.period_start AND r.period_end) THEN
  RAISE EXCEPTION 'Periode LPJ sudah diajukan; tidak dapat menambahkan transaksi mundur';
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER arf_cash_transactions_guard BEFORE INSERT OR UPDATE OR DELETE
 ON public.arf_cash_transactions FOR EACH ROW EXECUTE FUNCTION arf_internal.cash_transaction_guard();

CREATE OR REPLACE FUNCTION arf_internal.cash_weekly_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE physical bigint; ledger bigint;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Cash opname mingguan telah dikunci'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('arf-cash:'||NEW.school_id));
 IF NOT arf_internal.cash_treasurer(NEW.school_id) THEN RAISE EXCEPTION 'Hanya Bendahara Sekolah yang dapat melaporkan opname mingguan'; END IF;
 IF extract(isodow from NEW.week_ending)<>5 THEN RAISE EXCEPTION 'Tanggal cut-off harus hari Jumat'; END IF;
 IF (now() AT TIME ZONE 'Asia/Jakarta') < (NEW.week_ending::timestamp + interval '17 hours') THEN
  RAISE EXCEPTION 'Cut-off Jumat belum pukul 17:00 WIB';
 END IF;
 IF NOT NEW.receipts_verified THEN RAISE EXCEPTION 'Verifikasi semua kuitansi wajib dinyatakan selesai'; END IF;
 IF NEW.submitted_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Identitas Bendahara tidak sesuai'; END IF;
 physical:=arf_internal.cash_denominations(NEW.denominations)+NEW.bank_balance+
  NEW.damaged_cash+NEW.stamps_value+NEW.unposted_value;
 ledger:=arf_internal.cash_ledger(NEW.school_id,NEW.week_ending);
 NEW.physical_total:=physical;NEW.ledger_balance:=ledger;NEW.variance:=physical-ledger;
 NEW.submitted_at:=now();
 RETURN NEW;
END;
$$;
CREATE TRIGGER arf_cash_weekly_guard BEFORE INSERT OR UPDATE OR DELETE
 ON public.arf_cash_weekly_counts FOR EACH ROW EXECUTE FUNCTION arf_internal.cash_weekly_guard();

CREATE OR REPLACE FUNCTION arf_internal.cash_report_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE physical bigint; ledger bigint; expected_start date;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'LPJ tidak boleh dihapus; gunakan audit status'; END IF;
 IF TG_OP='UPDATE' AND current_setting('arf.cash_approval_transition',true)='yes' THEN
  RETURN NEW;
 END IF;
 IF TG_OP='UPDATE' THEN
  IF OLD.school_id<>NEW.school_id OR OLD.period_start<>NEW.period_start OR OLD.period_end<>NEW.period_end
   OR OLD.submitted_by<>NEW.submitted_by THEN
    RAISE EXCEPTION 'Identitas dan periode LPJ tidak dapat diubah'; END IF;
  IF OLD.status NOT IN ('DRAFT','RETURNED') OR NEW.status<>'DRAFT' THEN
    RAISE EXCEPTION 'LPJ hanya dapat diedit ketika draft atau dikembalikan'; END IF;
 END IF;
 IF NOT arf_internal.cash_treasurer(NEW.school_id) THEN RAISE EXCEPTION 'Hanya Bendahara Sekolah yang dapat menyusun LPJ'; END IF;
 IF NEW.period_end<>date_trunc('month',NEW.period_end)::date+19 THEN
  RAISE EXCEPTION 'Periode LPJ harus berakhir pada tanggal 20'; END IF;
 expected_start:=(date_trunc('month',NEW.period_end)-interval '1 month'+interval '20 days')::date;
 IF NEW.period_start<>expected_start THEN RAISE EXCEPTION 'Periode LPJ harus dimulai tanggal 21 bulan sebelumnya'; END IF;
 IF NEW.count_date<NEW.period_end-interval '2 days' OR NEW.count_date>NEW.period_end THEN
  RAISE EXCEPTION 'Cash opname bulanan harus tanggal 18 s.d. 20'; END IF;
 IF NEW.count_date > (now() AT TIME ZONE 'Asia/Jakarta')::date THEN RAISE EXCEPTION 'Tanggal opname belum terjadi'; END IF;
 PERFORM pg_advisory_xact_lock(hashtext('arf-cash:'||NEW.school_id));
 physical:=arf_internal.cash_denominations(NEW.denominations)+NEW.bank_balance+
  NEW.damaged_cash+NEW.stamps_value+NEW.unposted_value;
 ledger:=arf_internal.cash_ledger(NEW.school_id,NEW.count_date);
 NEW.physical_total:=physical; NEW.book_balance_at_count:=ledger; NEW.variance:=physical-ledger;
 NEW.updated_at:=now();
 RETURN NEW;
END;
$$;
CREATE TRIGGER arf_cash_report_guard BEFORE INSERT OR UPDATE OR DELETE
 ON public.arf_cash_reports FOR EACH ROW EXECUTE FUNCTION arf_internal.cash_report_guard();

-- Centralized approval: the browser cannot forge an actor or skip the hierarchy.
CREATE OR REPLACE FUNCTION public.arf_cash_transition(
 p_report_id uuid,p_decision text,p_comment text DEFAULT ''
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r public.arf_cash_reports%rowtype; needed_role text;
        next_status text; action_name text; actor_role text;
        missing_fridays int;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Login diperlukan'; END IF;
 SELECT * INTO r FROM public.arf_cash_reports WHERE id=p_report_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'LPJ tidak ditemukan'; END IF;
 IF p_decision='SUBMIT' AND r.status IN ('DRAFT','RETURNED') THEN
  needed_role:='SCHOOL_TREASURER';next_status:='PENDING_PRINCIPAL';
  action_name:=CASE WHEN r.status='RETURNED' THEN 'RESUBMIT' ELSE 'SUBMIT' END;
  IF r.variance<>0 THEN RAISE EXCEPTION 'Selisih kas harus diselesaikan sebelum pengajuan LPJ'; END IF;
  IF (now() AT TIME ZONE 'Asia/Jakarta')::date<r.period_end THEN
   RAISE EXCEPTION 'LPJ periode 21-20 hanya dapat diajukan setelah periode berakhir'; END IF;
  SELECT count(*) INTO missing_fridays
  FROM generate_series(r.period_start,r.period_end,interval '1 day') d
  WHERE extract(isodow from d)=5 AND NOT EXISTS
   (SELECT 1 FROM public.arf_cash_weekly_counts w
    WHERE w.school_id=r.school_id AND w.week_ending=d::date);
  IF missing_fridays>0 THEN
   RAISE EXCEPTION 'Terdapat % laporan cash opname Jumat yang belum dikirim',missing_fridays; END IF;
 ELSIF p_decision='APPROVE' THEN
  IF r.status='PENDING_PRINCIPAL' THEN needed_role:='SCHOOL_PRINCIPAL'; next_status:='PENDING_HEAD_TU';
  ELSIF r.status='PENDING_HEAD_TU' THEN needed_role:='ARF_HEAD_TU';next_status:='PENDING_MANAGER';
  ELSIF r.status='PENDING_MANAGER' THEN needed_role:='FOUNDATION_MANAGER';next_status:='APPROVED';
  ELSE RAISE EXCEPTION 'Tahap approval tidak valid'; END IF;
  action_name:='APPROVE';
 ELSIF p_decision='RETURN' AND r.status IN ('PENDING_PRINCIPAL','PENDING_HEAD_TU','PENDING_MANAGER') THEN
  needed_role:=CASE r.status WHEN 'PENDING_PRINCIPAL' THEN 'SCHOOL_PRINCIPAL'
   WHEN 'PENDING_HEAD_TU' THEN 'ARF_HEAD_TU' ELSE 'FOUNDATION_MANAGER' END;
  IF length(trim(coalesce(p_comment,'')))<5 THEN RAISE EXCEPTION 'Alasan pengembalian wajib diisi'; END IF;
  next_status:='RETURNED';action_name:='RETURN';
 ELSE RAISE EXCEPTION 'Perubahan status LPJ tidak diizinkan'; END IF;
 IF NOT arf_internal.cash_role(r.school_id,needed_role) THEN
  RAISE EXCEPTION 'Akun tidak berwenang pada tahap %',needed_role; END IF;
 actor_role:=needed_role;
 PERFORM set_config('arf.cash_approval_transition','yes',true);
 UPDATE public.arf_cash_reports SET status=next_status,updated_at=now() WHERE id=r.id;
 INSERT INTO public.arf_cash_approval_events(
  report_id,school_id,action,from_status,to_status,actor_id,actor_role,actor_name,comment)
 VALUES(r.id,r.school_id,action_name,r.status,next_status,auth.uid(),actor_role,
 (SELECT m.display_name FROM public.arf_school_members m WHERE m.user_id=auth.uid()),coalesce(p_comment,''));
 RETURN next_status;
END;
$$;
REVOKE ALL ON FUNCTION public.arf_cash_transition(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.arf_cash_transition(uuid,text,text) TO authenticated;

-- Isolate financial evidence from the existing general school-photo policies.
-- Regular operators may access assets/facility photos, not petty cash receipts.
DROP POLICY IF EXISTS arf_school_photo_read ON storage.objects;
CREATE POLICY arf_school_photo_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='arf-one-school' AND split_part(name,'/',3)<>'petty-cash'
  AND arf_internal.school_storage_allowed(name,false));
DROP POLICY IF EXISTS arf_school_photo_insert ON storage.objects;
CREATE POLICY arf_school_photo_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='arf-one-school' AND split_part(name,'/',3)<>'petty-cash'
  AND arf_internal.school_storage_allowed(name,true));
DROP POLICY IF EXISTS arf_school_photo_delete ON storage.objects;
CREATE POLICY arf_school_photo_delete ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='arf-one-school' AND split_part(name,'/',3)<>'petty-cash'
  AND arf_internal.school_storage_allowed(name,true));
CREATE POLICY arf_cash_storage_read ON storage.objects FOR SELECT TO authenticated
 USING(bucket_id='arf-one-school' AND split_part(name,'/',1)='schools'
  AND split_part(name,'/',3)='petty-cash'
  AND arf_internal.cash_readable(split_part(name,'/',2)));
CREATE POLICY arf_cash_storage_insert ON storage.objects FOR INSERT TO authenticated
 WITH CHECK(bucket_id='arf-one-school' AND split_part(name,'/',1)='schools'
  AND split_part(name,'/',3)='petty-cash'
  AND arf_internal.cash_treasurer(split_part(name,'/',2)));
-- Permit deleting only one's unlinked, unsubmitted orphan uploads for upload-failure cleanup.
CREATE POLICY arf_cash_storage_delete_unlinked ON storage.objects FOR DELETE TO authenticated
 USING(bucket_id='arf-one-school' AND split_part(name,'/',1)='schools'
  AND split_part(name,'/',3)='petty-cash'
  AND owner_id=auth.uid()::text
  AND arf_internal.cash_treasurer(split_part(name,'/',2))
  AND NOT EXISTS(SELECT 1 FROM public.arf_cash_transactions t
    WHERE t.item_photo_path=name OR t.receipt_photo_path=name));

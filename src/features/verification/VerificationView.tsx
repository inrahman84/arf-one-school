import React, { useState } from 'react';
import {
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  MessageSquare,
  ShieldAlert,
  Send,
  Eye,
  Building
} from 'lucide-react';
import { SubmissionReview, School, SubmissionStatus } from '../../types';
import { verificationService } from '../../services/verificationService';
import { useAuth } from '../../context/AuthContext';

interface VerificationViewProps {
  schools: School[];
  reviews: SubmissionReview[];
  onRefresh: () => void;
  onSelectSchool: (schoolId: string) => void;
}

export const VerificationView: React.FC<VerificationViewProps> = ({
  schools,
  reviews,
  onRefresh,
  onSelectSchool
}) => {
  const { isFoundationManager, isRegionalLead, isPrincipal, effectiveRole, userProfile } = useAuth();
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('ALL');
  const [revisionModalOpen, setRevisionModalOpen] = useState(false);
  const [activeReview, setActiveReview] = useState<SubmissionReview | null>(null);
  const [revisionComments, setRevisionComments] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const canVerifyData = isFoundationManager || isRegionalLead;
  const canPrincipalApprove = isPrincipal || isFoundationManager;

  const filteredReviews = reviews.filter(r => {
    if (selectedStatus !== 'ALL' && r.status !== selectedStatus) return false;
    if (selectedSchoolId !== 'ALL' && r.schoolId !== selectedSchoolId) return false;
    return true;
  });

  const handleApprovePrincipal = async (review: SubmissionReview) => {
    if (confirm(`Setujui pengajuan data sekolah oleh Kepala Sekolah?`)) {
      setActionLoading(true);
      try {
        await verificationService.approveByPrincipal(review.id, review.schoolId);
        onRefresh();
      } finally {
        setActionLoading(false);
      }
    }
  };

  const handleVerify = async (review: SubmissionReview) => {
    if (confirm(`Verifikasi resmi data modul ${review.module}? Data akan masuk ke konsolidasi KPI eksekutif.`)) {
      setActionLoading(true);
      try {
        await verificationService.verifySubmission(review.id, review.schoolId);
        onRefresh();
      } finally {
        setActionLoading(false);
      }
    }
  };

  const openRevisionModal = (review: SubmissionReview) => {
    setActiveReview(review);
    setRevisionComments(review.revisionComments || '');
    setRevisionModalOpen(true);
  };

  const handleConfirmRevision = async () => {
    if (!activeReview) return;
    if (!revisionComments.trim()) {
      alert('Harap masukkan catatan revisi untuk perbaikan!');
      return;
    }

    setActionLoading(true);
    try {
      await verificationService.rejectSubmission(activeReview.id, activeReview.schoolId, revisionComments);
      setRevisionModalOpen(false);
      onRefresh();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Explanation */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200/90 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#073b2d] font-bold text-xs mb-2">
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Sistem Verifikasi Bertingkat Yayasan ARF</span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">
              Alur Verifikasi Data Sekolah (Wave 1)
            </h2>
            <p className="text-xs text-[#5f5d5d] mt-1">
              Data rombel, PTK, aset, dan sarana harus melalui persetujuan Kepala Sekolah dan Verifikator Resmi Yayasan ARF sebelum diakui dalam laporan eksekutif.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Peran Anda:</span>
            <span className="px-2.5 py-1 rounded-lg bg-[#073b2d] text-white font-bold text-xs">
              {effectiveRole}
            </span>
          </div>
        </div>

        {/* Workflow Diagram */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-gray-100 text-xs">
          <div className="p-3 rounded-xl border border-gray-200 bg-gray-50">
            <div className="font-bold text-gray-700 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-gray-400 text-white text-[10px] flex items-center justify-center font-bold">1</span>
              <span>DRAFT</span>
            </div>
            <p className="text-[11px] text-[#5f5d5d] mt-1">Staf menginputkan / mengimpor data sekolah.</p>
          </div>

          <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/50">
            <div className="font-bold text-amber-800 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] flex items-center justify-center font-bold">2</span>
              <span>SUBMITTED</span>
            </div>
            <p className="text-[11px] text-[#5f5d5d] mt-1">Diajukan untuk ditinjau oleh Kepala Sekolah.</p>
          </div>

          <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/50">
            <div className="font-bold text-rose-800 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-bold">3</span>
              <span>REVISION</span>
            </div>
            <p className="text-[11px] text-[#5f5d5d] mt-1">Dikembalikan jika data belum lengkap / keliru.</p>
          </div>

          <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50">
            <div className="font-bold text-emerald-800 flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-emerald-600 text-white text-[10px] flex items-center justify-center font-bold">4</span>
              <span>VERIFIED</span>
            </div>
            <p className="text-[11px] text-[#5f5d5d] mt-1">Disetujui ARF &amp; terkunci untuk laporan resmi.</p>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div>
            <label className="block text-[11px] font-semibold text-[#5f5d5d] mb-1">Status Pengajuan</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="text-xs py-2 px-3 rounded-lg border border-gray-300 bg-white text-gray-800"
            >
              <option value="ALL">Semua Status</option>
              <option value="SUBMITTED">Menunggu Persetujuan (SUBMITTED)</option>
              <option value="VERIFIED">Telah Diverifikasi (VERIFIED)</option>
              <option value="REVISION_REQUIRED">Memerlukan Revisi (REVISION)</option>
              <option value="DRAFT">Draf (DRAFT)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#5f5d5d] mb-1">Sekolah</label>
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="text-xs py-2 px-3 rounded-lg border border-gray-300 bg-white text-gray-800"
            >
              <option value="ALL">Semua Sekolah ({schools.length})</option>
              {schools.map(s => (
                <option key={s.school_id} value={s.school_id}>{s.school_name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Reviews Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-gray-900">
            Daftar Pengajuan Verifikasi ({filteredReviews.length})
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Sekolah &amp; Modul</th>
                <th className="py-3 px-4">Tahun &amp; Semester</th>
                <th className="py-3 px-4">Pengaju (Diajukan Pada)</th>
                <th className="py-3 px-4">Persetujuan KS</th>
                <th className="py-3 px-4">Verifikasi ARF</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi Verifikasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredReviews.map(r => {
                const sch = schools.find(s => s.school_id === r.schoolId);

                return (
                  <tr key={r.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900">{sch?.school_name || r.schoolId}</div>
                      <div className="text-[11px] text-[#073b2d] font-semibold">Modul: {r.module}</div>
                    </td>
                    <td className="py-3 px-4 text-gray-700">
                      {r.academicYear} ({r.semester})
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-gray-800">{r.submittedBy || 'Operator'}</div>
                      <div className="text-[11px] text-gray-400">
                        {r.submittedAt ? new Date(r.submittedAt).toLocaleDateString('id-ID') : '-'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {r.principalApprovedBy ? (
                        <div className="text-emerald-700 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{r.principalApprovedBy}</span>
                        </div>
                      ) : (
                        <span className="text-amber-700 font-semibold">Menunggu KS</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {r.verifiedBy ? (
                        <div className="text-[#073b2d] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>{r.verifiedBy}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">Belum Diverifikasi</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        r.status === 'VERIFIED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : r.status === 'SUBMITTED'
                          ? 'bg-amber-100 text-amber-800'
                          : r.status === 'REVISION_REQUIRED'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* Principal Approve Action */}
                        {!r.principalApprovedBy && canPrincipalApprove && (
                          <button
                            onClick={() => handleApprovePrincipal(r)}
                            disabled={actionLoading}
                            className="px-2 py-1 rounded bg-amber-600 text-white text-[11px] font-semibold hover:bg-amber-700"
                            title="Setujui sebagai Kepala Sekolah"
                          >
                            Setujui KS
                          </button>
                        )}

                        {/* ARF Verify Action */}
                        {canVerifyData && r.status !== 'VERIFIED' && (
                          <button
                            onClick={() => handleVerify(r)}
                            disabled={actionLoading}
                            className="px-2.5 py-1 rounded bg-[#073b2d] text-white text-[11px] font-semibold hover:bg-[#0a4f3d]"
                            title="Verifikasi Resmi ARF"
                          >
                            Verifikasi
                          </button>
                        )}

                        {/* Revision Action */}
                        {canVerifyData && r.status !== 'REVISION_REQUIRED' && (
                          <button
                            onClick={() => openRevisionModal(r)}
                            disabled={actionLoading}
                            className="px-2 py-1 rounded border border-rose-300 text-rose-700 text-[11px] font-semibold hover:bg-rose-50"
                            title="Minta Revisi"
                          >
                            Revisi
                          </button>
                        )}

                        <button
                          onClick={() => onSelectSchool(r.schoolId)}
                          className="p-1 rounded text-gray-500 hover:text-gray-900"
                          title="Lihat Detail Sekolah"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredReviews.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-400">
                    Tidak ada pengajuan verifikasi yang cocok dengan filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revision Modal */}
      {revisionModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-gray-900 pb-3 border-b border-gray-200">
              Kembalikan Pengajuan untuk Revisi
            </h3>

            <div className="mt-4 space-y-3">
              <p className="text-xs text-gray-600">
                Tuliskan instruksi atau catatan perbaikan yang jelas untuk operator sekolah:
              </p>

              <textarea
                rows={4}
                value={revisionComments}
                onChange={(e) => setRevisionComments(e.target.value)}
                placeholder="Contoh: Jumlah rombel kelas 1 melebihi kapasitas dan belum mencantumkan nama wali kelas. Harap diperbaiki."
                className="w-full text-xs p-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-[#073b2d]"
              />

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setRevisionModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRevision}
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-lg bg-rose-600 text-white font-semibold text-xs shadow-sm hover:bg-rose-700"
                >
                  {actionLoading ? 'Mengirim...' : 'Kirim Catatan Revisi'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

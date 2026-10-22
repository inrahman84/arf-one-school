import {
  collection,
  doc,
  getDocs,
  setDoc,
  query,
  where
} from '../lib/documentStore';
import { db, handleSupabaseError, OperationType, auth } from '../lib/backend';
import { SubmissionReview, SubmissionStatus, SubmissionModule, Semester } from '../types';
import { auditService } from './auditService';

export const verificationService = {
  async getReviewsBySchool(schoolId: string): Promise<SubmissionReview[]> {
    const path = 'submissionReviews';
    try {
      const q = query(collection(db, path), where('schoolId', '==', schoolId));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as SubmissionReview[];
    } catch (error) {
      handleSupabaseError(error, OperationType.LIST, path);
    }
  },

  async getAllReviews(): Promise<SubmissionReview[]> {
    const path = 'submissionReviews';
    try {
      const snap = await getDocs(collection(db, path));
      return snap.docs.map(d => ({ id: d.id, ...d.data() })) as SubmissionReview[];
    } catch (error) {
      handleSupabaseError(error, OperationType.LIST, path);
    }
  },

  async submitForReview(
    schoolId: string,
    module: SubmissionModule,
    academicYear: string,
    semester: Semester
  ): Promise<void> {
    const user = auth.currentUser;
    const docId = `${schoolId}_${module}_${academicYear.replace(/[\/\s]/g, '-')}_${semester}`;
    const path = `submissionReviews/${docId}`;
    try {
      const now = new Date().toISOString();
      const payload: SubmissionReview = {
        id: docId,
        schoolId,
        module,
        academicYear,
        semester,
        status: 'SUBMITTED',
        submittedBy: user?.displayName || user?.email || 'Operator Sekolah',
        submittedAt: now,
        updatedAt: now
      };
      await setDoc(doc(db, 'submissionReviews', docId), payload, { merge: true });
      await auditService.log('SUBMIT_DATA', 'SubmissionReview', docId, schoolId, `Pengajuan data modul ${module} untuk diverifikasi`);
    } catch (error) {
      handleSupabaseError(error, OperationType.WRITE, path);
    }
  },

  async approveByPrincipal(reviewId: string, schoolId: string): Promise<void> {
    const user = auth.currentUser;
    const path = `submissionReviews/${reviewId}`;
    try {
      const now = new Date().toISOString();
      await setDoc(doc(db, 'submissionReviews', reviewId), {
        principalApprovedBy: user?.displayName || user?.email || 'Kepala Sekolah',
        principalApprovedAt: now,
        updatedAt: now
      }, { merge: true });
      await auditService.log('PRINCIPAL_APPROVE', 'SubmissionReview', reviewId, schoolId, `Kepala sekolah menyetujui pengajuan data`);
    } catch (error) {
      handleSupabaseError(error, OperationType.UPDATE, path);
    }
  },

  async verifySubmission(reviewId: string, schoolId: string): Promise<void> {
    const user = auth.currentUser;
    const path = `submissionReviews/${reviewId}`;
    try {
      const now = new Date().toISOString();
      await setDoc(doc(db, 'submissionReviews', reviewId), {
        status: 'VERIFIED' as SubmissionStatus,
        verifiedBy: user?.displayName || user?.email || 'ARF Verifier',
        verifiedAt: now,
        revisionComments: '',
        updatedAt: now
      }, { merge: true });
      await auditService.log('VERIFY_DATA', 'SubmissionReview', reviewId, schoolId, `Data resmi DIVERIFIKASI oleh Yayasan ARF`);
    } catch (error) {
      handleSupabaseError(error, OperationType.UPDATE, path);
    }
  },

  async rejectSubmission(reviewId: string, schoolId: string, comments: string): Promise<void> {
    const user = auth.currentUser;
    const path = `submissionReviews/${reviewId}`;
    try {
      const now = new Date().toISOString();
      await setDoc(doc(db, 'submissionReviews', reviewId), {
        status: 'REVISION_REQUIRED' as SubmissionStatus,
        verifiedBy: user?.displayName || user?.email || 'ARF Reviewer',
        revisionComments: comments,
        updatedAt: now
      }, { merge: true });
      await auditService.log('REJECT_REVISION', 'SubmissionReview', reviewId, schoolId, `Pengajuan dikembalikan untuk revisi: ${comments}`);
    } catch (error) {
      handleSupabaseError(error, OperationType.UPDATE, path);
    }
  }
};

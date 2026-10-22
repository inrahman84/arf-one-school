import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc
} from '../lib/documentStore';
import { db, handleSupabaseError, OperationType } from '../lib/backend';
import { Staff } from '../types';
import { auditService } from './auditService';

export const hrService = {
  async getStaffBySchool(schoolId: string): Promise<Staff[]> {
    const path = `schools/${schoolId}/staff`;
    try {
      const snap = await getDocs(collection(db, 'schools', schoolId, 'staff'));
      return snap.docs.map(d => ({ staff_id: d.id, ...d.data() })) as Staff[];
    } catch (error) {
      handleSupabaseError(error, OperationType.LIST, path);
    }
  },

  async getAllStaffAcrossSchools(schoolIds: string[]): Promise<Staff[]> {
    const results: Staff[] = [];
    for (const sid of schoolIds) {
      try {
        const staff = await this.getStaffBySchool(sid);
        results.push(...staff);
      } catch (e) {
        console.warn(`Could not load staff for school ${sid}:`, e);
      }
    }
    return results;
  },

  async saveStaff(st: Omit<Staff, 'created_at' | 'updated_at'> & { created_at?: string }): Promise<void> {
    const path = `schools/${st.school_id}/staff/${st.staff_id}`;
    try {
      const now = new Date().toISOString();
      const payload: Staff = {
        ...st,
        weekly_teaching_hours: Number(st.weekly_teaching_hours) || 0,
        created_at: st.created_at || now,
        updated_at: now
      };
      await setDoc(doc(db, 'schools', st.school_id, 'staff', st.staff_id), payload, { merge: true });
      await auditService.log('SAVE_STAFF', 'Staff', st.staff_id, st.school_id, `PTK: ${st.staff_name} (${st.primary_position})`);
    } catch (error) {
      handleSupabaseError(error, OperationType.WRITE, path);
    }
  },

  async deleteStaff(schoolId: string, staffId: string): Promise<void> {
    const path = `schools/${schoolId}/staff/${staffId}`;
    try {
      await deleteDoc(doc(db, 'schools', schoolId, 'staff', staffId));
      await auditService.log('DELETE_STAFF', 'Staff', staffId, schoolId, `Menghapus PTK: ${staffId}`);
    } catch (error) {
      handleSupabaseError(error, OperationType.DELETE, path);
    }
  },

  calculateHRMetrics(staffList: Staff[], totalStudents: number = 0) {
    const activeStaff = staffList.filter(s => s.employment_status === 'Aktif');
    const teachers = activeStaff.filter(s => s.staff_category === 'Guru' || s.staff_category === 'Kepala Sekolah');
    const educationalPersonnel = activeStaff.filter(s => s.staff_category === 'Tenaga Kependidikan');

    const totalActiveTeachers = teachers.length;
    const certifiedTeachers = teachers.filter(t => t.teacher_certification === 'Bersertifikat').length;
    const certificationRate = totalActiveTeachers > 0 ? (certifiedTeachers / totalActiveTeachers) * 100 : 0;

    const studentTeacherRatio = totalActiveTeachers > 0 ? (totalStudents / totalActiveTeachers).toFixed(1) : 'N/A';

    // Qualification distribution
    const educationDistribution: Record<string, number> = {};
    staffList.forEach(s => {
      const edu = s.highest_education || 'Lainnya';
      educationDistribution[edu] = (educationDistribution[edu] || 0) + 1;
    });

    // Employment type distribution
    const employmentDistribution: Record<string, number> = {};
    staffList.forEach(s => {
      const type = s.employment_type || 'Lainnya';
      employmentDistribution[type] = (employmentDistribution[type] || 0) + 1;
    });

    return {
      totalStaff: staffList.length,
      activeStaffCount: activeStaff.length,
      totalActiveTeachers,
      totalEducationalPersonnel: educationalPersonnel.length,
      certifiedTeachers,
      certificationRate,
      studentTeacherRatio,
      educationDistribution,
      employmentDistribution
    };
  }
};

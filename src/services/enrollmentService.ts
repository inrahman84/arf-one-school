import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc
} from '../lib/documentStore';
import { db, handleSupabaseError, OperationType } from '../lib/backend';
import { ClassroomEnrollment } from '../types';
import { auditService } from './auditService';

export const enrollmentService = {
  async getClassesBySchool(schoolId: string): Promise<ClassroomEnrollment[]> {
    const path = `schools/${schoolId}/classes`;
    try {
      const snap = await getDocs(collection(db, 'schools', schoolId, 'classes'));
      return snap.docs.map(d => ({ class_id: d.id, ...d.data() })) as ClassroomEnrollment[];
    } catch (error) {
      handleSupabaseError(error, OperationType.LIST, path);
    }
  },

  async getAllClassesAcrossSchools(schoolIds: string[]): Promise<ClassroomEnrollment[]> {
    const results: ClassroomEnrollment[] = [];
    for (const sid of schoolIds) {
      try {
        const classes = await this.getClassesBySchool(sid);
        results.push(...classes);
      } catch (e) {
        console.warn(`Could not load classes for school ${sid}:`, e);
      }
    }
    return results;
  },

  async saveClass(cls: Omit<ClassroomEnrollment, 'created_at' | 'updated_at'> & { created_at?: string }): Promise<void> {
    const path = `schools/${cls.school_id}/classes/${cls.class_id}`;
    try {
      const now = new Date().toISOString();
      const payload: ClassroomEnrollment = {
        ...cls,
        male_students: Number(cls.male_students) || 0,
        female_students: Number(cls.female_students) || 0,
        class_capacity: Number(cls.class_capacity) || 0,
        transfer_in: Number(cls.transfer_in) || 0,
        transfer_out: Number(cls.transfer_out) || 0,
        dropout_students: Number(cls.dropout_students) || 0,
        created_at: cls.created_at || now,
        updated_at: now
      };
      await setDoc(doc(db, 'schools', cls.school_id, 'classes', cls.class_id), payload, { merge: true });
      await auditService.log('SAVE_CLASS', 'ClassroomEnrollment', cls.class_id, cls.school_id, `Rombel: ${cls.class_name} (${cls.academic_year} ${cls.semester})`);
    } catch (error) {
      handleSupabaseError(error, OperationType.WRITE, path);
    }
  },

  async deleteClass(schoolId: string, classId: string): Promise<void> {
    const path = `schools/${schoolId}/classes/${classId}`;
    try {
      const assigned=await getDocs(collection(db,'schools',schoolId,'students'));
      const linked=assigned.docs.filter(d=>d.data().class_id===classId);
      if(linked.length>0){
        throw new Error('Rombel masih memiliki '+linked.length+' peserta didik terhubung. Pindahkan murid ke rombel lain sebelum menghapus.');
      }
      await deleteDoc(doc(db, 'schools', schoolId, 'classes', classId));
      await auditService.log('DELETE_CLASS', 'ClassroomEnrollment', classId, schoolId, `Menghapus rombel ${classId}`);
    } catch (error) {
      if(error instanceof Error&&error.message.includes('peserta didik terhubung'))throw error;
      handleSupabaseError(error, OperationType.DELETE, path);
    }
  },

  calculateClassMetrics(cls: ClassroomEnrollment) {
    const male = Number(cls.male_students) || 0;
    const female = Number(cls.female_students) || 0;
    const total = male + female;
    const capacity = Number(cls.class_capacity) || 0;
    const isOvercapacity = capacity > 0 && total > capacity;
    const occupancyRate = capacity > 0 ? ((total / capacity) * 100) : null;

    return {
      totalStudents: total,
      capacity,
      isOvercapacity,
      occupancyRate
    };
  }
};

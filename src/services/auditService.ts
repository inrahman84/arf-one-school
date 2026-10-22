import { collection, addDoc, getDocs, query, orderBy, limit } from '../lib/documentStore';
import { db, handleSupabaseError, OperationType, auth } from '../lib/backend';
import { AuditLog } from '../types';

export const auditService = {
  async log(action: string, entity: string, entityId: string, schoolId?: string, details?: string): Promise<void> {
    const user = auth.currentUser;
    const path = 'auditLogs';
    try {
      await addDoc(collection(db, path), {
        actorUid: user?.uid || 'system',
        actorEmail: user?.email || 'system@arf.org',
        action,
        entity,
        entityId,
        schoolId: schoolId || '',
        details: details || '',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      // Non-blocking log failure
      console.warn('Audit log write error:', error);
    }
  },

  async getRecentLogs(maxCount: number = 50): Promise<AuditLog[]> {
    const path = 'auditLogs';
    try {
      const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(maxCount));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as AuditLog[];
    } catch (error) {
      // Fallback in case orderBy requires index or permission
      try {
        const snap = await getDocs(collection(db, path));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as AuditLog[];
        return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, maxCount);
      } catch (err) {
        handleSupabaseError(err, OperationType.LIST, path);
      }
    }
  }
};

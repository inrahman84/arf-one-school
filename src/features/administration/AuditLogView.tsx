import React, { useState, useEffect } from 'react';
import { History, Shield, Search, RefreshCw, Clock } from 'lucide-react';
import { AuditLog } from '../../types';
import { auditService } from '../../services/auditService';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await auditService.getRecentLogs(100);
      setLogs(data);
    } catch (e) {
      console.error('Error fetching logs:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(l => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (l.action || '').toLowerCase().includes(q) ||
      (l.actorEmail || '').toLowerCase().includes(q) ||
      (l.entity || '').toLowerCase().includes(q) ||
      (l.details || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-[#073b2d] font-bold text-xs mb-2">
            <History className="w-3.5 h-3.5" />
            <span>Audit Trail &amp; Keamanan Data</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">
            Log Aktivitas &amp; Perubahan Data Sistem
          </h2>
          <p className="text-xs text-[#5f5d5d] mt-1">
            Rekam jejak mutasi data sekolah, otorisasi pengguna, dan riwayat verifikasi secara permanen (append-only).
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan Log</span>
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari aksi, email pengguna, entitas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 rounded-lg border border-gray-300 bg-white"
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Waktu (WIB)</th>
                <th className="py-3 px-4">Pelaku (Actor)</th>
                <th className="py-3 px-4">Aksi (Action)</th>
                <th className="py-3 px-4">Entitas &amp; ID</th>
                <th className="py-3 px-4">Keterangan / Rincian</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50/80">
                  <td className="py-3 px-4 text-gray-500 font-mono text-[11px] whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-4 font-semibold text-gray-900">{log.actorEmail}</td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-800">
                      {log.action}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-gray-800">{log.entity}</div>
                    <div className="text-[10px] text-gray-400 font-mono">{log.entityId}</div>
                  </td>
                  <td className="py-3 px-4 text-gray-600 text-xs">{log.details || '-'}</td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400">
                    Belum ada log audit terekam.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

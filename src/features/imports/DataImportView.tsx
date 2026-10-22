import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Building2,
  Users,
  GraduationCap,
  Wrench,
  School as SchoolIcon,
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import { School, Region } from '../../types';
import { excelService, ParseResult } from '../../services/excelService';
import { enrollmentService } from '../../services/enrollmentService';
import { hrService } from '../../services/hrService';
import { assetsService } from '../../services/assetsService';
import { facilitiesService } from '../../services/facilitiesService';
import { useAuth } from '../../context/AuthContext';

interface DataImportViewProps {
  schools: School[];
  regions: Region[];
  onRefresh: () => void;
  onNavigateToTab: (tab: any) => void;
}

export const DataImportView: React.FC<DataImportViewProps> = ({
  schools,
  regions,
  onRefresh,
  onNavigateToTab
}) => {
  const { hasSchoolAccess } = useAuth();
  const [selectedModule, setSelectedModule] = useState<'ENROLLMENT' | 'HR' | 'ASSET' | 'FACILITY'>('ENROLLMENT');
  const [targetSchoolId, setTargetSchoolId] = useState<string>(schools[0]?.school_id || '');
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  // Parse result state
  const [parseResult, setParseResult] = useState<ParseResult<any> | null>(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);

  const accessibleSchools = schools.filter(s => hasSchoolAccess(s.school_id));

  const handleDownloadTemplate = () => {
    excelService.downloadTemplate(selectedModule);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!targetSchoolId) {
      alert('Pilih sekolah tujuan terlebih dahulu!');
      return;
    }

    setFileName(file.name);
    setParsing(true);
    setParseResult(null);
    setImportSuccessMessage(null);

    try {
      const rawRows = await excelService.parseExcelFile(file);

      let result: ParseResult<any>;
      if (selectedModule === 'ENROLLMENT') {
        result = excelService.validateClassRows(rawRows, targetSchoolId);
      } else if (selectedModule === 'HR') {
        result = excelService.validateStaffRows(rawRows, targetSchoolId);
      } else if (selectedModule === 'ASSET') {
        result = excelService.validateAssetRows(rawRows, targetSchoolId);
      } else {
        result = { validRows: [], invalidRows: [], duplicateCount: 0 };
      }

      setParseResult(result);
    } catch (err: any) {
      alert('Gagal membaca file Excel: ' + (err.message || 'Format tidak didukung'));
    } finally {
      setParsing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!parseResult || parseResult.validRows.length === 0) return;

    setImporting(true);
    let count = 0;

    try {
      if (selectedModule === 'ENROLLMENT') {
        for (const cls of parseResult.validRows) {
          await enrollmentService.saveClass(cls);
          count++;
        }
      } else if (selectedModule === 'HR') {
        for (const st of parseResult.validRows) {
          await hrService.saveStaff(st);
          count++;
        }
      } else if (selectedModule === 'ASSET') {
        for (const ast of parseResult.validRows) {
          await assetsService.saveAsset(ast);
          count++;
        }
      }

      setImportSuccessMessage(`Berhasil mengimpor ${count} baris data ke database Supabase!`);
      setParseResult(null);
      setFileName(null);
      onRefresh();
    } catch (err: any) {
      alert('Terjadi kesalahan saat menyimpan ke database: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Introduction Card */}
      <div className="bg-white p-6 rounded-2xl border border-gray-200/90 shadow-xs">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-[#073b2d] font-bold text-xs mb-3">
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>ARF Data Management &amp; Excel Import System</span>
          </div>
          <h2 className="text-lg font-bold text-gray-900 tracking-tight">
            Pusat Pengumpulan &amp; Pengunggahan Data Sekolah
          </h2>
          <p className="text-xs text-[#5f5d5d] mt-1 leading-relaxed">
            Sistem mendukung impor berkas spreadsheet Excel (.xlsx) dengan validasi otomatis per baris, deteksi duplikasi ID, serta pratinjau data sebelum disimpan permanen ke dalam basis data Cloud Supabase Yayasan ARF.
          </p>
        </div>

        {/* 3 Input Modes Tabs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
            <span className="text-[11px] font-bold text-[#073b2d] uppercase tracking-wider block">Mode 1</span>
            <h4 className="text-sm font-bold text-gray-900 mt-1">Input Manual Berbasis Formulir</h4>
            <p className="text-xs text-[#5f5d5d] mt-1">
              Gunakan formulir entri langsung di menu Rombel, PTK, atau Aset untuk penambahan data harian satu per satu.
            </p>
          </div>

          <div className="p-4 rounded-xl border-2 border-[#073b2d] bg-white shadow-xs">
            <span className="text-[11px] font-bold text-[#c89b55] uppercase tracking-wider block">Mode 2 (Aktif)</span>
            <h4 className="text-sm font-bold text-gray-900 mt-1">Import Spreadsheet Excel</h4>
            <p className="text-xs text-[#5f5d5d] mt-1">
              Unduh template resmi ARF, lengkapi data ratusan baris sekaligus, dan unggah untuk verifikasi instan.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-gray-200 bg-gray-50/50">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Mode 3</span>
            <h4 className="text-sm font-bold text-gray-900 mt-1">Pembaruan &amp; Sinkronisasi</h4>
            <p className="text-xs text-[#5f5d5d] mt-1">
              Edit data yang telah terdaftar tanpa perlu menginput ulang seluruh profil sekolah dari awal.
            </p>
          </div>
        </div>
      </div>

      {/* Step by Step Importer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 1 & 2 Config Panel */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200/90 shadow-xs space-y-5">
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-[#073b2d] text-white text-[11px] flex items-center justify-center font-bold">1</span>
            <span>Konfigurasi Modul &amp; Template</span>
          </h3>

          {/* Module Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Pilih Modul Data *</label>
            <div className="space-y-2">
              {[
                { id: 'ENROLLMENT', label: 'Rombongan Belajar & Peserta Didik', icon: Users },
                { id: 'HR', label: 'Guru & Tenaga Kependidikan (PTK)', icon: GraduationCap },
                { id: 'ASSET', label: 'Inventaris Sarana & Aset', icon: Building2 }
              ].map(item => {
                const Icon = item.icon;
                const isSelected = selectedModule === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => { setSelectedModule(item.id as any); setParseResult(null); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left text-xs transition-all ${
                      isSelected
                        ? 'border-[#073b2d] bg-emerald-50/50 font-bold text-[#073b2d] shadow-xs'
                        : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0 text-[#073b2d]" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* School Selector */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Sekolah Tujuan *</label>
            <select
              value={targetSchoolId}
              onChange={(e) => setTargetSchoolId(e.target.value)}
              className="w-full text-xs p-2.5 rounded-lg border border-gray-300 bg-white text-gray-800"
            >
              {accessibleSchools.map(s => (
                <option key={s.school_id} value={s.school_id}>{s.school_name}</option>
              ))}
            </select>
            <p className="text-[11px] text-[#5f5d5d] mt-1">Data yang diimpor akan langsung diasosiasikan dengan sekolah ini.</p>
          </div>

          {/* Download Official Template */}
          <div className="pt-2">
            <button
              onClick={handleDownloadTemplate}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-[#c89b55] text-[#c89b55] hover:bg-[#c89b55]/10 text-xs font-bold transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Template Resmi ARF (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Step 3: Upload Spreadsheet */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-gray-200/90 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2 mb-4">
              <span className="w-5 h-5 rounded-full bg-[#073b2d] text-white text-[11px] flex items-center justify-center font-bold">2</span>
              <span>Unggah File Spreadsheet (.xlsx)</span>
            </h3>

            {/* Upload Drag & Drop Area */}
            <div className="border-2 border-dashed border-gray-300 hover:border-[#073b2d] rounded-2xl p-8 text-center transition-colors bg-gray-50/50">
              <Upload className="w-10 h-10 text-gray-400 mx-auto mb-2" />
              <div className="text-xs font-bold text-gray-800">
                Pilih atau seret file Excel hasil pengisian template
              </div>
              <p className="text-[11px] text-[#5f5d5d] mt-1">Format yang didukung: .xlsx, .xls</p>

              <label className="mt-4 inline-block px-4 py-2 rounded-xl text-white text-xs font-semibold cursor-pointer shadow-sm hover:bg-[#0a4f3d] transition-colors" style={{ backgroundColor: '#073b2d' }}>
                <span>Pilih Berkas Komputer</span>
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>

              {fileName && (
                <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-900 text-xs font-semibold">
                  <FileCheck className="w-4 h-4 text-emerald-700" />
                  <span>{fileName}</span>
                </div>
              )}
            </div>

            {parsing && (
              <div className="mt-4 text-center text-xs text-[#5f5d5d] animate-pulse">
                Memvalidasi baris spreadsheet dan memeriksa duplikasi...
              </div>
            )}

            {importSuccessMessage && (
              <div className="mt-4 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{importSuccessMessage}</span>
              </div>
            )}
          </div>

          {/* Validation Summary if parsed */}
          {parseResult && (
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Hasil Validasi Berkas
                </h4>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {parseResult.validRows.length} Valid
                  </span>
                  <span className="text-rose-600 font-bold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" />
                    {parseResult.invalidRows.length} Tidak Valid
                  </span>
                  {parseResult.duplicateCount > 0 && (
                    <span className="text-amber-700 font-bold">
                      {parseResult.duplicateCount} Duplikat
                    </span>
                  )}
                </div>
              </div>

              {/* Invalid Rows details if any */}
              {parseResult.invalidRows.length > 0 && (
                <div className="mb-4 max-h-40 overflow-y-auto p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs space-y-1.5">
                  <div className="font-bold text-rose-800">Baris Bermasalah (Ditolak):</div>
                  {parseResult.invalidRows.map((inv, i) => (
                    <div key={i} className="text-[11px] text-rose-700">
                      Baris #{inv.rowNumber}: {inv.errors.join(', ')}
                    </div>
                  ))}
                </div>
              )}

              {/* Action Button */}
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setParseResult(null)}
                  className="px-4 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50"
                >
                  Batalkan
                </button>
                <button
                  onClick={handleExecuteImport}
                  disabled={importing || parseResult.validRows.length === 0}
                  className="px-5 py-2.5 rounded-xl text-white font-bold text-xs shadow-md transition-all disabled:opacity-50 cursor-pointer"
                  style={{ backgroundColor: '#073b2d' }}
                >
                  {importing ? 'Menyimpan ke Supabase...' : `Impor ${parseResult.validRows.length} Data Valid ke Supabase`}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

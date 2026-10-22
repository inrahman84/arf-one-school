import React, { useEffect, useState } from 'react';
import { Image as ImageIcon, Upload, X } from 'lucide-react';
import { validateImageFile } from '../../services/imageStorageService';

interface PhotoUploadFieldProps {
  label: string;
  existingUrl?: string;
  file: File | null;
  onFileChange: (file: File | null) => void;
  onRemoveExisting: () => void;
  disabled?: boolean;
}

export const PhotoUploadField: React.FC<PhotoUploadFieldProps> = ({
  label,
  existingUrl,
  file,
  onFileChange,
  onRemoveExisting,
  disabled = false
}) => {
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!file) {
      setPreview('');
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const currentPreview = preview || existingUrl;

  return (
    <div className="rounded-xl border border-gray-200 p-3 bg-[#f6f3ec]/40">
      <label className="block text-xs font-semibold text-gray-800 mb-2">{label}</label>
      <div className="flex flex-wrap items-center gap-3">
        {currentPreview ? (
          <a href={currentPreview} target="_blank" rel="noopener noreferrer" title={`Lihat ${label.toLowerCase()}`}>
            <img
              src={currentPreview}
              alt={label}
              className="h-24 w-28 rounded-lg border border-gray-200 object-cover bg-white"
            />
          </a>
        ) : (
          <div className="h-24 w-28 rounded-lg border border-dashed border-gray-300 bg-white flex items-center justify-center text-gray-400">
            <ImageIcon className="h-7 w-7" />
          </div>
        )}
        <div className="flex-1 min-w-[180px] space-y-2">
          <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#073b2d] text-[#073b2d] bg-white text-xs font-semibold cursor-pointer hover:bg-emerald-50 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
            <Upload className="h-4 w-4" /> {currentPreview ? 'Ganti Gambar' : 'Upload Gambar'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={disabled}
              onChange={e => {
                const candidate = e.target.files?.[0];
                e.target.value = '';
                if (!candidate) return;
                try {
                  validateImageFile(candidate);
                  setError('');
                  onFileChange(candidate);
                } catch (err: any) {
                  setError(err.message || 'File tidak valid.');
                }
              }}
            />
          </label>
          {currentPreview && (
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                onFileChange(null);
                onRemoveExisting();
                setError('');
              }}
              className="ml-2 inline-flex gap-1 items-center text-xs font-medium text-rose-600 hover:underline disabled:opacity-50"
            >
              <X className="w-3.5 h-3.5" /> Hapus Gambar
            </button>
          )}
          <p className="text-[11px] text-gray-500">JPG, PNG, atau WebP. Maksimal 5 MB. Opsional.</p>
          {file && <p className="text-[11px] text-[#073b2d] break-all">Dipilih: {file.name}</p>}
          {error && <p role="alert" className="text-[11px] text-rose-700">{error}</p>}
        </div>
      </div>
    </div>
  );
};

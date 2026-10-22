import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  itemName?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDangerous?: boolean;
  loading?: boolean;
  confirmDisabled?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  itemName,
  confirmLabel = 'Hapus Sekarang',
  cancelLabel = 'Batal',
  isDangerous = true,
  loading = false,
  confirmDisabled = false,
  error = null,
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-100 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-gray-900">{title}</h3>
            <p className="text-xs text-[#5f5d5d] mt-1 leading-relaxed">{message}</p>
            {itemName && (
              <div className="mt-2 p-2 rounded-lg bg-gray-50 border border-gray-200 text-xs font-semibold text-gray-800 break-all font-mono">
                {itemName}
              </div>
            )}
            {error && (
              <div className="mt-2.5 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {error}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-xl border border-gray-300 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || confirmDisabled}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-bold transition-all shadow-xs cursor-pointer ${
              isDangerous
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-[#073b2d] hover:bg-[#0a4f3d]'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{loading ? 'Menghapus...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

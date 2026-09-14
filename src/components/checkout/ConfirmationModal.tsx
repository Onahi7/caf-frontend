import { useEffect } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, LoaderCircle } from 'lucide-react';
import { Button } from '../ui/Button';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isLoading?: boolean;
  type?: 'info' | 'warning' | 'success' | 'error';
}

const typeConfig = {
  success: {
    iconStyle: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
    Icon: CheckCircle2,
    confirmVariant: 'primary' as const,
  },
  warning: {
    iconStyle: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
    Icon: AlertTriangle,
    confirmVariant: 'secondary' as const,
  },
  error: {
    iconStyle: 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30',
    Icon: AlertCircle,
    confirmVariant: 'danger' as const,
  },
  info: {
    iconStyle: 'bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30',
    Icon: Info,
    confirmVariant: 'primary' as const,
  },
};

export const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isLoading = false,
  type = 'info',
}: ConfirmationModalProps) => {
  // Handle ESC key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, isLoading, onClose]);

  // Handle Enter key
  useEffect(() => {
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && isOpen && !isLoading) {
        onConfirm();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEnter);
      return () => document.removeEventListener('keydown', handleEnter);
    }
  }, [isOpen, isLoading, onConfirm]);

  if (!isOpen) return null;

  const config = typeConfig[type] ?? typeConfig.info;
  const IconComponent = config.Icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
        onClick={!isLoading ? onClose : undefined}
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.1] bg-slate-900/95 shadow-2xl shadow-black/80 backdrop-blur-2xl p-6 text-center animate-in zoom-in-95 duration-150">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${config.iconStyle} shadow-lg`}>
            <IconComponent className="h-7 w-7" />
          </div>
        </div>

        {/* Content */}
        <h2 id="modal-title" className="text-xl font-bold tracking-tight text-white mb-2">
          {title}
        </h2>
        <p className="text-sm leading-relaxed text-slate-300 mb-6">
          {message}
        </p>

        {/* Actions */}
        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isLoading}
            className="flex-1"
          >
            {cancelText}
          </Button>
          <Button
            type="button"
            variant={config.confirmVariant}
            onClick={onConfirm}
            disabled={isLoading}
            isLoading={isLoading}
            className="flex-1"
          >
            {confirmText}
          </Button>
        </div>

        {/* Keyboard Hints */}
        {!isLoading && (
          <div className="mt-4 flex items-center justify-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-white/[0.08] rounded text-slate-400 font-mono text-[10px]">Enter</kbd>
              to confirm
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-white/[0.08] rounded text-slate-400 font-mono text-[10px]">Esc</kbd>
              to cancel
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

import { useEffect, useId, useRef } from 'react';
import { AlertTriangle, Info, LoaderCircle, ShieldAlert } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  isLoading?: boolean;
}

export const ConfirmDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'danger',
  isLoading = false,
}: ConfirmDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    if (!isOpen) return undefined;

    previousFocusRef.current = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => cancelRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) {
        onClose();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, isOpen, onClose]);

  if (!isOpen) return null;

  const variants = {
    danger: {
      button: 'bg-rose-500 text-white hover:bg-rose-400 focus:ring-rose-400 shadow-lg shadow-rose-950/40',
      icon: 'border-rose-500/30 bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/20',
      Icon: ShieldAlert,
    },
    warning: {
      button: 'bg-amber-400 text-slate-950 font-bold hover:bg-amber-300 focus:ring-amber-300 shadow-lg shadow-amber-950/40',
      icon: 'border-amber-500/30 bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/20',
      Icon: AlertTriangle,
    },
    info: {
      button: 'bg-emerald-500 text-slate-950 font-bold hover:bg-emerald-400 focus:ring-emerald-400 shadow-lg shadow-emerald-950/40',
      icon: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/20',
      Icon: Info,
    },
  };
  const variantConfig = variants[variant];
  const VariantIcon = variantConfig.Icon;

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-950/80 backdrop-blur-md transition-opacity"
        onClick={isLoading ? undefined : onClose}
        aria-label="Close confirmation"
        tabIndex={-1}
      />
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="relative w-full max-w-md rounded-t-3xl border border-white/[0.1] bg-slate-900/95 p-5 shadow-2xl shadow-black/80 outline-none backdrop-blur-2xl sm:rounded-2xl sm:p-6 animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Mobile drag handle indicator */}
        <div className="pb-3 pt-1 sm:hidden flex justify-center">
          <div className="h-1.5 w-12 rounded-full bg-white/20" />
        </div>

        <div className="flex items-start gap-4">
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border p-3 ${variantConfig.icon}`} aria-hidden="true">
            <VariantIcon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2 id={titleId} className="text-lg font-bold text-white tracking-tight">{title}</h2>
            <p id={messageId} className="mt-1.5 text-sm leading-relaxed text-slate-300">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="min-h-11 rounded-xl border border-white/10 px-4 py-2 font-medium text-slate-300 transition-colors hover:bg-white/[0.06] hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            disabled={isLoading}
            className={`min-h-11 rounded-xl px-5 py-2 font-semibold transition-all focus:outline-none focus:ring-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${variantConfig.button}`}
          >
            <span className="flex items-center justify-center gap-2">
              {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
              {confirmLabel}
            </span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

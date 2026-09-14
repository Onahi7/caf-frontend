import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
}

export const Modal = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
}: ModalProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';

      const timer = setTimeout(() => {
        const focusable = containerRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        focusable?.focus();
      }, 10);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = containerRef.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
      previousFocusRef.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
    full: 'sm:max-w-[calc(100vw-2rem)]',
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-end justify-center overflow-hidden p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-md transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        ref={containerRef}
        className={`relative flex max-h-[92dvh] w-full ${sizeStyles[size]} flex-col overflow-hidden rounded-t-3xl border border-white/[0.1] bg-slate-900/95 shadow-2xl shadow-black/60 sm:my-8 sm:rounded-2xl sm:max-h-[85dvh] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200`}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        {title && (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/[0.08] bg-slate-900/80 backdrop-blur-md px-5 py-4 sm:px-6">
            <h2 id="modal-title" className="min-w-0 truncate text-base font-semibold text-slate-100 sm:text-lg">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        {!title && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 z-20 rounded-xl p-2 text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-white"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 pb-safe-bottom sm:px-6 sm:py-6">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
};

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

// Module-level modal stack so stacked overlays behave correctly:
// only the top-most modal reacts to Escape, and background scroll is
// only released when the last open modal has closed.
let openModalCount = 0;
let bodyOverflowBeforeLock = '';
const modalStack: symbol[] = [];

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
  const modalIdRef = useRef<symbol>(Symbol('modal'));
  const titleId = useId();

  useEffect(() => {
    if (isOpen) {
      const modalId = modalIdRef.current;
      modalStack.push(modalId);
      openModalCount += 1;
      if (openModalCount === 1) {
        bodyOverflowBeforeLock = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
      }
      previousFocusRef.current = document.activeElement as HTMLElement;

      const timer = setTimeout(() => {
        if (!containerRef.current) return;

        // If an input, textarea or select inside this modal is ALREADY focused, do not steal focus
        const active = document.activeElement as HTMLElement | null;
        if (
          active &&
          containerRef.current.contains(active) &&
          (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')
        ) {
          return;
        }

        // Prioritize the first visible editable form control over close buttons
        const firstInput = containerRef.current.querySelector<HTMLElement>(
          'input:not([type="hidden"]):not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly]), select:not([disabled])'
        );
        if (firstInput) {
          firstInput.focus();
          return;
        }

        // If no form inputs exist in the modal, find the first action button that is NOT the close button
        const actionButton = containerRef.current.querySelector<HTMLElement>(
          'button:not([aria-label="Close modal"]):not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        );
        if (actionButton) {
          actionButton.focus();
          return;
        }

        // Fallback to any focusable element (e.g. close button)
        const fallback = containerRef.current.querySelector<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        fallback?.focus();
      }, 20);

      return () => {
        clearTimeout(timer);
        const index = modalStack.lastIndexOf(modalId);
        if (index !== -1) modalStack.splice(index, 1);
        openModalCount = Math.max(0, openModalCount - 1);
        if (openModalCount === 0) {
          document.body.style.overflow = bodyOverflowBeforeLock;
        }
      };
    }
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only the top-most open modal handles keyboard shortcuts
      if (modalStack[modalStack.length - 1] !== modalIdRef.current) return;

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
        const active = document.activeElement;

        // If focus escaped the dialog entirely, pull it back to the first element
        if (!containerRef.current?.contains(active)) {
          e.preventDefault();
          first.focus();
          return;
        }

        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (
        previousFocusRef.current &&
        typeof previousFocusRef.current.focus === 'function' &&
        document.body.contains(previousFocusRef.current)
      ) {
        previousFocusRef.current.focus();
      }
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
      aria-labelledby={title ? titleId : undefined}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-950/75 backdrop-blur-md transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div
        ref={containerRef}
        className={`relative flex max-h-[92dvh] w-full ${sizeStyles[size]} flex-col overflow-hidden rounded-t-3xl border border-white/[0.1] bg-slate-900/95 shadow-2xl shadow-black/80 sm:my-8 sm:rounded-2xl sm:max-h-[85dvh] backdrop-blur-2xl animate-in fade-in zoom-in-95 duration-200`}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Mobile drag handle indicator */}
        <div className="pt-2 sm:hidden flex justify-center">
          <div className="h-1.5 w-12 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        {title && (
          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/[0.08] bg-slate-900/80 backdrop-blur-md px-5 py-4 sm:px-6">
            <h2 id={titleId} className="min-w-0 truncate text-base font-semibold text-slate-100 sm:text-lg">
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

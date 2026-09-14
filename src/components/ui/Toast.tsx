import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { type Toast, ToastContext } from '../../contexts/ToastContext';

interface ToastProviderProps {
  children: ReactNode;
}

export const ToastProvider = ({ children }: ToastProviderProps) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeoutRefs = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    const timeout = timeoutRefs.current.get(id);
    if (timeout) {
      clearTimeout(timeout);
      timeoutRefs.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = crypto.randomUUID();
    const newToast = { ...toast, id };
    setToasts((prev) => {
      const next = [...prev, newToast];
      const removed = next.length > 4 ? next.shift() : undefined;
      if (removed) {
        const removedTimeout = timeoutRefs.current.get(removed.id);
        if (removedTimeout) clearTimeout(removedTimeout);
        timeoutRefs.current.delete(removed.id);
      }
      return next;
    });

    const duration = toast.duration ?? 5000;
    const timeout = setTimeout(() => {
      removeToast(id);
    }, duration);
    timeoutRefs.current.set(id, timeout);
  }, [removeToast]);

  useEffect(() => {
    return () => {
      timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
      timeoutRefs.current.clear();
    };
  }, []);

  const showSuccess = useCallback((title: string, message?: string) => {
    addToast({ type: 'success', title, message });
  }, [addToast]);

  const showError = useCallback((title: string, message?: string) => {
    addToast({ type: 'error', title, message });
  }, [addToast]);

  const showWarning = useCallback((title: string, message?: string) => {
    addToast({ type: 'warning', title, message });
  }, [addToast]);

  const showInfo = useCallback((title: string, message?: string) => {
    addToast({ type: 'info', title, message });
  }, [addToast]);

  return (
    <ToastContext.Provider value={{
      toasts,
      addToast,
      removeToast,
      showSuccess,
      showError,
      showWarning,
      showInfo,
    }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onRemove: (id: string) => void;
}

const ToastContainer = ({ toasts, onRemove }: ToastContainerProps) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed top-[calc(1rem+env(safe-area-inset-top))] right-4 left-4 z-[100] flex flex-col gap-2.5 sm:left-auto sm:w-96"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
};

interface ToastItemProps {
  toast: Toast;
  onRemove: (id: string) => void;
}

const severityConfig = {
  success: {
    border: 'border-emerald-500/30 hover:border-emerald-500/50',
    shadow: 'shadow-emerald-950/40',
    badge: 'bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30',
    progress: 'bg-emerald-400',
    Icon: CheckCircle2,
  },
  error: {
    border: 'border-rose-500/30 hover:border-rose-500/50',
    shadow: 'shadow-rose-950/40',
    badge: 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30',
    progress: 'bg-rose-400',
    Icon: XCircle,
  },
  warning: {
    border: 'border-amber-500/30 hover:border-amber-500/50',
    shadow: 'shadow-amber-950/40',
    badge: 'bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30',
    progress: 'bg-amber-400',
    Icon: AlertTriangle,
  },
  info: {
    border: 'border-sky-500/30 hover:border-sky-500/50',
    shadow: 'shadow-sky-950/40',
    badge: 'bg-sky-500/15 text-sky-400 ring-1 ring-sky-500/30',
    progress: 'bg-sky-400',
    Icon: Info,
  },
};

const ToastItem = ({ toast, onRemove }: ToastItemProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const duration = toast.duration ?? 5000;
  const config = severityConfig[toast.type] ?? severityConfig.info;
  const IconComponent = config.Icon;

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 15);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration]);

  const handleRemove = () => {
    setIsVisible(false);
    setTimeout(() => onRemove(toast.id), 220);
  };

  return (
    <div
      className={`pointer-events-auto relative w-full overflow-hidden rounded-2xl border bg-slate-900/90 backdrop-blur-xl p-4 text-slate-100 shadow-2xl transition-all duration-200 ease-out ${config.border} ${config.shadow} ${
        isVisible ? 'translate-y-0 opacity-100 scale-100' : '-translate-y-2 opacity-0 scale-95'
      }`}
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <div className="flex items-start gap-3.5">
        <div className={`shrink-0 flex h-9 w-9 items-center justify-center rounded-xl ${config.badge}`}>
          <IconComponent className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold tracking-tight text-white">{toast.title}</p>
          {toast.message && (
            <p className="mt-1 text-xs leading-relaxed text-slate-300 break-words">{toast.message}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleRemove}
          className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/20"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Auto-dismiss progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/[0.06] overflow-hidden">
        <div
          className={`h-full transition-all duration-75 ease-linear ${config.progress}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

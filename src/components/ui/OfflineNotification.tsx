import { useEffect, useState } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { SyncService } from '../../services/sync-service';

export const OfflineNotification = () => {
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const checkQueue = async () => {
      const count = await SyncService.getQueueLength();
      setPendingCount(count);
    };

    checkQueue();
    const interval = setInterval(checkQueue, 10000);
    return () => clearInterval(interval);
  }, []);

  if (pendingCount === 0) return null;

  return (
    <div
      className="fixed top-[calc(1rem+env(safe-area-inset-top))] left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-full border border-amber-500/30 bg-slate-900/90 px-4 py-2 text-xs font-semibold text-slate-200 shadow-2xl shadow-black/60 backdrop-blur-xl animate-in fade-in slide-in-from-top-3 duration-200"
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
      </span>
      <CloudOff className="h-4 w-4 text-amber-400 shrink-0" />
      <span>
        {pendingCount} {pendingCount === 1 ? 'operation' : 'operations'} queued offline
      </span>
      <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-400 shrink-0 ml-0.5" />
    </div>
  );
};

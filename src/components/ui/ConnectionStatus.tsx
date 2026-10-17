import { useWebSocket } from '../../hooks/useWebSocket';
import { useSyncQueue } from '../../hooks/useSyncQueue';

export const ConnectionStatus = () => {
  const { isConnected } = useWebSocket();
  const { isBrowserOnline, pendingCount } = useSyncQueue();
  const isOnline = isConnected && isBrowserOnline;

  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-lg transition-all" role="status" aria-live="polite">
      <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} aria-hidden="true" />
      <span className="text-xs font-medium text-slate-300">
        {isOnline ? 'Online' : 'Offline'}
      </span>
      {pendingCount > 0 && (
        <div className="flex items-center gap-1 ml-2 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-500 text-xs font-bold">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          {pendingCount} Pending
        </div>
      )}
    </div>
  );
};

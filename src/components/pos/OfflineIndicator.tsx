import { useOfflineStore } from '../../stores/offline-store';
import { Button } from '../ui/Button';

export const OfflineIndicator = () => {
  const { isOnline, isSyncing, queuedCount, syncQueue } = useOfflineStore();

  if (isOnline && queuedCount === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-50">
      {!isOnline ? (
        <div className="bg-orange-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center space-x-3">
          <svg
            className="w-5 h-5 animate-pulse"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
            />
          </svg>
          <div>
            <p className="font-semibold">Offline Mode</p>
            <p className="text-xs">
              {queuedCount > 0
                ? `${queuedCount} sale${queuedCount > 1 ? 's' : ''} queued`
                : 'Sales will be queued'}
            </p>
          </div>
        </div>
      ) : queuedCount > 0 ? (
        <div className="bg-slate-900 border border-emerald-500/40 text-white px-4 py-3 rounded-lg shadow-lg">
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-3">
              <svg
                className={`w-5 h-5 ${isSyncing ? 'animate-spin' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <div>
                <p className="font-semibold">
                  {isSyncing ? 'Syncing...' : 'Pending Sync'}
                </p>
                <p className="text-xs text-slate-300">
                  {queuedCount} sale{queuedCount > 1 ? 's' : ''} in queue
                </p>
              </div>
            </div>
            {!isSyncing && (
              <Button
                size="sm"
                variant="primary"
                onClick={syncQueue}
              >
                Sync Now
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

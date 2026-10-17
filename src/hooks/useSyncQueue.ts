import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { SyncService } from '../services/sync-service';
import { queryKeys } from '../lib/query-keys';

export const useSyncQueue = () => {
  const [isBrowserOnline, setIsBrowserOnline] = useState(
    () => (typeof navigator === 'undefined' ? true : navigator.onLine),
  );

  useEffect(() => {
    const handleOnline = () => setIsBrowserOnline(true);
    const handleOffline = () => setIsBrowserOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const queueQuery = useQuery({
    queryKey: queryKeys.sync.queueLength(),
    queryFn: () => SyncService.getQueueLength(),
    refetchInterval: 10000,
  });

  return {
    isBrowserOnline,
    pendingCount: queueQuery.data ?? 0,
  };
};

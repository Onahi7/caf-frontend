import { create } from 'zustand';
import { offlineDb, type QueuedSale } from '../lib/offline-db';
import apiClient from '../lib/api-client';

interface OfflineState {
  isOnline: boolean;
  isSyncing: boolean;
  queuedCount: number;
  lastSyncTime: number | null;
  
  // Actions
  setOnlineStatus: (isOnline: boolean) => void;
  queueSale: (sale: Omit<QueuedSale, 'id' | 'timestamp' | 'retryCount'>) => Promise<void>;
  syncQueue: () => Promise<void>;
  getQueuedSales: () => Promise<QueuedSale[]>;
  clearQueue: () => Promise<void>;
  updateQueueCount: () => Promise<void>;
}

const MAX_RETRY_COUNT = 3;

export const useOfflineStore = create<OfflineState>((set, get) => ({
  isOnline: navigator.onLine,
  isSyncing: false,
  queuedCount: 0,
  lastSyncTime: null,

  setOnlineStatus: (isOnline) => {
    set({ isOnline });
    
    // Automatically sync when coming back online
    if (isOnline && get().queuedCount > 0) {
      get().syncQueue();
    }
  },

  queueSale: async (sale) => {
    try {
      await offlineDb.queuedSales.add({
        ...sale,
        timestamp: Date.now(),
        retryCount: 0,
      });
      
      await get().updateQueueCount();
      
      // Try to sync immediately if online
      if (get().isOnline) {
        get().syncQueue();
      }
    } catch (error) {
      console.error('Failed to queue sale:', error);
      throw error;
    }
  },

  syncQueue: async () => {
    // Use a local lock flag to prevent race conditions
    // Zustand's set is synchronous, but we double-check after setting
    const state = get();
    
    if (state.isSyncing || !state.isOnline) {
      return;
    }

    // Try to acquire the lock
    set({ isSyncing: true });
    
    // Double-check: if another call already changed isSyncing, release and return
    if (get().isSyncing !== true) {
      return;
    }

    try {
      const queuedSales = await offlineDb.queuedSales
        .where('retryCount')
        .below(MAX_RETRY_COUNT)
        .toArray();

      if (queuedSales.length === 0) {
        set({ isSyncing: false, lastSyncTime: Date.now() });
        return;
      }

      const results = await Promise.allSettled(
        queuedSales.map(async (sale) => {
          try {
            // Attempt to sync the sale
            await apiClient.post('/sales/checkout', {
              branchId: sale.branchId,
              shiftId: sale.shiftId,
              terminalId: sale.terminalId,
              items: sale.items,
              discount: sale.discount,
              paymentMethod: sale.paymentMethod,
              paymentReference: sale.paymentReference, // Include mobile money reference if present
              prescriptionUrl: sale.prescriptionUrl,
            });

            // Remove from queue on success
            await offlineDb.queuedSales.delete(sale.id!);
            return { success: true, id: sale.id };
          } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            // Increment retry count on failure
            await offlineDb.queuedSales.update(sale.id!, {
              retryCount: sale.retryCount + 1,
              lastError: errorMessage,
            });
            
            return { success: false, id: sale.id, error };
          }
        })
      );

      const successCount = results.filter(
        (r) => r.status === 'fulfilled' && r.value.success
      ).length;

      await get().updateQueueCount();
      set({ isSyncing: false, lastSyncTime: Date.now() });
    } catch (error) {
      console.error('Sync failed:', error);
      set({ isSyncing: false });
    }
  },

  getQueuedSales: async () => {
    return await offlineDb.queuedSales.toArray();
  },

  clearQueue: async () => {
    await offlineDb.queuedSales.clear();
    await get().updateQueueCount();
  },

  updateQueueCount: async () => {
    const count = await offlineDb.queuedSales.count();
    set({ queuedCount: count });
  },
}));

// Set up online/offline event listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useOfflineStore.getState().setOnlineStatus(true);
  });

  window.addEventListener('offline', () => {
    useOfflineStore.getState().setOnlineStatus(false);
  });

  // Initialize queue count
  useOfflineStore.getState().updateQueueCount();
}

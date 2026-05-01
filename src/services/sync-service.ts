import Dexie, { type Table } from 'dexie';
import apiClient from '../lib/api-client';

export interface QueuedRequest {
  id: string;
  url: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  payload: any;
  headers: Record<string, string>;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
  processingSince?: number;
}

class OfflineDatabase extends Dexie {
  offlineQueue!: Table<QueuedRequest, string>;

  constructor() {
    super('PharmacyPOSOfflineDB');
    this.version(1).stores({
      offlineQueue: 'id, timestamp, status',
    });
  }
}

const db = new OfflineDatabase();

export const SyncService = {
  async queueRequest(request: Omit<QueuedRequest, 'id' | 'timestamp' | 'retryCount' | 'status'>) {
    const item: QueuedRequest = {
      ...request,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      retryCount: 0,
      status: 'pending',
    };
    await db.offlineQueue.add(item);
    console.log(`[SyncService] Request queued: ${request.url}`);
    return item.id;
  },

  async processQueue() {
    console.log('[SyncService] Processing offline queue...');

    // Claim stale items (processing for more than 1 minute = stale)
    const staleThreshold = Date.now() - 60000;
    await db.offlineQueue
      .where('status').equals('syncing')
      .and(item => !!(item.processingSince && item.processingSince < staleThreshold))
      .modify({ status: 'pending', processingSince: undefined });

    const pending = await db.offlineQueue
      .where('status')
      .equals('pending')
      .sortBy('timestamp');

    for (const req of pending) {
      // Atomically claim the item by updating status to 'syncing' with processingSince
      const updated = await db.offlineQueue.update(req.id, {
        status: 'syncing',
        processingSince: Date.now(),
      });

      // If no rows were updated, another call already claimed this item
      if (updated === 0) {
        console.log(`[SyncService] Skipping already claimed: ${req.url}`);
        continue;
      }

      try {
        await apiClient({
          url: req.url,
          method: req.method,
          data: req.payload,
          headers: req.headers,
        });

        await db.offlineQueue.delete(req.id);
        console.log(`[SyncService] Successfully synced: ${req.url}`);
      } catch (error: any) {
        console.error(`[SyncService] Failed to sync ${req.url}:`, error);

        // If it's a client error (4xx) and not a timeout/rate-limit, mark as failed
        if (error.response && error.response.status >= 400 && error.response.status < 500
            && error.response.status !== 408 && error.response.status !== 429) {
          await db.offlineQueue.update(req.id, { status: 'failed' });
          // Stop processing queue to prevent poison pill requests
          break;
        } else {
          await db.offlineQueue.update(req.id, {
            status: 'pending',
            retryCount: req.retryCount + 1
          });
        }
      }
    }
  },

  async getQueueLength(): Promise<number> {
    return await db.offlineQueue.where('status').equals('pending').count();
  },

  async getPendingRequests(): Promise<QueuedRequest[]> {
    return await db.offlineQueue.where('status').equals('pending').toArray();
  }
};

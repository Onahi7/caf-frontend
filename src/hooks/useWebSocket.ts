import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore, type User } from '../stores/auth-store';
import apiClient from '../lib/api-client';
import { useBranchStore } from '../stores/branch-store';
import { SyncService } from '../services/sync-service';

const DEFAULT_WS_URL = 'wss://carefam-00c1641bcdf9.herokuapp.com/inventory';
const WS_URL = import.meta.env.VITE_WS_URL?.trim() || DEFAULT_WS_URL;

interface InventoryUpdate {
  batchId: string;
  productId: string;
  branchId: string;
  quantityAvailable: number;
  updateType: 'sale' | 'purchase' | 'transfer' | 'adjustment' | 'return';
}

interface SaleUpdate {
  saleId: string;
  branchId: string;
  shiftId: string;
  total: number;
  totalFormatted: string;
  paymentMethod: string;
  paymentMethodLabel: string;
  paymentReference?: string;
  items: Array<{
    productId: string;
    batchId: string;
    quantity: number;
  }>;
  updateType: 'completed' | 'returned' | 'partially_returned';
  timestamp: Date;
}

export interface NotificationUpdate {
  notificationId: string;
  type: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  link?: string;
  createdAt: string | Date;
}

interface UseWebSocketOptions {
  onInventoryUpdate?: (update: InventoryUpdate) => void;
  onSaleUpdate?: (update: SaleUpdate) => void;
  onNotification?: (update: NotificationUpdate) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const socketRef = useRef<Socket | null>(null);
  const optionsRef = useRef(options);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const { accessToken, isAuthenticated } = useAuthStore();
  const { selectedBranch } = useBranchStore();
  const selectedBranchId = selectedBranch?._id;

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    // Only connect if authenticated
    if (!isAuthenticated || !accessToken) {
      return;
    }

    // Create socket connection
    const socket = io(WS_URL, {
      auth: {
        token: accessToken,
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;
    let disposed = false;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setConnectionError(null);

      // Trigger offline sync upon reconnection
      SyncService.processQueue().catch(err =>
        console.error('[WebSocket] Offline sync failed:', err)
      );

      // Join branch-specific room if branch is selected
      if (selectedBranchId) {
        socket.emit('join-branch', selectedBranchId);
      }

      optionsRef.current.onConnect?.();
    });

    socket.on('disconnect', async (reason) => {
      console.log('WebSocket disconnected:', reason);
      setIsConnected(false);
      optionsRef.current.onDisconnect?.();
      // Server revocation requires a fresh permission check before reconnecting.
      if (reason === 'io server disconnect' && !disposed) {
        try {
          const { data: user } = await apiClient.get<User>('/auth/me');
          if (disposed) return;
          useAuthStore.getState().updateUser({ ...user, branchId: user.branchId ?? undefined });
          socket.auth = { token: useAuthStore.getState().accessToken };
          socket.connect();
        } catch {
          // Remain disconnected when the account no longer has access.
        }
      }
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnectionError(error.message);
      optionsRef.current.onError?.(error);
    });

    // Inventory update handler
    socket.on('inventory:update', (update: InventoryUpdate) => {
      console.log('Received inventory update:', update);
      optionsRef.current.onInventoryUpdate?.(update);
    });

    // Sale update handler
    socket.on('sale:update', (update: SaleUpdate) => {
      console.log('Received sale update:', update);
      optionsRef.current.onSaleUpdate?.(update);
    });

    // Notification handler
    socket.on('notification:new', (update: NotificationUpdate) => {
      console.log('Received notification:', update);
      optionsRef.current.onNotification?.(update);
      // Dispatch a window event for the bell to listen on
      window.dispatchEvent(
        new CustomEvent('app:notification-new', { detail: update }),
      );
    });

    // Cleanup on unmount
    return () => {
      disposed = true;
      if (socket) {
        socket.disconnect();
      }
    };
  }, [isAuthenticated, accessToken, selectedBranchId]);

  // Join a specific branch room
  const joinBranch = (branchId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('join-branch', branchId);
    }
  };

  // Leave a branch room
  const leaveBranch = (branchId: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('leave-branch', branchId);
    }
  };

  return {
    isConnected,
    connectionError,
    joinBranch,
    leaveBranch,
  };
};

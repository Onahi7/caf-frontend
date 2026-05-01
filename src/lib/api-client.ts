import axios, { type AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { SyncService } from '../services/sync-service';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Simple UUID v4 generator (no external dependency needed)
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// SessionStorage-based cache to map request fingerprints to idempotency keys
// Persists across page reloads (unlike Map which is cleared)
// Key: JSON.stringify({ method, url, payload }) -> Value: UUID
const IDEMPOTENCY_KEY_PREFIX = 'idempotency_key_';

function getStoredKey(fingerprint: string): string | null {
  try {
    return sessionStorage.getItem(IDEMPOTENCY_KEY_PREFIX + fingerprint);
  } catch {
    return null;
  }
}

function storeKey(fingerprint: string, key: string): void {
  try {
    sessionStorage.setItem(IDEMPOTENCY_KEY_PREFIX + fingerprint, key);
  } catch {
    // sessionStorage might be unavailable (e.g., SSR)
  }
}

function removeStoredKey(fingerprint: string): void {
  try {
    sessionStorage.removeItem(IDEMPOTENCY_KEY_PREFIX + fingerprint);
  } catch {
    // sessionStorage might be unavailable
  }
}

// Create axios instance
const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Helper to read token from Zustand persisted storage
function getStoredToken(key: 'accessToken' | 'refreshToken'): string | null {
  try {
    const raw = localStorage.getItem('auth-storage');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.state?.[key] ?? null;
  } catch {
    return null;
  }
}

// Request interceptor to add auth token and idempotency keys
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 1. Add Auth Token
    const token = getStoredToken('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 2. Handle Idempotency for write operations
    const writeMethods = ['post', 'put', 'patch', 'delete'];
    if (config.method && writeMethods.includes(config.method.toLowerCase())) {
      const fingerprint = JSON.stringify({
        method: config.method,
        url: config.url,
        data: config.data,
      });

      // Check sessionStorage for existing key (persists across page reloads)
      let idempotencyKey = getStoredKey(fingerprint);
      if (!idempotencyKey) {
        idempotencyKey = generateUUID();
        storeKey(fingerprint, idempotencyKey);
      }

      if (config.headers) {
        config.headers['X-Idempotency-Key'] = idempotencyKey;
      }
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle token refresh and offline queuing
apiClient.interceptors.response.use(
  (response) => {
    // Clear idempotency key on successful write operation to allow future identical requests
    const config = response.config;
    if (config && config.method && ['post', 'put', 'patch', 'delete'].includes(config.method.toLowerCase())) {
      const fingerprint = JSON.stringify({
        method: config.method,
        url: config.url,
        data: config.data,
      });
      removeStoredKey(fingerprint);
    }
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const requestUrl = originalRequest.url || '';
    const isAuthEndpoint = /\/auth\/(login|refresh|logout)/.test(requestUrl);

    // Handle Offline Queuing: if network error and write operation, queue it
    if (
      !error.response &&
      !isAuthEndpoint &&
      originalRequest.method &&
      ['post', 'put', 'patch', 'delete'].includes(originalRequest.method.toLowerCase())
    ) {
      try {
        await SyncService.queueRequest({
          url: requestUrl,
          method: originalRequest.method?.toUpperCase() as any,
          payload: originalRequest.data,
          headers: originalRequest.headers as any,
        });

        // Return a custom error that the UI can interpret as "Queued for Offline Sync"
        const offlineError = new Error('Network unavailable. Request queued for offline sync.');
        (offlineError as any).isOfflineQueued = true;
        return Promise.reject(offlineError);
      } catch (queueError) {
        console.error('Failed to queue offline request:', queueError);
      }
    }

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = getStoredToken('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // Attempt to refresh the token
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        }, {
          withCredentials: true,
        });

        const { accessToken, refreshToken: newRefreshToken } = response.data;
        // Update Zustand persisted storage
        try {
          const raw = localStorage.getItem('auth-storage');
          if (raw) {
            const parsed = JSON.parse(raw);
            parsed.state.accessToken = accessToken;
            if (newRefreshToken) parsed.state.refreshToken = newRefreshToken;
            localStorage.setItem('auth-storage', JSON.stringify(parsed));
          }
        } catch { /* ignore parse errors */ }

        // Retry the original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('auth-storage');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Email API methods
export const emailApi = {
  sendReceiptEmail: async (email: string, saleId: string): Promise<void> => {
    try {
      await apiClient.post('/email/receipt', { email, saleId });
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message || 'Failed to send email';
        throw new Error(message);
      }
      throw error;
    }
  },
};

export default apiClient;

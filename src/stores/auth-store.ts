import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { secureSession } from '../lib/secure-session';

/** Session policy:
 *  - access token: 24h (or 7d for admins)
 *  - refresh token: 30 days rolling session
 */
const ACCESS_TOKEN_TTL_SECONDS = 24 * 60 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Safely extract expiry timestamp (in ms) directly from a JWT token's `exp` claim.
 */
export function getJwtExpiryMs(token: string | null): number | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const payload = JSON.parse(jsonStr);
    if (typeof payload.exp === 'number') {
      return payload.exp * 1000;
    }
  } catch {
    return null;
  }
  return null;
}

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'super_admin' | 'branch_manager' | 'cashier' | 'auditor' | 'marketer' | 'finance_manager';
  branchId?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  sessionExpiresAt: number | null;
  refreshExpiresAt: number | null;
  isAuthenticated: boolean;
  hasHydrated: boolean;

  // Actions
  setAuth: (
    user: User,
    accessToken: string,
    refreshToken: string,
    expiresInSeconds?: number,
    sessionExpiresAt?: number,
    refreshExpiresInSeconds?: number,
  ) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  /** Called by the api-client after a successful token refresh */
  refreshSession: (
    accessToken: string,
    refreshToken: string,
    expiresInSeconds: number,
    refreshExpiresInSeconds: number,
  ) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      sessionExpiresAt: null,
      refreshExpiresAt: null,
      isAuthenticated: false,
      hasHydrated: false,

      setAuth: (
        user,
        accessToken,
        refreshToken,
        expiresInSeconds = ACCESS_TOKEN_TTL_SECONDS,
        _sessionExpiresAt,
        refreshExpiresInSeconds = REFRESH_TOKEN_TTL_SECONDS,
      ) => {
        const realAccessExpMs = getJwtExpiryMs(accessToken);
        const sessionExp = realAccessExpMs ?? (Date.now() + expiresInSeconds * 1000);
        const realRefreshExpMs = getJwtExpiryMs(refreshToken);
        const refreshExp = realRefreshExpMs ?? (Date.now() + refreshExpiresInSeconds * 1000);

        set({
          user,
          accessToken,
          refreshToken,
          sessionExpiresAt: sessionExp,
          refreshExpiresAt: refreshExp,
          isAuthenticated: true,
        });

        // Mirror to encrypted IndexedDB for offline/biometric re-auth
        secureSession
          .save({
            refreshToken,
            expiresAt: refreshExp,
            userId: user.id,
            username: user.username,
          })
          .catch((err) => {
            console.warn('Failed to persist secure session:', err);
          });
      },

      refreshSession: (
        accessToken,
        refreshToken,
        expiresInSeconds,
        refreshExpiresInSeconds,
      ) => {
        const realAccessExpMs = getJwtExpiryMs(accessToken);
        const sessionExp = realAccessExpMs ?? (Date.now() + expiresInSeconds * 1000);
        const realRefreshExpMs = getJwtExpiryMs(refreshToken);
        const refreshExp = realRefreshExpMs ?? (Date.now() + refreshExpiresInSeconds * 1000);

        set({
          accessToken,
          refreshToken,
          sessionExpiresAt: sessionExp,
          refreshExpiresAt: refreshExp,
          isAuthenticated: true,
        });

        const { user } = get();
        if (user) {
          secureSession
            .save({
              refreshToken,
              expiresAt: refreshExp,
              userId: user.id,
              username: user.username,
            })
            .catch((err) => {
              console.warn('Failed to update secure session:', err);
            });
        }
      },

      clearAuth: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          sessionExpiresAt: null,
          refreshExpiresAt: null,
          isAuthenticated: false,
        });
        secureSession.clear().catch(() => undefined);
      },

      updateUser: (userData) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userData } : null,
        })),

      setHasHydrated: (hasHydrated) => {
        set({ hasHydrated });
      },
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        sessionExpiresAt: state.sessionExpiresAt,
        refreshExpiresAt: state.refreshExpiresAt,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

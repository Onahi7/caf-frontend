import axios from 'axios';
import { createContext, useCallback, useContext, useEffect, type ReactNode } from 'react';
import { useAuthStore, type User } from '../stores/auth-store';
import apiClient from '../lib/api-client';

export interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  accessToken: string | null;
  hasHydrated: boolean;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const isNetworkError = (error: unknown) => axios.isAxiosError(error) && !error.response;

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const {
    isAuthenticated,
    user,
    clearAuth,
    setAuth,
    accessToken,
    refreshToken,
    sessionExpiresAt,
    hasHydrated,
  } = useAuthStore();

  const refreshAccessToken = useCallback(async () => {
    try {
      if (!refreshToken) {
        return;
      }

      const response = await apiClient.post('/auth/refresh', {
        refreshToken,
      });

      const {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: updatedUser,
        expiresIn,
        refreshExpiresIn,
      } = response.data;

      const nextUser = updatedUser ?? user;
      if (!nextUser || !newAccessToken) {
        throw new Error('Invalid refresh response');
      }

      setAuth(nextUser, newAccessToken, newRefreshToken || refreshToken, expiresIn, undefined, refreshExpiresIn);
    } catch (error) {
      if (isNetworkError(error)) {
        console.warn('Token refresh postponed because the network is unavailable.');
        return;
      }
      // Don't logout on refresh failure — stay logged in and retry later
    }
  }, [refreshToken, setAuth, user]);

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuth();
    }
  };

  // Proactive refresh: fire 5 minutes before access token expires
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !accessToken || !sessionExpiresAt) {
      return;
    }

    const refreshBeforeExpiryMs = 5 * 60 * 1000;
    const timeoutMs = Math.max(sessionExpiresAt - Date.now() - refreshBeforeExpiryMs, 0);

    const expiryTimeout = window.setTimeout(() => {
      void refreshAccessToken();
    }, timeoutMs);

    return () => window.clearTimeout(expiryTimeout);
  }, [accessToken, hasHydrated, isAuthenticated, refreshAccessToken, sessionExpiresAt]);

  // Tab focus & visibility wake-up refresh:
  // When an admin switches tabs or wakes their computer, refresh immediately if expiring soon
  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !refreshToken) {
      return;
    }

    const checkAndRefreshIfNeeded = () => {
      if (document.visibilityState === 'visible') {
        const currentSessionExp = useAuthStore.getState().sessionExpiresAt;
        if (!currentSessionExp || currentSessionExp - Date.now() < 5 * 60 * 1000) {
          void refreshAccessToken();
        }
      }
    };

    document.addEventListener('visibilitychange', checkAndRefreshIfNeeded);
    window.addEventListener('focus', checkAndRefreshIfNeeded);

    return () => {
      document.removeEventListener('visibilitychange', checkAndRefreshIfNeeded);
      window.removeEventListener('focus', checkAndRefreshIfNeeded);
    };
  }, [hasHydrated, isAuthenticated, refreshToken, refreshAccessToken]);

  // Validate token on mount — refresh if needed, never force logout
  useEffect(() => {
    const validateToken = async () => {
      if (!hasHydrated) {
        return;
      }

      if (!accessToken && isAuthenticated && refreshToken) {
        await refreshAccessToken();
        return;
      }

      if (accessToken && isAuthenticated) {
        try {
          await apiClient.get('/auth/me');
        } catch (error) {
          if (isNetworkError(error)) {
            return;
          }
          // If /auth/me fails, try refreshing — never force logout
          if (refreshToken) {
            await refreshAccessToken();
          }
        }
      }
    };

    void validateToken();
  }, [accessToken, hasHydrated, isAuthenticated, refreshAccessToken, refreshToken]);

  const value: AuthContextType = {
    isAuthenticated,
    user,
    accessToken,
    hasHydrated,
    logout,
    refreshAccessToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

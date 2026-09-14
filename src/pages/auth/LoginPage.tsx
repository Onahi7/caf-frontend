import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Fingerprint, KeyRound, ShieldCheck, ArrowRight } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { useAuthStore } from '../../stores/auth-store';
import { useBranchStore } from '../../stores/branch-store';
import { useBiometricAuth } from '../../hooks/useBiometricAuth';
import { useWebAuthn } from '../../hooks/useWebAuthn';
import { useToast } from '../../hooks/useToast';
import { webauthnApi } from '../../lib/webauthn-api';
import apiClient from '../../lib/api-client';
import { getErrorMessage } from '../../lib/error-utils';
import { getDefaultRouteForRole } from '../../lib/role-routes';

const getLoginErrorMessage = (error: unknown) => {
  const message = getErrorMessage(error, 'Invalid username or password');
  return message.toLowerCase().includes('invalid credentials')
    ? 'Invalid username or password. Use the username, not the email address.'
    : message;
};

export const LoginPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setAuth, isAuthenticated, user } = useAuthStore();
  const { setSelectedBranch } = useBranchStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{
    username?: string;
    password?: string;
    branch?: string;
  }>({});
  const [showBiometricPrompt, setShowBiometricPrompt] = useState(false);
  const [showRecoveryCode, setShowRecoveryCode] = useState(false);

  const biometric = useBiometricAuth((path: string) => {
    navigate(path, { replace: true });
  });
  const webauthn = useWebAuthn();
  const { showError } = useToast();

  // Check for cached credentials for offline login
  const [hasCachedCredentials, setHasCachedCredentials] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('auth-storage');
      if (raw) {
        const parsed = JSON.parse(raw);
        setHasCachedCredentials(!!parsed?.state?.user && !!parsed?.state?.accessToken);
      }
    } catch {
      setHasCachedCredentials(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      const locationState = location.state as { from?: { pathname?: string } } | null;
      const defaultPath = getDefaultRouteForRole(user.role);
      const from = locationState?.from?.pathname || defaultPath;
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, user, navigate, location]);

  const validateForm = (): boolean => {
    const errors: { username?: string; password?: string } = {};

    if (!username.trim()) {
      errors.username = 'Username is required';
    }

    if (!password) {
      errors.password = 'Password is required';
    } else if (password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/auth/login', {
        username: username.trim(),
        password,
      });
      return response.data;
    },
    onSuccess: async (data) => {
      const { user, accessToken, refreshToken, expiresIn, refreshExpiresIn } = data;

      setAuth(user, accessToken, refreshToken, expiresIn, undefined, refreshExpiresIn);

      if (user.branchId) {
        try {
          const branchResponse = await apiClient.get(`/branches/${user.branchId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          setSelectedBranch(branchResponse.data?.data ?? branchResponse.data);
        } catch (branchError) {
          setFieldErrors((prev) => ({
            ...prev,
            branch:
              'Login worked, but your assigned branch could not be loaded. Please refresh or contact an administrator.',
          }));
          return;
        }
      }

      navigate(getDefaultRouteForRole(user.role));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    loginMutation.mutate();
  };

  return (
    <div className="min-h-screen relative flex items-center justify-center bg-slate-950 p-4 pt-safe-top overflow-hidden selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-md w-full p-8 sm:p-10 bg-slate-900/85 border border-white/[0.08] backdrop-blur-2xl rounded-3xl shadow-2xl shadow-black/80">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow-lg shadow-emerald-500/25 ring-4 ring-emerald-500/10 mb-4">
            <ShieldCheck className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white text-center">
            CAREFARM <span className="text-emerald-400 font-light">POS</span>
          </h1>
          <p className="text-sm text-slate-400 text-center mt-1">
            Clinical Commerce & Pharmacy Management
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            label="Username"
            type="text"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setFieldErrors((prev) => ({ ...prev, username: undefined }));
            }}
            error={fieldErrors.username}
            placeholder="Enter your username"
            required
            disabled={loginMutation.isPending}
            autoComplete="username"
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            error={fieldErrors.password}
            placeholder="Enter your password"
            required
            disabled={loginMutation.isPending}
            autoComplete="current-password"
          />

          {loginMutation.isError && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-center">
              <p className="text-xs sm:text-sm text-rose-400 font-medium">
                {getLoginErrorMessage(loginMutation.error)}
              </p>
            </div>
          )}

          {fieldErrors.branch && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-center">
              <p className="text-xs sm:text-sm text-amber-300 font-medium">{fieldErrors.branch}</p>
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full mt-2"
            isLoading={loginMutation.isPending}
            disabled={loginMutation.isPending}
          >
            <span>Sign In to System</span>
            <ArrowRight className="w-4 h-4 ml-1.5 opacity-80" />
          </Button>
        </form>

        {/* Biometric / Passkey Login */}
        {(webauthn.isSupported || webauthn.isPlatformAuthenticatorAvailable || biometric.isAvailable || hasCachedCredentials) && (
          <div className="mt-6">
            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/[0.08]" />
              </div>
              <div className="relative flex justify-center text-xs uppercase tracking-wider">
                <span className="px-3 bg-slate-900 text-slate-400 font-medium">Or quick sign in</span>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                if (hasCachedCredentials && !navigator.onLine) {
                  // Offline login with cached credentials
                  try {
                    const raw = localStorage.getItem('auth-storage');
                    if (raw) {
                      const parsed = JSON.parse(raw);
                      if (parsed?.state?.user && parsed?.state?.accessToken) {
                        setAuth(
                          parsed.state.user,
                          parsed.state.accessToken,
                          parsed.state.refreshToken,
                          undefined,
                          parsed.state.sessionExpiresAt,
                        );
                        navigate(getDefaultRouteForRole(parsed.state.user.role), { replace: true });
                      }
                    }
                  } catch {
                    // Cached credentials invalid, require online login
                  }
                } else if (webauthn.isSupported) {
                  await webauthn.login(username.trim() || undefined);
                } else if (biometric.isAvailable) {
                  await biometric.loginWithBiometric();
                }
              }}
              disabled={webauthn.isLoading || biometric.isLoading}
              className="group relative w-full py-3.5 px-4 bg-gradient-to-r from-emerald-950/20 via-slate-800 to-emerald-950/20 hover:from-emerald-900/30 hover:to-emerald-900/30 border border-emerald-500/30 hover:border-emerald-500/50 rounded-2xl text-white font-medium flex items-center justify-center gap-3 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-emerald-950/20"
            >
              {(webauthn.isLoading || biometric.isLoading) ? (
                <div className="w-5 h-5 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin" />
              ) : (
                <span className="relative flex h-5 w-5 items-center justify-center">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20" />
                  <Fingerprint className="relative w-5 h-5 text-emerald-400 transition-transform group-hover:scale-110" />
                </span>
              )}
              <span className="text-sm font-semibold tracking-tight text-slate-100">
                {!navigator.onLine && hasCachedCredentials
                  ? 'Sign In Offline'
                  : webauthn.isSupported
                    ? 'Sign In with Passkey'
                    : 'Sign In with Fingerprint'}
              </span>
            </button>

            {(webauthn.error || biometric.error) && (
              <p className="mt-2.5 text-xs text-rose-400 text-center font-medium">
                {webauthn.error || biometric.error}
              </p>
            )}
          </div>
        )}

        <div className="mt-5 text-center">
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-emerald-400 transition-colors inline-flex items-center gap-1.5 font-medium"
            onClick={() => setShowRecoveryCode((s) => !s)}
          >
            <KeyRound className="w-3.5 h-3.5 opacity-70" />
            <span>{showRecoveryCode ? 'Use password instead' : 'Lost device? Use recovery code'}</span>
          </button>
        </div>

        {showRecoveryCode && (
          <RecoveryCodeForm
            initialUsername={username}
            onSuccess={(user, accessToken, refreshToken, expiresIn, refreshExpiresIn) => {
              setAuth(user, accessToken, refreshToken, expiresIn, undefined, refreshExpiresIn);
              if (user.branchId) {
                apiClient
                  .get(`/branches/${user.branchId}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                  })
                  .then((br) => {
                    setSelectedBranch(br.data?.data ?? br.data);
                  })
                  .catch(() => undefined);
              }
              showError && showError('Signed in with recovery code. Register a new passkey to restore biometric login.');
              navigate(getDefaultRouteForRole(user.role), { replace: true });
            }}
          />
        )}

        <div className="mt-6 pt-4 border-t border-white/[0.06] text-center">
          <p className="text-xs text-slate-400">
            CareFarm Healthcare Systems &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
};

interface RecoveryCodeFormProps {
  initialUsername: string;
  onSuccess: (
    user: { id: string; username: string; email: string; firstName: string; lastName: string; role: 'super_admin' | 'branch_manager' | 'cashier' | 'auditor' | 'marketer' | 'finance_manager'; branchId?: string },
    accessToken: string,
    refreshToken: string,
    expiresIn: number,
    refreshExpiresIn: number,
  ) => void;
}

const RecoveryCodeForm = ({ initialUsername, onSuccess }: RecoveryCodeFormProps) => {
  const [username, setUsername] = useState(initialUsername);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const data = await webauthnApi.loginWithRecoveryCode(username.trim(), code.trim());
      return data as {
        user: { id: string; username: string; email: string; firstName: string; lastName: string; role: 'super_admin' | 'branch_manager' | 'cashier' | 'auditor' | 'marketer' | 'finance_manager'; branchId?: string };
        accessToken: string;
        refreshToken: string;
        expiresIn: number;
        refreshExpiresIn: number;
      };
    },
    onSuccess: (data) => {
      onSuccess(
        data.user,
        data.accessToken,
        data.refreshToken,
        data.expiresIn,
        data.refreshExpiresIn,
      );
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Invalid code';
      setError(msg.toLowerCase().includes('invalid') ? msg : 'Invalid recovery code');
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        mutation.mutate();
      }}
      className="mt-4 space-y-3.5 rounded-2xl border border-white/[0.08] bg-slate-950/60 p-4 text-left backdrop-blur-md shadow-inner"
    >
      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
        <KeyRound className="w-3.5 h-3.5 shrink-0" />
        <span>Single-use emergency recovery code</span>
      </div>
      <Input
        label="Username"
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        autoComplete="username"
        required
      />
      <Input
        label="Recovery code"
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="K7D9-PXQR-VBNM"
        autoComplete="one-time-code"
        required
      />
      {error && <p className="text-xs text-rose-400 font-medium">{error}</p>}
      <Button
        type="submit"
        variant="secondary"
        className="w-full mt-1"
        isLoading={mutation.isPending}
        disabled={mutation.isPending || !username || !code}
      >
        Sign In with Recovery Code
      </Button>
    </form>
  );
};

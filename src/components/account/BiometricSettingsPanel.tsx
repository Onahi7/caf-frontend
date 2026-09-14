import { Fingerprint, Smartphone } from 'lucide-react';
import { Button } from '../ui/Button';
import { useBiometricAuth } from '../../hooks/useBiometricAuth';
import { useToast } from '../../hooks/useToast';
import { useAuthStore } from '../../stores/auth-store';

export const BiometricSettingsPanel = () => {
  const biometric = useBiometricAuth();
  const { showSuccess, showError } = useToast();
  const { user, accessToken } = useAuthStore();

  const handleRegister = async () => {
    if (!user?.username || !accessToken) {
      showError('Sign in again before registering fingerprint');
      return;
    }

    const registered = await biometric.promptToEnable(user.username, accessToken);
    if (registered) {
      showSuccess('Fingerprint registered successfully');
    } else {
      showError('Fingerprint registration cancelled');
    }
  };

  const handleRemove = async () => {
    await biometric.disable();
    showSuccess('Fingerprint removed from this device');
  };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-slate-900/70 p-6 backdrop-blur-md space-y-4 shadow-xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
            <Fingerprint className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white">Fingerprint Biometric Sign In</h3>
              {biometric.isEnabled && (
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                  Enrolled
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
              {biometric.isAvailable
                ? biometric.isEnabled
                  ? 'Fingerprint is active on this device. You can use it to sign in quickly without entering your password.'
                  : 'Register this mobile device so you can sign in with one touch.'
                : 'Fingerprint sign-in is enabled when using the CareFarm native mobile app on compatible biometric hardware.'}
            </p>
          </div>
        </div>

        <div className="shrink-0">
          {biometric.isEnabled ? (
            <Button type="button" variant="secondary" onClick={handleRemove}>
              Remove Fingerprint
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!biometric.isAvailable || !accessToken || biometric.isLoading}
              onClick={handleRegister}
            >
              <Fingerprint className="w-4 h-4 mr-1.5" />
              {biometric.isLoading ? 'Registering...' : 'Register Fingerprint'}
            </Button>
          )}
        </div>
      </div>

      {biometric.error && (
        <p className="text-xs text-rose-400 font-medium">{biometric.error}</p>
      )}

      {!biometric.isAvailable && (
        <div className="flex items-center gap-2 text-xs text-slate-400 pt-2 border-t border-white/[0.04]">
          <Smartphone className="w-4 h-4 shrink-0" />
          <span>Biometric sensor is detected in native mobile and tablet environments.</span>
        </div>
      )}
    </div>
  );
};

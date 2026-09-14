import { useState, useEffect, useCallback } from 'react';
import { Fingerprint, Clock, ShieldCheck } from 'lucide-react';
import { Button } from '../ui/Button';
import { useWebAuthn } from '../../hooks/useWebAuthn';
import { useToast } from '../../hooks/useToast';
import { webauthnApi } from '../../lib/webauthn-api';

const SNOOZE_KEY = 'passkey-setup-snooze-until';
const SNOOZE_DURATION_MS = 24 * 60 * 60 * 1000; // 1 day

/**
 * Banner that appears on every authenticated page until the user registers
 * a passkey. Dismissing it only snoozes for 24h - this is the "enterprise"
 * nudge that ensures every staff member has a passkey + can be recovered
 * via admin reset or recovery codes if their device is lost.
 */
export const PasskeySetupBanner = () => {
  const webauthn = useWebAuthn();
  const { showSuccess, showError } = useToast();
  const [dismissed, setDismissed] = useState(true); // start hidden until we know
  const [registering, setRegistering] = useState(false);

  const checkSnooze = useCallback(() => {
    try {
      const until = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
      return until > Date.now();
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (webauthn.hasRegisteredCredential) {
      setDismissed(true);
      return;
    }
    setDismissed(checkSnooze());
  }, [webauthn.hasRegisteredCredential, checkSnooze]);

  const handleRegister = async () => {
    setRegistering(true);
    try {
      const ok = await webauthn.register();
      if (ok) {
        showSuccess('Passkey registered successfully');
      } else if (webauthn.error) {
        showError(webauthn.error);
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleSnooze = () => {
    try {
      localStorage.setItem(
        SNOOZE_KEY,
        String(Date.now() + SNOOZE_DURATION_MS),
      );
    } catch {
      // ignore
    }
    setDismissed(true);
  };

  if (dismissed || !webauthn.isSupported || webauthn.hasRegisteredCredential) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/40 via-slate-900/95 to-slate-900/95 p-4 sm:p-5 shadow-xl shadow-emerald-950/20 backdrop-blur-xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30 shadow-md">
            <Fingerprint className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold tracking-tight text-white">
                Register a passkey for instant sign-in
              </p>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300 border border-emerald-500/20">
                <ShieldCheck className="w-3 h-3" /> Recommended
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              Use your fingerprint, face, or device screen lock to sign in next time without typing passwords.
              Passkeys are phishing-resistant and secured by hardware cryptography.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap shrink-0">
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleRegister}
            disabled={registering || webauthn.isLoading}
            className="w-full sm:w-auto"
          >
            <Fingerprint className="w-4 h-4 mr-1.5" />
            <span>{registering || webauthn.isLoading ? 'Registering...' : 'Register Passkey'}</span>
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleSnooze}
            className="w-full sm:w-auto"
          >
            <Clock className="w-3.5 h-3.5 mr-1.5 opacity-70" />
            <span>Remind tomorrow</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

// Avoid an unused warning if webauthnApi isn't directly referenced
void webauthnApi;

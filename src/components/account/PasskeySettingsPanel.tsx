import { useState, useEffect, useCallback } from 'react';
import { Key, ShieldCheck, Trash2, Plus, ShieldAlert } from 'lucide-react';
import { Button } from '../ui/Button';
import { useWebAuthn } from '../../hooks/useWebAuthn';
import { useToast } from '../../hooks/useToast';
import { webauthnApi, type CredentialSummary } from '../../lib/webauthn-api';

const TRANSPORT_LABELS: Record<string, string> = {
  usb: 'USB Security Key',
  nfc: 'NFC',
  ble: 'Bluetooth',
  internal: 'Built-in Biometrics',
  hybrid: 'Phone / Tablet',
  smart_card: 'Smart Card',
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'never';
  return new Date(iso).toLocaleString();
}

function transportLabel(t: string): string {
  return TRANSPORT_LABELS[t] ?? t;
}

export const PasskeySettingsPanel = () => {
  const webauthn = useWebAuthn();
  const { showSuccess, showError } = useToast();
  const [credentials, setCredentials] = useState<CredentialSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await webauthnApi.listCredentials();
      setCredentials(list.filter((c) => !c.revoked));
    } catch {
      setCredentials([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (webauthn.isSupported) {
      refresh();
    }
  }, [webauthn.isSupported, refresh]);

  const handleRegister = async () => {
    const ok = await webauthn.register();
    if (ok) {
      showSuccess('Passkey registered successfully');
      refresh();
    } else if (webauthn.error) {
      showError(webauthn.error);
    }
  };

  const handleRevoke = async (id: string) => {
    setPendingRevoke(id);
    try {
      await webauthnApi.revokeCredential(id);
      showSuccess('Passkey removed');
      refresh();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to remove passkey');
    } finally {
      setPendingRevoke(null);
    }
  };

  if (!webauthn.isSupported) {
    return (
      <div className="rounded-2xl border border-white/[0.08] bg-slate-900/70 p-6 backdrop-blur-md space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <h3 className="text-base font-semibold text-white">Passkey Authentication Not Supported</h3>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
          This browser environment does not support the WebAuthn standard. Use Chrome, Edge, Safari 16+, or Firefox 122+ to enable biometric and hardware security key sign-in.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-slate-900/70 p-6 backdrop-blur-md space-y-5 shadow-xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30 shadow-md">
            <Key className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold text-white">Registered Passkeys</h3>
              <span className="inline-flex items-center rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-300 border border-white/[0.08]">
                {credentials.length} active
              </span>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-xl">
              {webauthn.isPlatformAuthenticatorAvailable
                ? 'Register passkeys using device biometrics (fingerprint, Face ID, Windows Hello) or FIDO2 hardware keys for passwordless authentication.'
                : 'Use external FIDO2/U2F security keys (such as YubiKeys) for secure, phishing-resistant logins.'}
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleRegister}
          disabled={webauthn.isLoading}
          className="shrink-0"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          <span>{webauthn.isLoading ? 'Registering...' : 'Add Passkey'}</span>
        </Button>
      </div>

      {loading ? (
        <div className="py-6 text-center text-sm text-slate-400">Loading passkeys...</div>
      ) : credentials.length === 0 ? (
        <div className="py-8 text-center rounded-xl border border-dashed border-white/[0.08] bg-slate-950/40">
          <ShieldCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-slate-300">No passkeys registered yet</p>
          <p className="text-xs text-slate-500 mt-1">Add your first passkey to enable instant passwordless sign-in.</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06] bg-slate-950/40 overflow-hidden">
          {credentials.map((c) => (
            <div
              key={c.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-white/[0.02] transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-white">{c.friendlyName}</p>
                  {c.backupEligible && (
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {c.backupState ? 'Cloud Synced' : 'Device Bound'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {c.transports?.map(transportLabel).join(' • ') || 'Standard Authenticator'}
                  {' • Last used '}
                  {formatDate(c.lastUsedAt)}
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => handleRevoke(c.id)}
                disabled={pendingRevoke === c.id}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 hover:border-rose-500/30"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                <span>{pendingRevoke === c.id ? 'Removing...' : 'Remove'}</span>
              </Button>
            </div>
          ))}
        </div>
      )}

      {webauthn.error && <p className="text-xs text-rose-400 font-medium">{webauthn.error}</p>}
    </div>
  );
};

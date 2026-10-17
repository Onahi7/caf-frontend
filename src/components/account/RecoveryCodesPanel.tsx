import { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import { useToast } from '../../hooks/useToast';
import { webauthnApi } from '../../lib/webauthn-api';

export const RecoveryCodesPanel = () => {
  const { showSuccess, showError } = useToast();
  const [unused, setUnused] = useState<number | null>(null);
  const [generated, setGenerated] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const { unused: n } = await webauthnApi.recoveryCodeCount();
      setUnused(n);
    } catch {
      setUnused(null);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { codes } = await webauthnApi.generateRecoveryCodes();
      setGenerated(codes);
      setConfirmRegen(false);
      setUnused(codes.length);
      showSuccess('New recovery codes generated. Save them somewhere safe.');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to generate codes');
    } finally {
      setLoading(false);
    }
  };

  const downloadCodes = () => {
    if (!generated) return;
    const text = `CareFAM POS - Recovery Codes
Generated: ${new Date().toISOString()}
User: ${window.location.pathname}

Each code can be used once to sign in if you lose access to your passkeys.
Treat them like passwords.

${generated.map((c, i) => `${i + 1}. ${c}`).join('\n')}
`;
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caf-recovery-codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (generated) {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-5 space-y-4">
        <div>
          <h3 className="text-base font-semibold text-amber-300">
            Save your recovery codes
          </h3>
          <p className="mt-1 text-sm text-amber-100/80 leading-6">
            These ten codes can each be used once to sign in if you lose access
            to all your passkeys. They will <strong>not be shown again</strong>.
            Store them in a password manager or print this page.
          </p>
        </div>

        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono text-sm">
          {generated.map((c, i) => (
            <li
              key={c}
              className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-amber-100"
            >
              <span className="text-amber-300/60 mr-2">{i + 1}.</span>
              {c}
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={downloadCodes}>
            Download as .txt
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(generated.join('\n'));
                showSuccess('Codes copied to clipboard');
              } catch {
                showError('Could not copy to clipboard');
              }
            }}
          >
            Copy
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setGenerated(null);
            }}
          >
            I\u2019ve saved them
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white">Recovery codes</h3>
        <p className="mt-1 text-sm text-slate-400 leading-6">
          One-time codes you can use to sign in if you lose access to all your
          passkeys (lost device, factory reset, etc.). Treat them like passwords.
        </p>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span
          className={
            unused === 0
              ? 'text-red-300 font-semibold'
              : unused !== null && unused <= 3
                ? 'text-amber-300 font-semibold'
                : 'text-slate-300'
          }
        >
          {unused === null ? 'Loading\u2026' : `${unused} unused codes remaining`}
        </span>
      </div>

      {confirmRegen ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3 space-y-2">
          <p className="text-sm text-red-200">
            Generating new codes will <strong>invalidate all existing codes</strong>.
            Are you sure?
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleGenerate}
              disabled={loading}
            >
              {loading ? 'Generating\u2026' : 'Yes, regenerate'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmRegen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={() => setConfirmRegen(true)}
            disabled={loading}
          >
            {unused === 0 ? 'Generate Recovery Codes' : 'Regenerate Codes'}
          </Button>
        </div>
      )}
    </div>
  );
};

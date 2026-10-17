import { AdminLayout } from '../../components/AdminLayout';
import { MarketerLayout } from '../../components/MarketerLayout';
import {
  BiometricSettingsPanel,
  PasskeySettingsPanel,
  RecoveryCodesPanel,
} from '../../components/account';
import { useAuthStore } from '../../stores/auth-store';

export const AccountSecurityPage = () => {
  const user = useAuthStore((state) => state.user);

  const content = (
    <div className="max-w-3xl space-y-5">
      <div className="rounded-2xl border border-white/10 bg-slate-900 p-5">
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-500">Account</p>
        <h1 className="mt-2 text-2xl font-bold text-white">Security Settings</h1>
        <p className="mt-2 text-sm text-slate-400">
          Manage sign-in options for this device. These settings apply only to the current user and device.
        </p>
      </div>

      <PasskeySettingsPanel />
      <BiometricSettingsPanel />
      <RecoveryCodesPanel />
    </div>
  );

  if (user?.role === 'marketer') {
    return <MarketerLayout title="Security Settings">{content}</MarketerLayout>;
  }

  return <AdminLayout title="Security Settings">{content}</AdminLayout>;
};

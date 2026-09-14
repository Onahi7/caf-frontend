import { useState } from 'react';
import { Fingerprint, LogOut, Key, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../stores/auth-store';
import { useToast } from '../../hooks/useToast';
import { useBiometricAuth } from '../../hooks/useBiometricAuth';
import apiClient from '../../lib/api-client';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { ConfirmDialog } from '../ui/ConfirmDialog';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal = ({ isOpen, onClose }: UserProfileModalProps) => {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const { showSuccess, showError } = useToast();
  const biometric = useBiometricAuth();

  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const resetPasswordFields = () => {
    setIsChangingPassword(false);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleClose = () => {
    resetPasswordFields();
    onClose();
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showError('Please fill in all fields');
      return;
    }
    if (newPassword !== confirmPassword) {
      showError('New passwords do not match');
      return;
    }
    if (newPassword.length < 8) {
      showError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      showSuccess('Password changed successfully');
      resetPasswordFields();
    } catch (error: unknown) {
      const errorMessage =
        error && typeof error === 'object' && 'response' in error
          ? (error as { response?: { data?: { message?: string } } }).response?.data?.message
          : 'Failed to change password';
      showError(errorMessage || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
      showError('Logout failed. Please try again.');
    } finally {
      useAuthStore.getState().clearAuth();
      window.location.href = '/login';
    }
  };

  if (!user) return null;

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleClose}
        title={isChangingPassword ? 'Change Password' : 'Staff Profile'}
        size="md"
      >
        {!isChangingPassword ? (
          <div className="space-y-6">
            {/* User Avatar & Header */}
            <div className="flex items-center gap-4 rounded-2xl border border-white/[0.08] bg-slate-950/40 p-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-xl font-bold text-white shadow-lg shadow-emerald-500/25 ring-2 ring-emerald-500/20">
                {user.firstName?.[0]}
                {user.lastName?.[0]}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-bold text-white tracking-tight truncate">
                  {user.firstName} {user.lastName}
                </h3>
                <p className="text-xs text-slate-400 truncate">{user.email}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold capitalize text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="w-3 h-3 mr-1" />
                    {user.role.replace('_', ' ')}
                  </span>
                </div>
              </div>
            </div>

            {/* Account Details */}
            <div className="divide-y divide-white/[0.06] rounded-2xl border border-white/[0.08] bg-slate-950/30 px-4 py-1">
              <div className="flex items-center justify-between py-3 text-sm">
                <span className="text-slate-400">Username</span>
                <span className="font-medium text-white">{user.username || user.email}</span>
              </div>
              <div className="flex items-center justify-between py-3 text-sm">
                <span className="text-slate-400">System Role</span>
                <span className="font-medium capitalize text-slate-200">
                  {user.role.replace('_', ' ')}
                </span>
              </div>
              {user.branchId && (
                <div className="flex items-center justify-between py-3 text-sm">
                  <span className="text-slate-400">Assigned Branch</span>
                  <span className="font-mono text-xs text-slate-300">
                    {user.branchId.slice(0, 12)}...
                  </span>
                </div>
              )}
            </div>

            {/* Fingerprint Sign-in Card */}
            <div className="rounded-2xl border border-white/[0.08] bg-slate-950/40 p-4 space-y-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
                    <Fingerprint className="h-5 w-5" />
                  </div>
                  <div className="space-y-0.5">
                    <h4 className="text-sm font-semibold text-white">Biometric Quick Login</h4>
                    <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                      {biometric.isAvailable
                        ? biometric.isEnabled
                          ? 'Fingerprint is active on this device.'
                          : 'Register device fingerprint for quick access.'
                        : 'Biometric hardware is supported in native tablet/mobile apps.'}
                    </p>
                  </div>
                </div>

                {biometric.isEnabled ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      await biometric.disable();
                      showSuccess('Fingerprint removed');
                    }}
                    className="shrink-0 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30"
                  >
                    Remove
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={async () => {
                      if (!user.username || !accessToken) {
                        showError('Sign in again before registering fingerprint');
                        return;
                      }

                      const registered = await biometric.promptToEnable(user.username, accessToken);
                      if (registered) {
                        showSuccess('Fingerprint registered successfully');
                      } else {
                        showError('Fingerprint registration cancelled');
                      }
                    }}
                    disabled={!biometric.isAvailable || !accessToken || biometric.isLoading}
                    className="shrink-0"
                  >
                    {biometric.isLoading ? 'Registering...' : 'Register'}
                  </Button>
                )}
              </div>

              {biometric.error && (
                <p className="text-xs text-rose-400 font-medium">{biometric.error}</p>
              )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                onClick={() => setIsChangingPassword(true)}
                className="w-full"
              >
                <Key className="w-4 h-4 mr-1.5 opacity-70" />
                <span>Change Password</span>
              </Button>
              <Button
                type="button"
                variant="danger"
                size="lg"
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full"
              >
                <LogOut className="w-4 h-4 mr-1.5" />
                <span>Logout</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              autoComplete="current-password"
            />

            <Input
              label="New Password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password (min 8 characters)"
              autoComplete="new-password"
            />

            <Input
              label="Confirm New Password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={resetPasswordFields}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleChangePassword}
                disabled={loading}
                isLoading={loading}
                className="flex-1"
              >
                Save Password
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Logout Confirmation"
        message="Are you sure you want to logout? You will need to sign in again to access the POS and administration system."
        confirmLabel="Logout"
        variant="danger"
      />
    </>
  );
};

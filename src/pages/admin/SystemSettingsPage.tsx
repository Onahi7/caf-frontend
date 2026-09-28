import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import apiClient from '../../lib/api-client';
import { unwrapResponse } from '../../lib/unwrap-response';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../lib/query-keys';
import { BiometricSettingsPanel } from '../../components/account';

interface SystemSettings {
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  lowStockThreshold: number;
  receiptFooter: string;
  enableLoyalty: boolean;
  loyaltyPointsRate: number;
  enableEmailNotifications: boolean;
  enableSMSNotifications: boolean;
}

export const SystemSettingsPage = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'general' | 'loyalty' | 'notifications' | 'security'>('general');
  const { showSuccess, showError } = useToast();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<SystemSettings>();

  // Fetch system settings
  const { data: settings, isLoading, error } = useQuery({
    queryKey: queryKeys.systemSettings.detail(),
    queryFn: async () => {
      const response = await apiClient.get('/settings');
      return unwrapResponse(response.data, {} as SystemSettings);
    },
  });

  // Reset form when settings data is loaded
  useEffect(() => {
    if (settings) {
      reset(settings);
    }
  }, [settings, reset]);

  // Update settings mutation
  const updateMutation = useMutation({
    mutationFn: async (data: SystemSettings) => {
      return apiClient.patch('/settings', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.systemSettings.all(), exact: false });
      showSuccess('Settings saved');
    },
    onError: (err: any) => showError(err?.response?.data?.message ?? 'Failed to save settings'),
  });

  const onSubmit = (data: SystemSettings) => {
    updateMutation.mutate({
      ...data,
      lowStockThreshold: Number(data.lowStockThreshold),
      loyaltyPointsRate: Number(data.loyaltyPointsRate || 0),
    });
  };

  if (isLoading) return <AdminLayout title="System Settings"><Loading /></AdminLayout>;
  if (error) return <AdminLayout title="System Settings"><Error message="Failed to load system settings" /></AdminLayout>;

  return (
    <AdminLayout title="System Settings">
      <div className="space-y-6 max-w-5xl mx-auto py-4 px-2">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">System Settings</h1>
            <p className="text-sm text-slate-400 mt-1">Configure global store preferences, notifications, and security</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-slate-800">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('general')}
              className={`${
                activeTab === 'general'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              General
            </button>
            <button
              onClick={() => setActiveTab('loyalty')}
              className={`${
                activeTab === 'loyalty'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Loyalty Program
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`${
                activeTab === 'notifications'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Notifications
            </button>
            <button
              onClick={() => setActiveTab('security')}
              className={`${
                activeTab === 'security'
                  ? 'border-emerald-500 text-emerald-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              } whitespace-nowrap py-3 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              Security
            </button>
          </nav>
        </div>

        {/* Settings Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-6">
          {/* General Settings */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">General Settings</h2>
              
              <Input
                label="Company Name"
                {...register('companyName', { required: 'Company name is required' })}
                error={errors.companyName?.message}
              />

              <Input
                label="Company Address"
                {...register('companyAddress', { required: 'Address is required' })}
                error={errors.companyAddress?.message}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Phone Number"
                  {...register('companyPhone', { required: 'Phone is required' })}
                  error={errors.companyPhone?.message}
                />
                <Input
                  label="Email"
                  type="email"
                  {...register('companyEmail', { required: 'Email is required' })}
                  error={errors.companyEmail?.message}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select
                  label="Currency"
                  {...register('currency', { required: 'Currency is required' })}
                  error={errors.currency?.message}
                >
                  <option value="USD" className="bg-slate-900 text-white">USD - US Dollar</option>
                  <option value="EUR" className="bg-slate-900 text-white">EUR - Euro</option>
                  <option value="GBP" className="bg-slate-900 text-white">GBP - British Pound</option>
                  <option value="SLE" className="bg-slate-900 text-white">SLE - Sierra Leonean Leone</option>
                  <option value="GHS" className="bg-slate-900 text-white">GHS - Ghanaian Cedi</option>
                  <option value="KES" className="bg-slate-900 text-white">KES - Kenyan Shilling</option>
                </Select>

                <Select
                  label="Timezone"
                  {...register('timezone', { required: 'Timezone is required' })}
                  error={errors.timezone?.message}
                >
                  <option value="UTC" className="bg-slate-900 text-white">UTC</option>
                  <option value="America/New_York" className="bg-slate-900 text-white">Eastern Time</option>
                  <option value="America/Chicago" className="bg-slate-900 text-white">Central Time</option>
                  <option value="America/Denver" className="bg-slate-900 text-white">Mountain Time</option>
                  <option value="America/Los_Angeles" className="bg-slate-900 text-white">Pacific Time</option>
                  <option value="Europe/London" className="bg-slate-900 text-white">London</option>
                  <option value="Africa/Freetown" className="bg-slate-900 text-white">Freetown</option>
                  <option value="Africa/Lagos" className="bg-slate-900 text-white">Lagos</option>
                  <option value="Africa/Nairobi" className="bg-slate-900 text-white">Nairobi</option>
                </Select>

                <Select
                  label="Date Format"
                  {...register('dateFormat', { required: 'Date format is required' })}
                  error={errors.dateFormat?.message}
                >
                  <option value="MM/DD/YYYY" className="bg-slate-900 text-white">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY" className="bg-slate-900 text-white">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD" className="bg-slate-900 text-white">YYYY-MM-DD</option>
                </Select>
              </div>

              <Input
                label="Low Stock Threshold"
                type="number"
                min="0"
                {...register('lowStockThreshold', {
                  valueAsNumber: true,
                  required: 'Threshold is required',
                  min: { value: 0, message: 'Must be 0 or greater' },
                })}
                error={errors.lowStockThreshold?.message}
              />

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Receipt Footer
                </label>
                <textarea
                  {...register('receiptFooter')}
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 text-white rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 placeholder-slate-500 resize-none"
                  placeholder="Thank you for your business!"
                />
              </div>
            </div>
          )}

          {/* Loyalty Settings */}
          {activeTab === 'loyalty' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Loyalty Program Settings</h2>
              
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="enableLoyalty"
                  {...register('enableLoyalty')}
                  className="h-4 w-4 text-emerald-500 focus:ring-emerald-500 border-slate-700 bg-slate-900 rounded"
                />
                <label htmlFor="enableLoyalty" className="ml-2 block text-sm text-slate-300">
                  Enable Loyalty Program
                </label>
              </div>

              <Input
                label="Points Rate (Points per currency unit spent)"
                type="number"
                step="0.01"
                min="0"
                {...register('loyaltyPointsRate', {
                  valueAsNumber: true,
                  min: { value: 0, message: 'Must be 0 or greater' },
                })}
                error={errors.loyaltyPointsRate?.message}
                placeholder="e.g., 1 point per $1 spent"
              />

              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <p className="text-sm text-blue-300">
                  <strong>Note:</strong> When enabled, customers will earn loyalty points on every purchase.
                  The points rate determines how many points they earn per currency unit spent.
                </p>
              </div>
            </div>
          )}

          {/* Notification Settings */}
          {activeTab === 'notifications' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Notification Settings</h2>
              
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enableEmailNotifications"
                    {...register('enableEmailNotifications')}
                    className="h-4 w-4 text-emerald-500 focus:ring-emerald-500 border-slate-700 bg-slate-900 rounded"
                  />
                  <label htmlFor="enableEmailNotifications" className="ml-2 block text-sm text-slate-300">
                    Enable Email Notifications
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enableSMSNotifications"
                    {...register('enableSMSNotifications')}
                    className="h-4 w-4 text-emerald-500 focus:ring-emerald-500 border-slate-700 bg-slate-900 rounded"
                  />
                  <label htmlFor="enableSMSNotifications" className="ml-2 block text-sm text-slate-300">
                    Enable SMS Notifications
                  </label>
                </div>
              </div>

              <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
                <p className="text-sm text-yellow-300">
                  <strong>Note:</strong> Notifications will be sent for important events like low stock alerts,
                  expiry reminders, and order confirmations.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white">Security</h2>
              <BiometricSettingsPanel />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => settings && reset(settings)}
            >
              Reset
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Settings'}
            </Button>
          </div>

          {updateMutation.isError && (
            <Error message="Failed to save settings. Please try again." />
          )}
        </form>
      </div>
    </AdminLayout>
  );
};

export default SystemSettingsPage;

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { queryKeys } from '../../lib/query-keys';
import { unwrapArray } from '../../lib/unwrap-response';
import { useConfirm } from '../../hooks/useConfirm';
import { useToast } from '../../hooks/useToast';
import { getErrorMessage } from '../../lib/error-utils';

interface PaymentMethod {
  _id: string;
  name: string;
  type: 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'other';
  isActive: boolean;
  processingFee?: number;
  accountDetails?: string;
  createdAt: string;
}

interface PaymentMethodFormData {
  name: string;
  type: 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'other';
  processingFee?: number;
  accountDetails?: string;
}

export const PaymentMethodsPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const queryClient = useQueryClient();
  const requestConfirmation = useConfirm();
  const { showSuccess, showError } = useToast();

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PaymentMethodFormData>();

  // Fetch payment methods
  const { data: methods, isLoading, error } = useQuery({
    queryKey: queryKeys.paymentMethods.list(),
    queryFn: async () => {
      const response = await apiClient.get('/settings/payment-methods');
      return unwrapArray<PaymentMethod>(response.data);
    },
  });

  // Create payment method mutation
  const createMutation = useMutation({
    mutationFn: async (data: PaymentMethodFormData) => {
      return apiClient.post('/settings/payment-methods', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods.all(), exact: false });
      setIsModalOpen(false);
      reset();
      showSuccess('Payment method created');
    },
    onError: (err: unknown) => showError('Could not create payment method', getErrorMessage(err, 'Please try again.')),
  });

  // Update payment method mutation
  const updateMutation = useMutation({
    mutationFn: async (data: PaymentMethodFormData) => {
      if (!editingMethod) return;
      return apiClient.patch(`/settings/payment-methods/${editingMethod._id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods.all(), exact: false });
      setIsModalOpen(false);
      setEditingMethod(null);
      reset();
      showSuccess('Payment method updated');
    },
    onError: (err: unknown) => showError('Could not update payment method', getErrorMessage(err, 'Please try again.')),
  });

  // Toggle payment method status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (methodId: string) => {
      return apiClient.patch(`/settings/payment-methods/${methodId}/toggle-status`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods.all(), exact: false });
      showSuccess('Payment method status updated');
    },
    onError: (err: unknown) => showError('Could not update status', getErrorMessage(err, 'Please try again.')),
  });

  // Delete payment method mutation
  const deleteMutation = useMutation({
    mutationFn: async (methodId: string) => {
      return apiClient.delete(`/settings/payment-methods/${methodId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.paymentMethods.all(), exact: false });
      showSuccess('Payment method deleted');
    },
    onError: (err: unknown) => showError('Could not delete payment method', getErrorMessage(err, 'Please try again.')),
  });

  const handleOpenModal = (method?: PaymentMethod) => {
    if (method) {
      setEditingMethod(method);
      reset({
        name: method.name,
        type: method.type,
        processingFee: method.processingFee,
        accountDetails: method.accountDetails,
      });
    } else {
      setEditingMethod(null);
      reset({
        name: '',
        type: 'cash',
        processingFee: 0,
        accountDetails: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingMethod(null);
    reset();
  };

  const onSubmit = (data: PaymentMethodFormData) => {
    if (editingMethod) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) return <AdminLayout><Loading /></AdminLayout>;
  if (error) return <AdminLayout><Error message="Failed to load payment methods" /></AdminLayout>;

  const columns = [
    { key: 'name', header: 'Method Name' },
    {
      key: 'type',
      header: 'Type',
      render: (method: PaymentMethod) => {
        const typeLabels = {
          cash: 'Cash',
          card: 'Card',
          mobile_money: 'Mobile Money',
          bank_transfer: 'Bank Transfer',
          other: 'Other',
        };
        const typeColors = {
          cash: 'bg-green-500/20 text-green-300',
          card: 'bg-blue-500/20 text-blue-300',
          mobile_money: 'bg-purple-500/20 text-purple-300',
          bank_transfer: 'bg-yellow-500/20 text-yellow-300',
          other: 'bg-white/10 text-white/60',
        };
        return (
          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${typeColors[method.type]}`}>
            {typeLabels[method.type]}
          </span>
        );
      },
    },
    {
      key: 'processingFee',
      header: 'Processing Fee',
      render: (method: PaymentMethod) => (
        method.processingFee ? `${method.processingFee}%` : 'N/A'
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (method: PaymentMethod) => (
        method.isActive ? (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
            Active
          </span>
        ) : (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-500/20 text-red-400 border border-red-500/30">
            Inactive
          </span>
        )
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (method: PaymentMethod) => (
        <div className="flex space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleOpenModal(method)}
          >
            Edit
          </Button>
          <Button
            variant={method.isActive ? 'danger' : 'primary'}
            size="sm"
            onClick={() => toggleStatusMutation.mutate(method._id)}
          >
            {method.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          {method.type !== 'cash' && (
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                const confirmed = await requestConfirmation({
                  title: 'Delete payment method?',
                  message: `"${method.name}" will be permanently removed from future payments.`,
                  confirmLabel: 'Delete method',
                  variant: 'danger',
                });
                if (confirmed) deleteMutation.mutate(method._id);
              }}
            >
              Delete
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Payment Methods">
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Payment Methods</h1>
            <p className="text-sm text-slate-400 mt-1">Configure accepted payment channels, card, cash, and digital wallets</p>
          </div>
          <Button onClick={() => handleOpenModal()} className="shadow-lg shadow-emerald-500/15">
            Add Payment Method
          </Button>
        </div>

        {/* Payment Methods Table */}
        <Table
          data={methods || []}
          columns={columns}
          emptyMessage="No payment methods configured"
        />

        {/* Payment Method Form Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={editingMethod ? 'Edit Payment Method' : 'Add Payment Method'}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Method Name"
              {...register('name', { required: 'Method name is required' })}
              error={errors.name?.message}
              placeholder="e.g., Visa/Mastercard, M-Pesa"
            />

            <Select
              label="Type"
              {...register('type', { required: 'Type is required' })}
              error={errors.type?.message}
            >
              <option value="cash">Cash</option>
              <option value="card">Card</option>
              <option value="mobile_money">Mobile Money</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="other">Other</option>
            </Select>

            <Input
              label="Processing Fee (%) - Optional"
              type="number"
              step="0.01"
              min="0"
              max="100"
              {...register('processingFee', {
                min: { value: 0, message: 'Must be 0 or greater' },
                max: { value: 100, message: 'Must be 100 or less' },
              })}
              error={errors.processingFee?.message}
            />

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Account Details (Optional)
              </label>
              <textarea
                {...register('accountDetails')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-700 rounded-md bg-primary-darker text-white shadow-sm focus:outline-none focus:ring-accent-green/50 focus:border-accent-green"
                placeholder="e.g., Account number, merchant ID, etc."
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <Button
                type="button"
                variant="secondary"
                onClick={handleCloseModal}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? 'Saving...'
                  : editingMethod
                  ? 'Update Method'
                  : 'Add Method'}
              </Button>
            </div>

            {(createMutation.isError || updateMutation.isError) && (
              <Error message="Failed to save payment method. Please try again." />
            )}
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
};

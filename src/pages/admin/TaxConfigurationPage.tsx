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

interface TaxConfig {
  _id: string;
  name: string;
  rate: number;
  type: 'percentage' | 'fixed';
  isActive: boolean;
  applicableCategories?: string[];
  createdAt: string;
}

interface TaxFormData {
  name: string;
  rate: number;
  type: 'percentage' | 'fixed';
  applicableCategories?: string;
}

export const TaxConfigurationPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTax, setEditingTax] = useState<TaxConfig | null>(null);
  const queryClient = useQueryClient();
  const requestConfirmation = useConfirm();
  const { showSuccess, showError } = useToast();

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<TaxFormData>();
  const taxType = watch('type');

  // Fetch tax configurations
  const { data: taxes, isLoading, error } = useQuery({
    queryKey: queryKeys.taxConfigs.list(),
    queryFn: async () => {
      const response = await apiClient.get('/settings/taxes');
      return unwrapArray<TaxConfig>(response.data);
    },
  });

  // Create tax mutation
  const createMutation = useMutation({
    mutationFn: async (data: TaxFormData) => {
      return apiClient.post('/settings/taxes', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taxConfigs.all(), exact: false });
      setIsModalOpen(false);
      reset();
      showSuccess('Tax configuration created');
    },
    onError: (err: unknown) => showError('Could not create tax', getErrorMessage(err, 'Please try again.')),
  });

  // Update tax mutation
  const updateMutation = useMutation({
    mutationFn: async (data: TaxFormData) => {
      if (!editingTax) return;
      return apiClient.patch(`/settings/taxes/${editingTax._id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taxConfigs.all(), exact: false });
      setIsModalOpen(false);
      setEditingTax(null);
      reset();
      showSuccess('Tax configuration updated');
    },
    onError: (err: unknown) => showError('Could not update tax', getErrorMessage(err, 'Please try again.')),
  });

  // Toggle tax status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (taxId: string) => {
      return apiClient.patch(`/settings/taxes/${taxId}/toggle-status`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taxConfigs.all(), exact: false });
      showSuccess('Tax status updated');
    },
    onError: (err: unknown) => showError('Could not update status', getErrorMessage(err, 'Please try again.')),
  });

  // Delete tax mutation
  const deleteMutation = useMutation({
    mutationFn: async (taxId: string) => {
      return apiClient.delete(`/settings/taxes/${taxId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.taxConfigs.all(), exact: false });
      showSuccess('Tax configuration deleted');
    },
    onError: (err: unknown) => showError('Could not delete tax', getErrorMessage(err, 'Please try again.')),
  });

  const handleOpenModal = (tax?: TaxConfig) => {
    if (tax) {
      setEditingTax(tax);
      reset({
        name: tax.name,
        rate: tax.rate,
        type: tax.type,
        applicableCategories: tax.applicableCategories?.join(', '),
      });
    } else {
      setEditingTax(null);
      reset({
        name: '',
        rate: 0,
        type: 'percentage',
        applicableCategories: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTax(null);
    reset();
  };

  const onSubmit = (data: TaxFormData) => {
    if (editingTax) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) return <AdminLayout><Loading /></AdminLayout>;
  if (error) return <AdminLayout><Error message="Failed to load tax configurations" /></AdminLayout>;

  const columns = [
    { key: 'name', header: 'Tax Name' },
    {
      key: 'rate',
      header: 'Rate',
      render: (tax: TaxConfig) => (
        tax.type === 'percentage' ? `${tax.rate}%` : `$${tax.rate}`
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (tax: TaxConfig) => (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300">
          {tax.type === 'percentage' ? 'Percentage' : 'Fixed Amount'}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (tax: TaxConfig) => (
        tax.isActive ? (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-500/20 text-green-300">
            Active
          </span>
        ) : (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-500/20 text-red-300">
            Inactive
          </span>
        )
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (tax: TaxConfig) => (
        <div className="flex space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleOpenModal(tax)}
          >
            Edit
          </Button>
          <Button
            variant={tax.isActive ? 'danger' : 'primary'}
            size="sm"
            onClick={() => toggleStatusMutation.mutate(tax._id)}
          >
            {tax.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              const confirmed = await requestConfirmation({
                title: 'Delete tax configuration?',
                message: `"${tax.name}" will be permanently removed. Existing records are not changed.`,
                confirmLabel: 'Delete tax',
                variant: 'danger',
              });
              if (confirmed) deleteMutation.mutate(tax._id);
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Tax Configuration">
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Tax Configuration</h1>
            <p className="text-sm text-slate-400 mt-1">Configure sales taxes, VAT, and fiscal rates</p>
          </div>
          <Button onClick={() => handleOpenModal()} className="shadow-lg shadow-emerald-500/15">
            Add Tax
          </Button>
        </div>

        {/* Tax Table */}
        <Table
          data={taxes || []}
          columns={columns}
          emptyMessage="No tax configurations found"
        />

        {/* Tax Form Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={editingTax ? 'Edit Tax' : 'Add Tax'}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Tax Name"
              {...register('name', { required: 'Tax name is required' })}
              error={errors.name?.message}
              placeholder="e.g., VAT, Sales Tax"
            />

            <Select
              label="Tax Type"
              {...register('type', { required: 'Type is required' })}
              error={errors.type?.message}
            >
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed Amount</option>
            </Select>

            <Input
              label={taxType === 'percentage' ? 'Tax Rate (%)' : 'Tax Amount'}
              type="number"
              step="0.01"
              min="0"
              {...register('rate', {
                required: 'Rate is required',
                min: { value: 0, message: 'Must be 0 or greater' },
              })}
              error={errors.rate?.message}
            />

            <Input
              label="Applicable Categories (Optional)"
              {...register('applicableCategories')}
              error={errors.applicableCategories?.message}
              placeholder="e.g., Medicine, Equipment (comma-separated)"
            />

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
                  : editingTax
                  ? 'Update Tax'
                  : 'Add Tax'}
              </Button>
            </div>

            {(createMutation.isError || updateMutation.isError) && (
              <Error message="Failed to save tax configuration. Please try again." />
            )}
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
};

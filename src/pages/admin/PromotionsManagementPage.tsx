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
import { useToast } from '../../hooks/useToast';
import { useCurrency } from '../../hooks/useCurrency';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { useSearchWithDebounce } from '../../hooks/useSearchWithDebounce';
import { unwrapArray } from '../../lib/unwrap-response';
import { useConfirm } from '../../hooks/useConfirm';

interface Promotion {
  _id: string;
  id?: string;
  name: string;
  description?: string;
  type: 'percentage' | 'fixed_amount' | 'buy_x_get_y';
  scope: 'entire_transaction' | 'specific_item' | 'category';
  value: number;
  applicableProducts?: string[];
  applicableCategories?: string[];
  minimumPurchase?: number;
  maximumDiscount?: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  usageLimit?: number;
  usageCount: number;
  createdAt: string;
}

interface PromotionFormData {
  name: string;
  description?: string;
  type: 'percentage' | 'fixed_amount' | 'buy_x_get_y';
  scope: 'entire_transaction' | 'specific_item' | 'category';
  value: number;
  minimumPurchase?: number;
  maximumDiscount?: number;
  startDate: string;
  endDate: string;
  usageLimit?: number;
}

export const PromotionsManagementPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);
  const {
    value: searchQuery,
    setValue: setSearchQuery,
    debouncedValue: debouncedSearchQuery,
  } = useSearchWithDebounce('');
  const queryClient = useQueryClient();
  const { format } = useCurrency();
  const { showSuccess, showError } = useToast();
  const requestConfirmation = useConfirm();

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<PromotionFormData>();

  const promotionType = watch('type');

  // Fetch promotions
  const { data: promotions, isLoading, error } = useQuery({
    queryKey: queryKeys.promotions.list({ search: debouncedSearchQuery }),
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl('/promotions', { search: debouncedSearchQuery }));
      return unwrapArray<Promotion>(response.data);
    },
  });

  // Create promotion mutation
  const createMutation = useMutation({
    mutationFn: async (data: PromotionFormData) => {
      const payload: Record<string, unknown> = {
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        type: data.type,
        scope: data.scope || 'entire_transaction',
        value: Number(data.value),
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
      };
      if (data.minimumPurchase !== undefined && data.minimumPurchase !== null && !isNaN(Number(data.minimumPurchase))) {
        payload.minimumPurchase = Number(data.minimumPurchase);
      }
      if (data.maximumDiscount !== undefined && data.maximumDiscount !== null && !isNaN(Number(data.maximumDiscount))) {
        payload.maximumDiscount = Number(data.maximumDiscount);
      }
      if (data.usageLimit !== undefined && data.usageLimit !== null && !isNaN(Number(data.usageLimit))) {
        payload.usageLimit = Number(data.usageLimit);
      }
      return apiClient.post('/promotions', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.promotions.all(), exact: false });
      setIsModalOpen(false);
      reset();
      showSuccess('Promotion created');
    },
    onError: (err: any) => showError(err?.response?.data?.message ?? 'Failed to create promotion'),
  });

  // Update promotion mutation
  const updateMutation = useMutation({
    mutationFn: async (data: PromotionFormData) => {
      const id = editingPromotion?._id || editingPromotion?.id;
      if (!id) return;
      const payload: Record<string, unknown> = {
        name: data.name.trim(),
        description: data.description?.trim() || undefined,
        type: data.type,
        scope: data.scope || 'entire_transaction',
        value: Number(data.value),
        startDate: new Date(data.startDate).toISOString(),
        endDate: new Date(data.endDate).toISOString(),
      };
      if (data.minimumPurchase !== undefined && data.minimumPurchase !== null && !isNaN(Number(data.minimumPurchase))) {
        payload.minimumPurchase = Number(data.minimumPurchase);
      }
      if (data.maximumDiscount !== undefined && data.maximumDiscount !== null && !isNaN(Number(data.maximumDiscount))) {
        payload.maximumDiscount = Number(data.maximumDiscount);
      }
      if (data.usageLimit !== undefined && data.usageLimit !== null && !isNaN(Number(data.usageLimit))) {
        payload.usageLimit = Number(data.usageLimit);
      }
      return apiClient.patch(`/promotions/${id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.promotions.all(), exact: false });
      setIsModalOpen(false);
      setEditingPromotion(null);
      reset();
      showSuccess('Promotion updated');
    },
    onError: (err: any) => showError(err?.response?.data?.message ?? 'Failed to update promotion'),
  });

  // Toggle promotion status mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async (promotion: Promotion) => {
      const id = promotion._id || promotion.id;
      return apiClient.patch(`/promotions/${id}/toggle-status`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.promotions.all(), exact: false });
      showSuccess('Promotion status updated');
    },
    onError: (err: any) => showError(err?.response?.data?.message ?? 'Failed to update status'),
  });

  // Delete promotion mutation
  const deleteMutation = useMutation({
    mutationFn: async (promotion: Promotion) => {
      const id = promotion._id || promotion.id;
      return apiClient.delete(`/promotions/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.promotions.all(), exact: false });
      showSuccess('Promotion deleted');
    },
    onError: (err: any) => showError(err?.response?.data?.message ?? 'Failed to delete promotion'),
  });

  const handleOpenModal = (promotion?: Promotion) => {
    if (promotion) {
      setEditingPromotion(promotion);
      reset({
        name: promotion.name,
        description: promotion.description || '',
        type: promotion.type,
        scope: promotion.scope || 'entire_transaction',
        value: promotion.value,
        minimumPurchase: promotion.minimumPurchase,
        maximumDiscount: promotion.maximumDiscount,
        startDate: promotion.startDate.split('T')[0],
        endDate: promotion.endDate.split('T')[0],
        usageLimit: promotion.usageLimit,
      });
    } else {
      setEditingPromotion(null);
      const today = new Date().toISOString().split('T')[0];
      reset({
        name: '',
        description: '',
        type: 'percentage',
        scope: 'entire_transaction',
        value: 0,
        startDate: today,
        endDate: today,
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPromotion(null);
    reset();
  };

  const onSubmit = (data: PromotionFormData) => {
    if (editingPromotion) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  if (isLoading) return <AdminLayout><Loading /></AdminLayout>;
  if (error) return <AdminLayout><Error message="Failed to load promotions" /></AdminLayout>;

  const columns = [
    { key: 'name', header: 'Promotion Name' },
    {
      key: 'type',
      header: 'Type',
      render: (promotion: Promotion) => (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
          {promotion.type === 'percentage' && 'Percentage'}
          {promotion.type === 'fixed_amount' && 'Fixed Amount'}
          {promotion.type === 'buy_x_get_y' && 'Buy X Get Y'}
        </span>
      ),
    },
    {
      key: 'value',
      header: 'Value',
      render: (promotion: Promotion) => (
        promotion.type === 'percentage'
          ? `${promotion.value}%`
          : format(promotion.value)
      ),
    },
    {
      key: 'period',
      header: 'Period',
      render: (promotion: Promotion) => (
        <div className="text-sm">
          <div>{new Date(promotion.startDate).toLocaleDateString()}</div>
          <div className="text-gray-500">to {new Date(promotion.endDate).toLocaleDateString()}</div>
        </div>
      ),
    },
    {
      key: 'usage',
      header: 'Usage',
      render: (promotion: Promotion) => (
        <div>
          <span className="font-semibold">{promotion.usageCount}</span>
          {promotion.usageLimit && <span className="text-gray-500"> / {promotion.usageLimit}</span>}
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (promotion: Promotion) => {
        const isExpired = new Date(promotion.endDate) < new Date();
        if (isExpired) {
          return (
            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-white/10 text-white/60">
              Expired
            </span>
          );
        }
        return promotion.isActive ? (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-500/20 text-green-300">
            Active
          </span>
        ) : (
          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-500/20 text-red-300">
            Inactive
          </span>
        );
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (promotion: Promotion) => (
        <div className="flex space-x-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleOpenModal(promotion)}
          >
            Edit
          </Button>
          <Button
            variant={promotion.isActive ? 'danger' : 'primary'}
            size="sm"
            onClick={() => toggleStatusMutation.mutate(promotion)}
          >
            {promotion.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={async () => {
              const confirmed = await requestConfirmation({
                title: 'Delete promotion?',
                message: `"${promotion.name}" will be permanently removed and can no longer be applied.`,
                confirmLabel: 'Delete promotion',
                variant: 'danger',
              });
              if (confirmed) deleteMutation.mutate(promotion);
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Promotions & Discounts</h1>
            <p className="text-sm text-slate-400 mt-1">Manage promotional campaigns, coupon codes, and percentage discounts</p>
          </div>
          <Button onClick={() => handleOpenModal()} className="shadow-lg shadow-emerald-500/15">
            Create Promotion
          </Button>
        </div>

        {/* Search Bar */}
        <div className="max-w-md">
          <Input
            placeholder="Search promotions by code or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Promotions Table */}
        <Table
          data={promotions || []}
          columns={columns}
          emptyMessage="No promotions found"
        />

        {/* Promotion Form Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={editingPromotion ? 'Edit Promotion' : 'Create Promotion'}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Promotion Name"
              {...register('name', { required: 'Promotion name is required' })}
              error={errors.name?.message}
            />

            <Input
              label="Description (Optional)"
              {...register('description')}
              error={errors.description?.message}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Select
                label="Promotion Type"
                {...register('type', { required: 'Type is required' })}
                error={errors.type?.message}
              >
                <option value="percentage" className="bg-primary-dark text-white">Percentage Discount</option>
                <option value="fixed_amount" className="bg-primary-dark text-white">Fixed Amount Discount</option>
                <option value="buy_x_get_y" className="bg-primary-dark text-white">Buy X Get Y</option>
              </Select>

              <Select
                label="Promotion Scope"
                {...register('scope', { required: 'Scope is required' })}
                error={errors.scope?.message}
              >
                <option value="entire_transaction" className="bg-primary-dark text-white">Entire Order / Transaction</option>
                <option value="specific_item" className="bg-primary-dark text-white">Specific Item</option>
                <option value="category" className="bg-primary-dark text-white">Product Category</option>
              </Select>
            </div>

            <Input
              label={promotionType === 'percentage' ? 'Discount Percentage (%)' : 'Discount Value'}
              type="number"
              step="0.01"
              min="0"
              {...register('value', {
                required: 'Value is required',
                valueAsNumber: true,
                min: { value: 0, message: 'Must be 0 or greater' },
              })}
              error={errors.value?.message}
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Start Date"
                type="date"
                {...register('startDate', { required: 'Start date is required' })}
                error={errors.startDate?.message}
              />

              <Input
                label="End Date"
                type="date"
                {...register('endDate', { required: 'End date is required' })}
                error={errors.endDate?.message}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Min Purchase Amount (Optional)"
                type="number"
                step="0.01"
                min="0"
                {...register('minimumPurchase', {
                  valueAsNumber: true,
                  min: { value: 0, message: 'Must be 0 or greater' },
                })}
                error={errors.minimumPurchase?.message}
              />

              <Input
                label="Max Discount Amount (Optional)"
                type="number"
                step="0.01"
                min="0"
                {...register('maximumDiscount', {
                  valueAsNumber: true,
                  min: { value: 0, message: 'Must be 0 or greater' },
                })}
                error={errors.maximumDiscount?.message}
              />
            </div>

            <Input
              label="Usage Limit (Optional)"
              type="number"
              min="0"
              {...register('usageLimit', {
                valueAsNumber: true,
                min: { value: 0, message: 'Must be 0 or greater' },
              })}
              error={errors.usageLimit?.message}
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
                isLoading={createMutation.isPending || updateMutation.isPending}
              >
                {editingPromotion ? 'Update Promotion' : 'Create Promotion'}
              </Button>
            </div>

            {(createMutation.isError || updateMutation.isError) && (
              <Error message="Failed to save promotion. Please try again." />
            )}
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
};

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { AdminPageHeader, AdminStatusBadge } from '../../components/admin';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Error } from '../../components/ui/Error';
import { useToast } from '../../hooks/useToast';
import { useCurrency } from '../../hooks/useCurrency';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { useSearchWithDebounce } from '../../hooks/useSearchWithDebounce';
import { unwrapArray } from '../../lib/unwrap-response';
import { useConfirm } from '../../hooks/useConfirm';
import { getErrorMessage } from '../../lib/error-utils';
import { formatDate } from '../../lib/date-format';

interface PromotionProductOption {
  _id?: string;
  id?: string;
  name: string;
  category?: string;
}

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
  const promotionScope = watch('scope');

  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  // Fetch promotions
  const { data: promotions, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.promotions.list({ search: debouncedSearchQuery }),
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl('/promotions', { search: debouncedSearchQuery }));
      return unwrapArray<Promotion>(response.data);
    },
  });

  // Fetch products for scope selectors
  const { data: productOptions } = useQuery({
    queryKey: queryKeys.products.list({ limit: 1000 }),
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl('/products', { limit: 1000 }));
      return unwrapArray<PromotionProductOption>(response.data);
    },
    staleTime: 5 * 60 * 1000,
  });

  const categoryOptions = useMemo(
    () => Array.from(new Set((productOptions || []).map((p) => p.category).filter((c): c is string => !!c))),
    [productOptions]
  );

  const productKey = (p: PromotionProductOption) => p._id || p.id || '';

  const toggleProduct = (id: string) => {
    setSelectedProducts((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleCategory = (category: string) => {
    setSelectedCategories((prev) => (prev.includes(category) ? prev.filter((x) => x !== category) : [...prev, category]));
  };

  const buildPayload = (data: PromotionFormData): Record<string, unknown> => {
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
    if (data.scope === 'specific_item') {
      payload.applicableProducts = selectedProducts;
    }
    if (data.scope === 'category') {
      payload.applicableCategories = selectedCategories;
    }
    return payload;
  };

  // Create promotion mutation
  const createMutation = useMutation({
    mutationFn: async (data: PromotionFormData) => {
      return apiClient.post('/promotions', buildPayload(data));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.promotions.all(), exact: false });
      setIsModalOpen(false);
      setSelectedProducts([]);
      setSelectedCategories([]);
      reset();
      showSuccess('Promotion created');
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to create promotion')),
  });

  // Update promotion mutation
  const updateMutation = useMutation({
    mutationFn: async (data: PromotionFormData) => {
      const id = editingPromotion?._id || editingPromotion?.id;
      if (!id) return;
      return apiClient.patch(`/promotions/${id}`, buildPayload(data));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.promotions.all(), exact: false });
      setIsModalOpen(false);
      setEditingPromotion(null);
      setSelectedProducts([]);
      setSelectedCategories([]);
      reset();
      showSuccess('Promotion updated');
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to update promotion')),
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
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to update status')),
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
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to delete promotion')),
  });

  const handleOpenModal = (promotion?: Promotion) => {
    if (promotion) {
      setEditingPromotion(promotion);
      setSelectedProducts(promotion.applicableProducts || []);
      setSelectedCategories(promotion.applicableCategories || []);
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
      setSelectedProducts([]);
      setSelectedCategories([]);
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
    setSelectedProducts([]);
    setSelectedCategories([]);
    reset();
  };

  const onSubmit = (data: PromotionFormData) => {
    if (data.scope === 'specific_item' && selectedProducts.length === 0) {
      showError('Select at least one product', 'Choose the products this promotion applies to.');
      return;
    }
    if (data.scope === 'category' && selectedCategories.length === 0) {
      showError('Select at least one category', 'Choose the categories this promotion applies to.');
      return;
    }
    if (editingPromotion) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const columns = [
    { key: 'name', header: 'Promotion Name' },
    {
      key: 'type',
      header: 'Type',
      render: (promotion: Promotion) => (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-purple-500/20 text-purple-300">
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
          <div>{formatDate(promotion.startDate)}</div>
          <div className="text-slate-500">to {formatDate(promotion.endDate)}</div>
        </div>
      ),
    },
    {
      key: 'usage',
      header: 'Usage',
      render: (promotion: Promotion) => (
        <div>
          <span className="font-semibold">{promotion.usageCount}</span>
          {promotion.usageLimit && <span className="text-slate-500"> / {promotion.usageLimit}</span>}
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (promotion: Promotion) => {
        const isExpired = new Date(promotion.endDate) < new Date();
        if (isExpired) {
          return <AdminStatusBadge tone="neutral">Expired</AdminStatusBadge>;
        }
        return (
          <AdminStatusBadge tone={promotion.isActive ? 'success' : 'neutral'}>
            {promotion.isActive ? 'Active' : 'Inactive'}
          </AdminStatusBadge>
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
            isLoading={toggleStatusMutation.isPending && toggleStatusMutation.variables?._id === promotion._id}
            onClick={() => toggleStatusMutation.mutate(promotion)}
          >
            {promotion.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            variant="danger"
            size="sm"
            isLoading={deleteMutation.isPending && deleteMutation.variables?._id === promotion._id}
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
        <AdminPageHeader
          title="Promotions & Discounts"
          subtitle="Manage promotional campaigns, coupon codes, and percentage discounts"
          actions={
            <Button onClick={() => handleOpenModal()} className="shadow-lg shadow-emerald-500/15">
              Create Promotion
            </Button>
          }
        />

        {/* Search Bar */}
        <div className="max-w-md">
          <Input
            placeholder="Search promotions by code or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Promotions Table */}
        {error ? (
          <Error message="Failed to load promotions" onRetry={() => { void refetch(); }} />
        ) : (
          <Table
            data={promotions || []}
            columns={columns}
            isLoading={isLoading}
            emptyMessage="No promotions found"
          />
        )}

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
                <option value="percentage">Percentage Discount</option>
                <option value="fixed_amount">Fixed Amount Discount</option>
                <option value="buy_x_get_y">Buy X Get Y</option>
              </Select>

              <Select
                label="Promotion Scope"
                {...register('scope', { required: 'Scope is required' })}
                error={errors.scope?.message}
              >
                <option value="entire_transaction">Entire Order / Transaction</option>
                <option value="specific_item">Specific Item</option>
                <option value="category">Product Category</option>
              </Select>
            </div>

            {promotionScope === 'specific_item' && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-300">Applicable Products</label>
                  <span className="text-xs text-slate-500">{selectedProducts.length} selected</span>
                </div>
                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-slate-950/60 p-2">
                  {(productOptions || []).map((p) => {
                    const id = productKey(p);
                    return (
                      <label
                        key={id}
                        className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-300 hover:bg-white/[0.04]"
                      >
                        <input
                          type="checkbox"
                          className="accent-emerald-500"
                          checked={selectedProducts.includes(id)}
                          onChange={() => toggleProduct(id)}
                        />
                        <span className="truncate">{p.name}</span>
                      </label>
                    );
                  })}
                  {(!productOptions || productOptions.length === 0) && (
                    <p className="px-2 py-1 text-xs text-slate-500">No products available.</p>
                  )}
                </div>
                {selectedProducts.length === 0 && (
                  <p className="mt-1 text-xs text-amber-300/90">Select at least one product for this promotion to apply.</p>
                )}
              </div>
            )}

            {promotionScope === 'category' && (
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-300">Applicable Categories</label>
                  <span className="text-xs text-slate-500">{selectedCategories.length} selected</span>
                </div>
                <div className="mt-2 max-h-48 space-y-1 overflow-y-auto rounded-lg border border-white/10 bg-slate-950/60 p-2">
                  {categoryOptions.map((category) => (
                    <label
                      key={category}
                      className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-300 hover:bg-white/[0.04]"
                    >
                      <input
                        type="checkbox"
                        className="accent-emerald-500"
                        checked={selectedCategories.includes(category)}
                        onChange={() => toggleCategory(category)}
                      />
                      <span className="truncate">{category}</span>
                    </label>
                  ))}
                  {categoryOptions.length === 0 && (
                    <p className="px-2 py-1 text-xs text-slate-500">No product categories available.</p>
                  )}
                </div>
                {selectedCategories.length === 0 && (
                  <p className="mt-1 text-xs text-amber-300/90">Select at least one category for this promotion to apply.</p>
                )}
              </div>
            )}

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
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
};

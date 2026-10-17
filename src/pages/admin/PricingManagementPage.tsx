import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { DollarSign, Layers } from 'lucide-react';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { AdminPageHeader, AdminStatCard } from '../../components/admin';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { BranchSelector } from '../../components/BranchSelector';
import { unwrapArray } from '../../lib/unwrap-response';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import { useCurrency } from '../../hooks/useCurrency';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { getErrorMessage } from '../../lib/error-utils';

interface ProductPricing {
  productId: string;
  productName: string;
  basePrice: number;
  costPrice: number;
  suggestedRetailPrice: number;
  markupPercentage: number;
  effectiveSellingPrice: number;
  packSizes: {
    name: string;
    unit: string;
    quantityPerPack: number;
    sellingPrice: number;
    barcode?: string;
  }[];
}

interface ProductOption {
  _id: string;
  name: string;
  sku: string;
  packSizes?: ProductPricing['packSizes'];
}

interface BulkPriceUpdate {
  strategy: {
    useProductBasePrice: boolean;
    useLatestBatchPrice: boolean;
    useCostPlusMarkup: boolean;
    markupPercentage?: number;
  };
  applyToProducts?: string[];
  applyToBranches?: string[];
  newBasePrice?: number;
  newMarkupPercentage?: number;
}

export const PricingManagementPage = () => {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [isBulkUpdateModalOpen, setIsBulkUpdateModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const { format } = useCurrency();
  const { selectedBranch } = useBranchStore();
  const { showSuccess, showError } = useToast();
  const requestConfirmation = useConfirm();
  const branchId = getBranchId(selectedBranch);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<BulkPriceUpdate>();

  // Fetch products for selection
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: queryKeys.products.list({ branchId, limit: 1000 }),
    queryFn: async () => {
      const response = await apiClient.get('/products', {
        params: { limit: 1000, ...(branchId ? { branchId } : {}) },
      });
      return unwrapArray(response.data?.data || response.data) as ProductOption[];
    },
    enabled: !!branchId,
  });

  // Fetch pricing data for selected product
  const { data: productPricing, isLoading: pricingLoading, error: pricingError } = useQuery({
    queryKey: queryKeys.pricing.product(selectedProductId, branchId),
    queryFn: async () => {
      if (!selectedProductId) return null;
      const response = await apiClient.get(buildApiUrl(`/products/${selectedProductId}/pricing`, {
        branchId,
      }));
      const selectedProduct = products?.find((product) => product._id === selectedProductId);
      
      // Transform data to ensure all required fields exist
      const data = response.data;
      return {
        productId: data.productId || data._id || selectedProductId,
        productName: data.productName || data.name || '',
        basePrice: data.basePrice || 0,
        costPrice: data.costPrice || 0,
        suggestedRetailPrice: data.suggestedRetailPrice || data.sellingPrice || 0,
        markupPercentage: data.markupPercentage || 0,
        effectiveSellingPrice: data.effectiveSellingPrice || data.sellingPrice || data.basePrice || 0,
        packSizes: selectedProduct?.packSizes || [],
      } as ProductPricing;
    },
    enabled: !!selectedProductId && !!branchId && !!products,
  });

  // Fetch pricing analytics
  const { data: analytics } = useQuery({
    queryKey: queryKeys.pricing.analytics(branchId),
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl('/products/pricing-analytics', {
        branchId,
      }));
      return response.data;
    },
    enabled: !!branchId,
  });

  // Bulk price update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async (data: BulkPriceUpdate) => {
      const response = await apiClient.post('/products/bulk-price-update', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all(), exact: false });
      queryClient.invalidateQueries({ queryKey: queryKeys.pricing.all(), exact: false });
      setIsBulkUpdateModalOpen(false);
      reset();
      showSuccess('Prices updated successfully');
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to update prices')),
  });

  const closeBulkUpdateModal = () => {
    setIsBulkUpdateModalOpen(false);
    reset();
  };

  const handleBulkUpdate = async (data: BulkPriceUpdate) => {
    const hasStrategy = Boolean(data.strategy?.useProductBasePrice) || Boolean(data.strategy?.useCostPlusMarkup);
    const hasValue = (data.newBasePrice !== undefined && !isNaN(Number(data.newBasePrice))) || (data.newMarkupPercentage !== undefined && !isNaN(Number(data.newMarkupPercentage)));
    if (!hasStrategy && !hasValue) {
      showError('Nothing to update', 'Select a pricing strategy or enter a new base price / markup before updating.');
      return;
    }

    const confirmed = await requestConfirmation({
      title: 'Apply bulk price update?',
      message: `This will update ${hasStrategy && hasValue ? 'prices for' : hasStrategy ? 'products in' : 'prices for all products in'} ${selectedBranch?.name ?? 'this branch'} using the selected strategy${hasValue ? ' and/or values' : ''}. This cannot be undone.`,
      confirmLabel: 'Update prices',
      variant: 'warning',
    });
    if (!confirmed) return;

    const payload: BulkPriceUpdate = {
      strategy: {
        useProductBasePrice: Boolean(data.strategy?.useProductBasePrice),
        useLatestBatchPrice: Boolean(data.strategy?.useLatestBatchPrice),
        useCostPlusMarkup: Boolean(data.strategy?.useCostPlusMarkup),
      },
      applyToBranches: branchId ? [branchId] : undefined,
    };
    if (data.newBasePrice !== undefined && !isNaN(Number(data.newBasePrice))) {
      payload.newBasePrice = Number(data.newBasePrice);
    }
    if (data.newMarkupPercentage !== undefined && !isNaN(Number(data.newMarkupPercentage))) {
      payload.newMarkupPercentage = Number(data.newMarkupPercentage);
    }
    bulkUpdateMutation.mutate(payload);
  };

  if (!branchId) {
    return (
      <AdminLayout title="Pricing Management">
        <div className="space-y-5">
          <AdminPageHeader
            title="Pricing Management"
            subtitle="Pricing is branch-scoped. Choose a branch to review product prices and run updates."
          />
          <div className="rounded-2xl border border-amber-500/20 bg-amber-950/25 p-6 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/25 bg-amber-500/15 text-amber-300">
                <DollarSign className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-white tracking-tight">Select a branch</h2>
                <p className="mt-0.5 text-sm text-slate-400">
                  Use the selector below to load branch pricing.
                </p>
              </div>
            </div>
            <div className="mt-4 max-w-sm">
              <BranchSelector />
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (productsLoading) return <AdminLayout><Loading /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <AdminPageHeader
          title="Pricing Management"
          subtitle="Manage pricing strategies and bulk updates"
          actions={
            <>
              <BranchSelector />
              <Button onClick={() => setIsBulkUpdateModalOpen(true)}>Bulk Price Update</Button>
            </>
          }
        />

        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <AdminStatCard label="Total Products" value={analytics.totalProducts} tone="neutral" />
            <AdminStatCard
              label="Average Markup"
              value={`${analytics.averageMarkup?.toFixed(1) ?? '0.0'}%`}
              tone="success"
            />
            <AdminStatCard
              label="Average Price"
              value={format(analytics.averageSellingPrice || 0)}
              tone="neutral"
            />
            <AdminStatCard
              label="Custom Pricing"
              value={analytics.productsWithCustomPricing || 0}
              tone="info"
            />
          </div>
        )}

        {/* Product Selection */}
        <div className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Product Pricing Details</h2>
          <Select
            label="Select Product"
            value={selectedProductId}
            onChange={(e) => setSelectedProductId(e.target.value)}
          >
            <option value="">Select a product...</option>
            {products?.map((product) => (
              <option key={product._id} value={product._id}>
                {product.name} ({product.sku})
              </option>
            ))}
          </Select>

          {/* Product Pricing Details */}
          {selectedProductId && (
            <div className="mt-6">
              {pricingLoading ? (
                <Loading />
              ) : pricingError ? (
                <div className="text-center py-8">
                  <p className="text-red-400 mb-2">Failed to load pricing data</p>
                  <p className="text-sm text-slate-400">
                    {pricingError instanceof Error ? pricingError.message : 'Unknown error occurred'}
                  </p>
                </div>
              ) : productPricing ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                      <p className="text-sm text-slate-400 mb-2">Cost Price</p>
                      <p
                        className="text-2xl sm:text-3xl font-bold text-white tabular-nums break-words leading-tight"
                        title={format(productPricing.costPrice)}
                      >
                        {format(productPricing.costPrice)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">What you paid for it</p>
                    </div>
                    <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                      <p className="text-sm text-slate-400 mb-2">Selling Price</p>
                      <p
                        className="text-2xl sm:text-3xl font-bold text-emerald-400 tabular-nums break-words leading-tight"
                        title={format(productPricing.effectiveSellingPrice)}
                      >
                        {format(productPricing.effectiveSellingPrice)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">What customers pay</p>
                    </div>
                  </div>

                  <div className="bg-blue-500/10 rounded-xl p-4 border border-blue-500/20">
                    <p className="text-sm text-blue-400">
                      <span className="font-semibold">Profit per item:</span>{' '}
                      <span
                        className="font-bold tabular-nums break-words"
                        title={format(productPricing.effectiveSellingPrice - productPricing.costPrice)}
                      >
                        {format(productPricing.effectiveSellingPrice - productPricing.costPrice)}
                      </span>
                    </p>
                  </div>

                  <div>
                    <h3 className="text-md font-semibold text-white">Pack / Unit Prices</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      Pack prices come from the product's unit conversion setup.
                    </p>
                  </div>

                  {productPricing.packSizes && productPricing.packSizes.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-white/5 border-b border-white/10">
                          <tr>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Pack</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Unit</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Base Units</th>
                            <th className="px-4 py-3 text-left text-sm font-semibold text-slate-400">Selling Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {productPricing.packSizes.map((pack) => (
                            <tr key={`${pack.unit}-${pack.name}`}>
                              <td className="px-4 py-3 text-sm text-white">{pack.name}</td>
                              <td className="px-4 py-3 text-sm text-white">{pack.unit}</td>
                              <td className="px-4 py-3 text-sm text-white">{pack.quantityPerPack}</td>
                              <td className="px-4 py-3 text-sm text-emerald-400 font-semibold">{format(pack.sellingPrice)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-slate-400 text-center py-4">
                      No pack sizes configured. Edit the product to add unit-level prices.
                    </p>
                  )}
                </div>
              ) : (
                <Error message="Failed to load pricing data" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bulk Price Update Modal */}
      <Modal
        isOpen={isBulkUpdateModalOpen}
        onClose={closeBulkUpdateModal}
        title="Bulk Price Update"
      >
        <form onSubmit={handleSubmit(handleBulkUpdate)} className="space-y-4">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-white">Pricing Strategy</h3>
            
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="useProductBasePrice"
                {...register('strategy.useProductBasePrice')}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-400"
              />
              <label htmlFor="useProductBasePrice" className="text-sm text-white">
                Update Product Base Prices
              </label>
            </div>

            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                id="useCostPlusMarkup"
                {...register('strategy.useCostPlusMarkup')}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-400"
              />
              <label htmlFor="useCostPlusMarkup" className="text-sm text-white">
                Apply Cost + Markup Strategy
              </label>
            </div>
          </div>

          <Input
            label="New Base Price"
            type="number"
            min="0"
            step="0.01"
            {...register('newBasePrice', {
              valueAsNumber: true,
              min: { value: 0, message: 'Must be 0 or greater' },
            })}
            error={errors.newBasePrice?.message}
          />

          <Input
            label="New Markup Percentage (%)"
            type="number"
            min="0"
            step="0.1"
            {...register('newMarkupPercentage', {
              valueAsNumber: true,
              min: { value: 0, message: 'Must be 0 or greater' },
            })}
            error={errors.newMarkupPercentage?.message}
          />

          <div className="flex justify-end space-x-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              onClick={closeBulkUpdateModal}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={bulkUpdateMutation.isPending}
            >
              Update Prices
            </Button>
          </div>
        </form>
      </Modal>
    </AdminLayout>
  );
};

export default PricingManagementPage;

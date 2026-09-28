import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { BranchSelector } from '../../components/BranchSelector';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { getErrorMessage } from '../../lib/error-utils';
import { CompactPagination } from '../../components/ui/Pagination';
import { AdminMobileBottomNav } from '../../components/admin/AdminMobileBottomNav';

interface Product {
  _id: string;
  name: string;
  sku: string;
  brand: string;
  unit: string;
  quantityAvailable: number;
  supplierId?: { _id: string; name: string } | string;
  supplyDate?: string;
  expiryDate?: string;
}

interface StockMovement {
  _id: string;
  branchId: string;
  productId?: { _id: string; name: string; sku: string };
  quantity: number;
  movementType: string;
  reason: string;
  userId?: { firstName?: string; lastName?: string };
  timestamp: string;
}

interface AdjustmentFormData {
  productId: string;
  batchId: string;
  quantityChange: number;
  reason: string;
}

interface Batch {
  _id: string;
  lotNumber: string;
  expiryDate: string;
  quantityAvailable: number;
}

const formatDate = (value?: string) => value ? new Date(value).toLocaleDateString() : '-';
const formatSupplier = (supplier?: Product['supplierId']) => {
  if (!supplier) return '-';
  return typeof supplier === 'string' ? supplier : supplier.name;
};

export default function StockAdjustmentPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [mobileTab, setMobileTab] = useState<'products' | 'history'>('products');
  const { selectedBranch } = useBranchStore();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();

  // Pagination for products
  const [productPage, setProductPage] = useState(1);
  const [productLimit, setProductLimit] = useState(20);

  // Pagination for adjustments
  const [adjPage, setAdjPage] = useState(1);
  const [adjLimit, setAdjLimit] = useState(20);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<AdjustmentFormData>();
  const branchId = getBranchId(selectedBranch);

  const { data: batches = [], isLoading: batchesLoading } = useQuery({
    queryKey: ['batches', branchId, selectedProduct?._id],
    queryFn: async () => {
      const response = await apiClient.get(
        `/batches/branch/${branchId}/product/${selectedProduct?._id}`,
      );
      return (response.data?.data ?? response.data ?? []) as Batch[];
    },
    enabled: Boolean(branchId && selectedProduct?._id && isModalOpen),
  });

  // Products with pagination
  const { data: productsData, isLoading, error } = useQuery({
    queryKey: queryKeys.products.list({ branchId, page: productPage, limit: productLimit }),
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl('/products', { branchId, page: productPage, limit: productLimit }));
      return response.data;
    },
    enabled: !!branchId,
  });

  const products = productsData?.data || [];
  const productPagination = productsData?.pagination;

  // Adjustments with client-side pagination
  const { data: allAdjustments, isLoading: adjustmentsLoading } = useQuery({
    queryKey: queryKeys.adjustments.list({ branchId, movementType: 'adjustment' }),
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl('/inventory/stock-movements', { branchId, movementType: 'adjustment' }));
      const payload = response.data?.data ?? response.data;
      return (Array.isArray(payload) ? payload : []) as StockMovement[];
    },
    enabled: !!branchId,
  });

  // Client-side paginate adjustments
  const adjustments = allAdjustments || [];
  const adjTotal = adjustments.length;
  const adjStart = (adjPage - 1) * adjLimit;
  const paginatedAdjustments = adjustments.slice(adjStart, adjStart + adjLimit);
  const adjTotalPages = Math.ceil(adjTotal / adjLimit);
  const productPaginationMeta = productPagination ? {
    page: productPagination.page,
    limit: productPagination.limit,
    total: productPagination.total,
    pages: productPagination.pages,
    hasNext: productPagination.hasNext,
    hasPrev: productPagination.hasPrev,
  } : undefined;
  const adjustmentPaginationMeta = {
    page: adjPage,
    limit: adjLimit,
    total: adjTotal,
    pages: adjTotalPages,
    hasNext: adjPage < adjTotalPages,
    hasPrev: adjPage > 1,
  };

  // Reset to page 1 when limit changes
  const handleProductLimitChange = (limit: number) => { setProductLimit(limit); setProductPage(1); };
  const handleAdjLimitChange = (limit: number) => { setAdjLimit(limit); setAdjPage(1); };

  const adjustmentMutation = useMutation({
    mutationFn: async (data: AdjustmentFormData) =>
      apiClient.post('/inventory/adjust', { ...data, branchId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all(), exact: false });
      queryClient.invalidateQueries({ queryKey: queryKeys.adjustments.all(), exact: false });
      showSuccess('Stock adjusted successfully');
      setIsModalOpen(false);
      setSelectedProduct(null);
      reset();
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to adjust stock')),
  });

  const handleOpenModal = (product: Product) => { setSelectedProduct(product); setIsModalOpen(true); };
  const handleCloseModal = () => { setIsModalOpen(false); setSelectedProduct(null); reset(); };
  const onSubmit = (data: AdjustmentFormData) => {
    if (!selectedProduct) return;
    adjustmentMutation.mutate({
      productId: selectedProduct._id,
      batchId: data.batchId,
      quantityChange: Number(data.quantityChange),
      reason: data.reason.trim(),
    });
  };

  if (!selectedBranch) {
    return (
      <AdminLayout title="Stock Adjustments">
        <div className="max-w-md mx-auto text-center py-16 px-4">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <SlidersHorizontal className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Select a Branch</h2>
          <p className="text-sm text-slate-400 mb-6">
            Stock adjustments are recorded per branch. Choose a branch to review and manage stock levels.
          </p>
          <div className="flex justify-center">
            <BranchSelector />
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (isLoading) return <AdminLayout title="Stock Adjustments"><Loading /></AdminLayout>;
  if (error) return <AdminLayout title="Stock Adjustments"><Error message="Failed to load products" onRetry={() => queryClient.invalidateQueries({ queryKey: queryKeys.products.list({ branchId }) })} /></AdminLayout>;

  const productColumns = [
    { key: 'name', header: 'Product' },
    { key: 'sku', header: 'SKU' },
    { key: 'brand', header: 'Brand' },
    { key: 'quantityAvailable', header: 'Stock' },
    { key: 'supplierId', header: 'Supplier', render: (p: Product) => formatSupplier(p.supplierId) },
    { key: 'expiryDate', header: 'Expiry', render: (p: Product) => formatDate(p.expiryDate) },
    { key: 'actions', header: '', render: (p: Product) => <Button variant="secondary" size="sm" onClick={() => handleOpenModal(p)}>Adjust</Button> },
  ];

  const adjustmentColumns = [
    { key: 'timestamp', header: 'Date', render: (a: StockMovement) => new Date(a.timestamp).toLocaleString() },
    { key: 'productId.name', header: 'Product', render: (a: StockMovement) => a.productId?.name || '-' },
    { key: 'quantity', header: 'Qty', render: (a: StockMovement) => <span className={a.quantity > 0 ? 'text-emerald-400' : 'text-red-400'}>{a.quantity > 0 ? '+' : ''}{a.quantity}</span> },
    { key: 'reason', header: 'Reason' },
    { key: 'userId', header: 'By', render: (a: StockMovement) => a.userId ? `${a.userId.firstName || ''} ${a.userId.lastName || ''}`.trim() || '-' : '-' },
  ];

  return (
    <AdminLayout title="Stock Adjustments" showMobileBranchSelector={false}>
      <div className="space-y-6 pb-24 lg:pb-0">
        <div className="lg:hidden">
          <header className="mb-5 flex flex-col gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Stock Action Ledger</h1>
              <p className="mt-1 text-sm leading-5 text-gray-400">
                Review current stock and keep every manual change traceable.
              </p>
            </div>
            <BranchSelector />
          </header>

          <div className="mb-4 grid grid-cols-2 rounded-xl border border-slate-800 bg-slate-900/70 p-1" role="tablist" aria-label="Stock adjustment views">
            <button
              type="button"
              role="tab"
              aria-selected={mobileTab === 'products'}
              onClick={() => setMobileTab('products')}
              className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-500/60 ${mobileTab === 'products' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-gray-400 hover:text-white'}`}
            >
              Product Stock
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileTab === 'history'}
              onClick={() => setMobileTab('history')}
              className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-500/60 ${mobileTab === 'history' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-gray-400 hover:text-white'}`}
            >
              Adjustment History
            </button>
          </div>

          {mobileTab === 'products' ? (
            <section aria-labelledby="mobile-product-stock-heading" className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/65 shadow-xl shadow-black/10">
              <div className="grid grid-cols-[minmax(0,1fr)_64px_74px] items-center gap-2 border-b border-slate-800 bg-slate-950/40 px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <h2 id="mobile-product-stock-heading">Product</h2>
                <span className="text-center">Stock</span>
                <span className="text-right">Action</span>
              </div>
              <div className="divide-y divide-slate-800">
                {products.map((product: Product) => (
                  <article key={product._id} className="grid grid-cols-[minmax(0,1fr)_64px_74px] items-center gap-2 px-4 py-4">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-white">{product.name}</h3>
                      <p className="mt-1 truncate text-xs text-gray-400">{product.sku} · {product.brand || 'No brand'}</p>
                      <p className="mt-1 truncate text-[11px] text-gray-500">{formatSupplier(product.supplierId)} · Exp {formatDate(product.expiryDate)}</p>
                    </div>
                    <div className="text-center">
                      <span className="block text-xl font-bold text-white">{product.quantityAvailable}</span>
                      <span className="text-[10px] uppercase tracking-wide text-gray-500">{product.unit || 'units'}</span>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => handleOpenModal(product)} className="!border-amber-400/70 !bg-amber-400/5 !px-2 !text-amber-300 hover:!bg-amber-400/15">
                      Adjust
                    </Button>
                  </article>
                ))}
              </div>
              {products.length === 0 ? <p className="px-4 py-10 text-center text-sm text-gray-400">No products found for this branch.</p> : null}
              <CompactPagination meta={productPaginationMeta} onPageChange={setProductPage} />
            </section>
          ) : (
            <section aria-labelledby="mobile-adjustment-history-heading" className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/65 shadow-xl shadow-black/10">
              <div className="border-b border-slate-800 bg-slate-950/40 px-4 py-3">
                <h2 id="mobile-adjustment-history-heading" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Recorded adjustments</h2>
              </div>
              {adjustmentsLoading ? (
                <div className="p-6"><Loading /></div>
              ) : (
                <>
                  <div className="divide-y divide-slate-800">
                    {paginatedAdjustments.map((adjustment) => (
                      <article key={adjustment._id} className="px-4 py-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-bold text-white">{adjustment.productId?.name || 'Unknown product'}</h3>
                            <p className="mt-1 text-xs text-gray-400">{new Date(adjustment.timestamp).toLocaleString()}</p>
                          </div>
                          <span className={`shrink-0 text-lg font-bold ${adjustment.quantity > 0 ? 'text-emerald-300' : 'text-red-400'}`}>
                            {adjustment.quantity > 0 ? '+' : ''}{adjustment.quantity}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-5 text-gray-300">{adjustment.reason || 'No reason supplied'}</p>
                        <p className="mt-2 text-xs text-gray-500">By {adjustment.userId ? `${adjustment.userId.firstName || ''} ${adjustment.userId.lastName || ''}`.trim() || 'Unknown user' : 'Unknown user'}</p>
                      </article>
                    ))}
                  </div>
                  {paginatedAdjustments.length === 0 ? <p className="px-4 py-10 text-center text-sm text-gray-400">No stock adjustments have been recorded.</p> : null}
                  <CompactPagination meta={adjustmentPaginationMeta} onPageChange={setAdjPage} />
                </>
              )}
            </section>
          )}
        </div>

        <div className="hidden space-y-6 lg:block">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Stock Adjustments</h1>
              <p className="text-sm text-slate-400 mt-1">Review current inventory stock and record manual stock adjustments</p>
            </div>
            <BranchSelector />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 shadow-lg">
            <div className="border-b border-slate-800 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Product Stock</h2>
            </div>
            <Table
              data={products}
              columns={productColumns}
              pagination={productPaginationMeta}
              onPageChange={setProductPage}
              onLimitChange={handleProductLimitChange}
            />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/60 shadow-lg">
            <div className="border-b border-slate-800 px-6 py-4">
              <h2 className="text-lg font-semibold text-white">Adjustment History</h2>
            </div>
            {adjustmentsLoading ? (
              <div className="p-6"><Loading /></div>
            ) : (
              <Table
                data={paginatedAdjustments}
                columns={adjustmentColumns}
                pagination={adjustmentPaginationMeta}
                onPageChange={setAdjPage}
                onLimitChange={handleAdjLimitChange}
              />
            )}
          </div>
        </div>

        <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Adjust Product Stock">
          {selectedProduct && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <p className="text-sm text-gray-300">Product: <span className="font-semibold text-white">{selectedProduct.name}</span></p>
                <p className="text-sm text-gray-300">Current Stock: <span className="font-semibold text-white">{selectedProduct.quantityAvailable}</span></p>
                <p className="text-sm text-gray-300">Supplier: <span className="font-semibold text-white">{formatSupplier(selectedProduct.supplierId)}</span></p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">
                  Batch <span className="text-red-500">*</span>
                </label>
                <select
                  {...register('batchId', { required: 'Batch is required' })}
                  disabled={batchesLoading}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="">{batchesLoading ? 'Loading batches…' : 'Select a batch'}</option>
                  {batches.map((batch) => (
                    <option key={batch._id} value={batch._id}>
                      {batch.lotNumber} · {batch.quantityAvailable} units · expires {formatDate(batch.expiryDate)}
                    </option>
                  ))}
                </select>
                {errors.batchId && <p className="mt-1 text-sm text-red-500">{errors.batchId.message}</p>}
                {!batchesLoading && batches.length === 0 && (
                  <p className="mt-1 text-sm text-amber-400">Create a batch before adjusting this product.</p>
                )}
              </div>
              <Input
                label="Quantity Change"
                type="number"
                placeholder="+ to add, - to remove"
                {...register('quantityChange', {
                  valueAsNumber: true,
                  required: 'Required',
                  validate: (v) => Number(v) !== 0 || 'Cannot be zero'
                })}
                error={errors.quantityChange?.message}
              />
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-300">Reason <span className="text-red-500">*</span></label>
                <textarea
                  {...register('reason', { required: 'Reason is required' })}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-white placeholder-gray-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                  rows={3}
                  placeholder="Why this adjustment?"
                />
                {errors.reason && <p className="mt-1 text-sm text-red-500">{errors.reason.message}</p>}
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <Button type="button" variant="secondary" onClick={handleCloseModal}>Cancel</Button>
                <Button type="submit" disabled={adjustmentMutation.isPending || batches.length === 0}>
                  {adjustmentMutation.isPending ? 'Adjusting...' : 'Adjust Stock'}
                </Button>
              </div>
              {adjustmentMutation.isError && <Error message="Failed to adjust stock. Please try again." />}
            </form>
          )}
        </Modal>
      </div>
      <AdminMobileBottomNav active="inventory" />
    </AdminLayout>
  );
}

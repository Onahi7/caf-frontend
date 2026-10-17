import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Minus, Plus, SlidersHorizontal } from 'lucide-react';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { AdminPageHeader } from '../../components/admin';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { BranchSelector } from '../../components/BranchSelector';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { getErrorMessage } from '../../lib/error-utils';
import { formatDate, formatDateTime } from '../../lib/date-format';
import { Textarea } from '../../components/ui/Textarea';
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
  direction: 'add' | 'remove';
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

const formatDateCell = (value?: string) => (value ? formatDate(value) : '-');
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

  const { register, handleSubmit, reset, control, getValues, setValue, trigger, formState: { errors } } = useForm<AdjustmentFormData>({
    defaultValues: { direction: 'add' },
    mode: 'onChange',
  });
  const branchId = getBranchId(selectedBranch);

  const { data: batches = [], isLoading: batchesLoading, error: batchesError, refetch: refetchBatches } = useQuery({
    queryKey: [...queryKeys.batches.all(), 'adjustment', branchId, selectedProduct?._id],
    queryFn: async () => {
      const response = await apiClient.get(
        `/batches/branch/${branchId}/product/${selectedProduct?._id}`,
      );
      return (response.data?.data ?? response.data ?? []) as Batch[];
    },
    enabled: Boolean(branchId && selectedProduct?._id && isModalOpen),
  });

  const [direction, quantityInput, selectedBatchId] = useWatch({ control, name: ['direction', 'quantityChange', 'batchId'] });
  const quantity = Number(quantityInput);
  const selectedBatch = batches.find((batch) => batch._id === selectedBatchId);
  const signedQuantity = direction === 'remove' ? -quantity : quantity;
  const hasQuantity = Number.isFinite(quantity) && quantity > 0;
  const availableToRemove = Math.min(selectedProduct?.quantityAvailable ?? 0, selectedBatch?.quantityAvailable ?? 0);
  const exceedsStock = direction === 'remove' && hasQuantity && quantity > availableToRemove;

  // Products with pagination
  const { data: productsData, isLoading, error, refetch: refetchProducts } = useQuery({
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
    mutationFn: async (data: Omit<AdjustmentFormData, 'direction'>) =>
      apiClient.post('/inventory/adjust', { ...data, branchId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all(), exact: false });
      queryClient.invalidateQueries({ queryKey: queryKeys.batches.all(), exact: false });
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
      quantityChange: data.direction === 'remove' ? -Number(data.quantityChange) : Number(data.quantityChange),
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
  if (error) return <AdminLayout title="Stock Adjustments"><Error message="Failed to load products" onRetry={() => { void refetchProducts(); }} /></AdminLayout>;

  const productColumns = [
    { key: 'name', header: 'Product' },
    { key: 'sku', header: 'SKU' },
    { key: 'brand', header: 'Brand' },
    { key: 'quantityAvailable', header: 'Stock' },
    { key: 'supplierId', header: 'Supplier', render: (p: Product) => formatSupplier(p.supplierId) },
    { key: 'expiryDate', header: 'Expiry', render: (p: Product) => formatDateCell(p.expiryDate) },
    { key: 'actions', header: '', render: (p: Product) => <Button variant="secondary" size="sm" onClick={() => handleOpenModal(p)}>Adjust</Button> },
  ];

  const adjustmentColumns = [
    { key: 'timestamp', header: 'Date', render: (a: StockMovement) => formatDateTime(a.timestamp) },
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
              <p className="mt-1 text-sm leading-5 text-slate-400">
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
              className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-500/60 ${mobileTab === 'products' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
            >
              Product Stock
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobileTab === 'history'}
              onClick={() => setMobileTab('history')}
              className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-500/60 ${mobileTab === 'history' ? 'bg-emerald-500 text-slate-950 shadow' : 'text-slate-400 hover:text-white'}`}
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
                      <p className="mt-1 truncate text-xs text-slate-400">{product.sku} · {product.brand || 'No brand'}</p>
                      <p className="mt-1 truncate text-[11px] text-slate-500">{formatSupplier(product.supplierId)} · Exp {formatDateCell(product.expiryDate)}</p>
                    </div>
                    <div className="text-center">
                      <span className="block text-xl font-bold text-white">{product.quantityAvailable}</span>
                      <span className="text-[10px] uppercase tracking-wide text-slate-500">{product.unit || 'units'}</span>
                    </div>
                    <Button variant="secondary" size="sm" onClick={() => handleOpenModal(product)} className="!border-amber-400/70 !bg-amber-400/5 !px-2 !text-amber-300 hover:!bg-amber-400/15">
                      Adjust
                    </Button>
                  </article>
                ))}
              </div>
              {products.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-400">No products found for this branch.</p> : null}
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
                            <p className="mt-1 text-xs text-slate-400">{formatDateTime(adjustment.timestamp)}</p>
                          </div>
                          <span className={`shrink-0 text-lg font-bold ${adjustment.quantity > 0 ? 'text-emerald-300' : 'text-red-400'}`}>
                            {adjustment.quantity > 0 ? '+' : ''}{adjustment.quantity}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-5 text-slate-300">{adjustment.reason || 'No reason supplied'}</p>
                        <p className="mt-2 text-xs text-slate-500">By {adjustment.userId ? `${adjustment.userId.firstName || ''} ${adjustment.userId.lastName || ''}`.trim() || 'Unknown user' : 'Unknown user'}</p>
                      </article>
                    ))}
                  </div>
                  {paginatedAdjustments.length === 0 ? <p className="px-4 py-10 text-center text-sm text-slate-400">No stock adjustments have been recorded.</p> : null}
                  <CompactPagination meta={adjustmentPaginationMeta} onPageChange={setAdjPage} />
                </>
              )}
            </section>
          )}
        </div>

        <div className="hidden space-y-6 lg:block">
          <AdminPageHeader
            title="Stock Adjustments"
            subtitle="Review current inventory stock and record manual stock adjustments"
            actions={<BranchSelector />}
          />

          <Table
            data={products}
            columns={productColumns}
            title="Product Stock"
            pagination={productPaginationMeta}
            onPageChange={setProductPage}
            onLimitChange={handleProductLimitChange}
          />

          <Table
            data={paginatedAdjustments}
            columns={adjustmentColumns}
            title="Adjustment History"
            isLoading={adjustmentsLoading}
            pagination={adjustmentPaginationMeta}
            onPageChange={setAdjPage}
            onLimitChange={handleAdjLimitChange}
          />
        </div>

        <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Adjust Product Stock">
          {selectedProduct && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="rounded-2xl border border-white/[0.08] bg-slate-950/60 p-4 space-y-2 shadow-inner">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Selected Product</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-bold">
                    {selectedProduct.quantityAvailable ?? 0} in stock
                  </span>
                </div>
                <h3 className="text-base font-bold text-white tracking-tight">{selectedProduct.name}</h3>
                {selectedProduct.supplierId && (
                  <p className="text-xs text-slate-400">Supplier: <span className="text-slate-200 font-medium">{formatSupplier(selectedProduct.supplierId)}</span></p>
                )}
              </div>
              <div>
                <Select
                  label="Target Batch"
                  required
                  {...register('batchId', { required: 'Batch is required', onChange: () => { void trigger('quantityChange'); } })}
                  disabled={batchesLoading}
                  error={errors.batchId?.message}
                >
                  <option value="">{batchesLoading ? 'Loading batches…' : 'Select a batch'}</option>
                  {batches.map((batch) => (
                    <option key={batch._id} value={batch._id}>
                      {batch.lotNumber} · {batch.quantityAvailable} units · expires {formatDateCell(batch.expiryDate)}
                    </option>
                  ))}
                </Select>
                {batchesError && <Error message="Could not load batches. Try again before adjusting stock." onRetry={() => { void refetchBatches(); }} />}
                {!batchesLoading && !batchesError && batches.length === 0 && (
                  <p className="mt-1 text-xs text-amber-400 font-medium">Create a batch before adjusting this product.</p>
                )}
              </div>
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-200">Adjustment type</legend>
                <div className="grid grid-cols-2 gap-3">
                  {(['add', 'remove'] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      aria-pressed={direction === option}
                      onClick={() => { setValue('direction', option); void trigger('quantityChange'); }}
                      className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 ${direction === option ? (option === 'add' ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300' : 'border-rose-400 bg-rose-500/15 text-rose-300') : 'border-slate-700 bg-slate-900 text-slate-300'}`}
                    >
                      {option === 'add' ? <Plus className="h-5 w-5" aria-hidden="true" /> : <Minus className="h-5 w-5" aria-hidden="true" />}
                      {option === 'add' ? 'Add stock' : 'Remove stock'}
                    </button>
                  ))}
                </div>
              </fieldset>
              <Input
                label={direction === 'remove' ? 'Quantity to remove' : 'Quantity to add'}
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                required
                placeholder="Enter quantity"
                {...register('quantityChange', {
                  valueAsNumber: true,
                  required: 'Enter a quantity',
                  validate: (v) => {
                    if (!Number.isFinite(v) || v <= 0) return 'Enter a quantity greater than zero';
                    if (getValues('direction') === 'remove' && v > availableToRemove) return `Only ${availableToRemove} ${selectedProduct.unit || 'units'} can be removed from this batch`;
                    return true;
                  },
                })}
                error={errors.quantityChange?.message}
                helperText="Enter a positive amount; use the buttons above to add or remove stock."
              />
              {selectedBatch && hasQuantity && (
                <div role="status" aria-live="polite" className={`rounded-xl border p-3 text-sm ${exceedsStock ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-emerald-500/20 bg-emerald-500/5 text-slate-200'}`}>
                  {exceedsStock ? 'Not enough stock in the selected batch.' : (
                    <>
                      <p>Product stock: {selectedProduct.quantityAvailable} → <strong>{Number((selectedProduct.quantityAvailable + signedQuantity).toFixed(6))}</strong> {selectedProduct.unit || 'units'}</p>
                      <p className="mt-1">Batch {selectedBatch.lotNumber}: {selectedBatch.quantityAvailable} → <strong>{Number((selectedBatch.quantityAvailable + signedQuantity).toFixed(6))}</strong></p>
                    </>
                  )}
                </div>
              )}
              <Textarea
                label="Reason for Adjustment"
                required
                rows={3}
                placeholder="Explain reason for discrepancy (e.g. damaged during unpacking, expired batch writeoff, audit count correction)"
                error={errors.reason?.message}
                {...register('reason', { required: 'Reason is required', validate: (v) => !!v.trim() || 'Enter a reason for this adjustment' })}
              />
              <div className="flex justify-end space-x-3 pt-4 border-t border-white/[0.08]">
                <Button type="button" variant="secondary" onClick={handleCloseModal}>Cancel</Button>
                <Button 
                  type="submit" 
                  disabled={batchesLoading || !!batchesError || batches.length === 0 || exceedsStock}
                  isLoading={adjustmentMutation.isPending}
                >
                  {direction === 'remove' ? 'Remove Stock' : 'Add Stock'}
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

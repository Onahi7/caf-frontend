import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Search } from 'lucide-react';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { useToast } from '../../hooks/useToast';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { queryKeys } from '../../lib/query-keys';
import { useCurrency } from '../../hooks/useCurrency';
import { unwrapArray } from '../../lib/unwrap-response';

interface Batch {
  id: string;
  _id?: string;
  productId: string | { _id?: string; name?: string; sku?: string };
  productName: string;
  productSku: string;
  branchId: string | { _id?: string; name?: string; code?: string };
  branchName: string;
  lotNumber: string;
  expiryDate: string;
  quantityAvailable: number;
  quantityInitial: number;
  purchasePrice: number;
  sellingPrice: number;
  supplierId: string;
  supplierName?: string;
  isExpired: boolean;
  isDepleted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Product {
  id?: string;
  _id?: string;
  name: string;
  sku: string;
}

interface Supplier {
  id?: string;
  _id?: string;
  name: string;
}

interface Branch {
  id: string;
  _id?: string;
  name: string;
  code: string;
}

interface BatchFormData {
  productId: string;
  branchId: string;
  lotNumber: string;
  expiryDate: string;
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  supplierId: string | { _id?: string; name?: string };
}

const getEntityId = (value?: string | { _id?: string; id?: string }) =>
  typeof value === 'string' ? value : value?._id || value?.id || '';

const getOptionId = (value: { _id?: string; id?: string }) => value._id || value.id || '';

const normalizeBatch = (batch: any): Batch => {
  const product = batch.productId;
  const branch = batch.branchId;
  const supplier = batch.supplierId;

  return {
    ...batch,
    id: batch.id || batch._id,
    productName: batch.productName || (typeof product === 'object' ? product?.name : '') || '-',
    productSku: batch.productSku || (typeof product === 'object' ? product?.sku : '') || '-',
    branchName: batch.branchName || (typeof branch === 'object' ? branch?.name : '') || '-',
    supplierName: batch.supplierName || (typeof supplier === 'object' ? supplier?.name : '') || '-',
  };
};

export const BatchManagementPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [filterBranch, setFilterBranch] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [showExpiring, setShowExpiring] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();
  const { selectedBranch } = useBranchStore();
  const { showSuccess, showError } = useToast();
  const { format, symbol } = useCurrency();
  const branchId = getBranchId(selectedBranch);
  const activeBranchId = filterBranch || branchId || '';

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BatchFormData>();

  // Fetch batches with filters
  const { data: batches, isLoading, error } = useQuery({
    queryKey: queryKeys.batches.list({
      branchId: activeBranchId,
      productId: filterProduct,
      expiring: showExpiring,
    }),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (activeBranchId) params.branchId = activeBranchId;
      if (filterProduct) params.productId = filterProduct;
      if (showExpiring) params.expiring = '90'; // Show batches expiring in 90 days
      const response = await apiClient.get('/batches', { params });
      const payload = response.data?.data ?? response.data;
      return (Array.isArray(payload) ? payload : []).map(normalizeBatch);
    },
    enabled: !!branchId,
  });

  // Fetch products for dropdown
  const { data: products } = useQuery({
    queryKey: queryKeys.products.list({ branchId }),
    queryFn: async () => {
      const response = await apiClient.get('/products', {
        params: branchId ? { branchId } : {},
      });
      return unwrapArray<Product>(response.data);
    },
    enabled: !!branchId,
  });

  // Fetch suppliers for dropdown
  const { data: suppliers } = useQuery({
    queryKey: queryKeys.suppliers.list(),
    queryFn: async () => {
      const response = await apiClient.get('/suppliers');
      return unwrapArray<Supplier>(response.data);
    },
  });

  // Fetch branches for dropdown
  const { data: branches } = useQuery({
    queryKey: queryKeys.branches.list(),
    queryFn: async () => {
      const response = await apiClient.get('/branches');
      return unwrapArray<Branch>(response.data);
    },
  });

  // Create batch mutation
  const createMutation = useMutation({
    mutationFn: async (data: BatchFormData) => {
      const response = await apiClient.post('/batches', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.batches.all(), exact: false });
      setIsModalOpen(false);
      reset();
      showSuccess('Batch created');
    },
    onError: (err: any) => showError(err?.response?.data?.message ?? 'Failed to create batch'),
  });

  // Update batch mutation
  const updateMutation = useMutation({
    mutationFn: async (data: BatchFormData) => {
      if (!editingBatch) return;
      const response = await apiClient.patch(`/batches/${editingBatch.id}`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.batches.all(), exact: false });
      setIsModalOpen(false);
      setEditingBatch(null);
      reset();
      showSuccess('Batch updated');
    },
    onError: (err: any) => showError(err?.response?.data?.message ?? 'Failed to update batch'),
  });

  const filteredBatches = useMemo(() => {
    if (!batches) return [];
    const q = searchQuery.trim().toLowerCase();
    if (!q) return batches;
    return batches.filter((b) =>
      b.lotNumber.toLowerCase().includes(q) ||
      (b.productName && b.productName.toLowerCase().includes(q)) ||
      (b.supplierName && b.supplierName.toLowerCase().includes(q))
    );
  }, [batches, searchQuery]);

  const handleOpenModal = (batch?: Batch) => {
    if (batch) {
      setEditingBatch(batch);
      reset({
        productId: getEntityId(batch.productId),
        branchId: getEntityId(batch.branchId),
        lotNumber: batch.lotNumber,
        expiryDate: batch.expiryDate.split('T')[0],
        quantity: batch.quantityAvailable,
        purchasePrice: batch.purchasePrice,
        sellingPrice: batch.sellingPrice,
        supplierId: getEntityId(batch.supplierId),
      });
    } else {
      setEditingBatch(null);
      reset({
        productId: '',
        branchId: branchId || '',
        lotNumber: '',
        expiryDate: '',
        quantity: 0,
        purchasePrice: 0,
        sellingPrice: 0,
        supplierId: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingBatch(null);
    reset();
  };

  const onSubmit = (data: BatchFormData) => {
    if (editingBatch) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  // Calculate days until expiry
  const getDaysUntilExpiry = (expiryDate: string) => {
    const expiry = new Date(expiryDate);
    const today = new Date();
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  // Get expiry warning color
  const getExpiryWarning = (expiryDate: string, isExpired: boolean) => {
    if (isExpired) return { color: 'text-red-400', header: 'Expired' };
    const days = getDaysUntilExpiry(expiryDate);
    if (days <= 30) return { color: 'text-red-400', label: `${days}d` };
    if (days <= 60) return { color: 'text-orange-400', label: `${days}d` };
    if (days <= 90) return { color: 'text-yellow-400', label: `${days}d` };
    return { color: 'text-green-400', label: `${days}d` };
  };

  if (!branchId) {
    return (
      <AdminLayout title="Batch Management">
        <div className="text-center py-12">
          <h2 className="text-xl font-semibold text-white">Select a Branch First</h2>
          <p className="mt-2 text-gray-400">
            Batches are branch-scoped. Choose a branch before viewing or managing stock lots.
          </p>
        </div>
      </AdminLayout>
    );
  }

  if (isLoading) return <Loading />;
  if (error) return <Error message="Failed to load batches" />;

  const columns = [
    {
      key: 'product',
      header: 'Product',
      render: (batch: Batch) => (
        <div>
          <div className="font-medium whitespace-normal break-words max-w-xs">{batch.productName}</div>
          <div className="text-sm text-gray-400">SKU: {batch.productSku}</div>
        </div>
      ),
    },
    {
      key: 'batch',
      header: 'Batch Info',
      render: (batch: Batch) => (
        <div>
          <div className="text-sm">Lot: {batch.lotNumber}</div>
          <div className="text-xs text-gray-400">{batch.branchName}</div>
        </div>
      ),
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (batch: Batch) => (
        <div>
          <div className="font-medium">
            {batch.quantityAvailable} / {batch.quantityInitial}
          </div>
          {batch.isDepleted && (
            <span className="text-xs text-red-400">Depleted</span>
          )}
        </div>
      ),
    },
    {
      key: 'pricing',
      header: 'Pricing',
      render: (batch: Batch) => (
        <div className="text-sm">
          <div>Buy: {format(batch.purchasePrice)}</div>
          <div className="text-accent-green">Sell: {format(batch.sellingPrice)}</div>
        </div>
      ),
    },
    {
      key: 'expiry',
      header: 'Expiry',
      render: (batch: Batch) => {
        const warning = getExpiryWarning(batch.expiryDate, batch.isExpired);
        return (
          <div>
            <div className="text-sm">
              {new Date(batch.expiryDate).toLocaleDateString()}
            </div>
            <div className={`text-xs font-medium ${warning.color}`}>
              {warning.label}
            </div>
          </div>
        );
      },
    },
    {
      key: 'supplier',
      header: 'Supplier',
      render: (batch: Batch) => (
        <span className="text-sm">{batch.supplierName || '-'}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (batch: Batch) => (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => handleOpenModal(batch)}
          disabled={batch.isDepleted}
        >
          Edit
        </Button>
      ),
    },
  ];

  return (
    <AdminLayout title="Batch Management">
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Batches</h1>
            <p className="text-gray-400 mt-1">Manage inventory batches and expiry dates</p>
          </div>
          <Button onClick={() => handleOpenModal()}>
            Add Batch
          </Button>
        </div>

        {/* Filters */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-[38px] pointer-events-none" />
            <Input
              label="Search Batches"
              placeholder="Search by lot number, product..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            label="Filter by Branch"
            value={activeBranchId}
            onChange={(e) => setFilterBranch(e.target.value)}
            options={[
              ...(branches || []).map(branch => ({
                value: branch._id || branch.id,
                label: `${branch.name} (${branch.code})`,
              })),
            ]}
          />
          <Select
            label="Filter by Product"
            value={filterProduct}
            onChange={(e) => setFilterProduct(e.target.value)}
            options={[
              { value: '', label: 'All Products' },
              ...(products || []).map(product => ({
                value: getOptionId(product),
                label: `${product.name} (${product.sku})`,
              })),
            ]}
          />
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-white cursor-pointer">
              <input
                type="checkbox"
                checked={showExpiring}
                onChange={(e) => setShowExpiring(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-primary-dark text-accent-green focus:ring-accent-green"
              />
              <span>Show Expiring Soon (90 days)</span>
            </label>
          </div>
        </div>

        {/* Table */}
        <Table
          data={filteredBatches}
          columns={columns}
          emptyMessage={searchQuery ? "No batches match your search" : "No batches found"}
          exportFilename="batches"
          title="Product Batches"
        />

        {/* Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          title={editingBatch ? 'Edit Batch' : 'Add Batch'}
          size="lg"
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Product and Branch Selection */}
            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Product"
                {...register('productId', { required: 'Product is required' })}
                error={errors.productId?.message}
                options={[
                  { value: '', label: 'Select a product' },
                  ...(products || []).map(product => ({
                    value: getOptionId(product),
                    label: `${product.name} (${product.sku})`,
                  })),
                ]}
                disabled={!!editingBatch}
              />
              <Select
                label="Branch"
                {...register('branchId', { required: 'Branch is required' })}
                error={errors.branchId?.message}
                options={[
                  { value: '', label: 'Select a branch' },
                  ...(branches || []).map(branch => ({
                    value: branch._id || branch.id,
                    label: `${branch.name} (${branch.code})`,
                  })),
                ]}
                disabled={!!editingBatch}
              />
            </div>

            {/* Batch Details */}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Lot Number"
                {...register('lotNumber', { required: 'Lot number is required' })}
                error={errors.lotNumber?.message}
                placeholder="Enter lot number (e.g., LOT-2024-001)"
                disabled={!!editingBatch}
              />
              <Input
                label="Expiry Date"
                type="date"
                {...register('expiryDate', { required: 'Expiry date is required' })}
                error={errors.expiryDate?.message}
              />
            </div>

            <Input
              label={editingBatch ? 'Quantity' : 'Initial Quantity'}
              type="number"
              {...register('quantity', {
                required: 'Quantity is required',
                min: { value: 0, message: 'Must be 0 or greater' },
              })}
              error={errors.quantity?.message}
              placeholder={editingBatch ? 'Stock quantity is adjusted from Stock Adjustments' : 'Enter quantity'}
              disabled={!!editingBatch}
            />
            {editingBatch ? (
              <p className="text-xs text-gray-400">
                Quantity cannot be edited here. Use Stock Adjustments for stock corrections so the movement is audited.
              </p>
            ) : null}

            {/* Pricing */}
            <div className="grid grid-cols-2 gap-4">
              <Input
                label={`Purchase Price (${symbol})`}
                type="number"
                step="0.01"
                {...register('purchasePrice', {
                  required: 'Purchase price is required',
                  min: { value: 0, message: 'Must be 0 or greater' },
                })}
                error={errors.purchasePrice?.message}
                placeholder={`${symbol} 0.00`}
              />
              <Input
                label={`Selling Price (${symbol})`}
                type="number"
                step="0.01"
                {...register('sellingPrice', {
                  required: 'Selling price is required',
                  min: { value: 0, message: 'Must be 0 or greater' },
                })}
                error={errors.sellingPrice?.message}
                placeholder={`${symbol} 0.00`}
              />
            </div>

            {/* Supplier */}
            <Select
              label="Supplier"
              {...register('supplierId', { required: 'Supplier is required' })}
              error={errors.supplierId?.message}
              options={[
                { value: '', label: 'Select a supplier' },
                ...(suppliers || []).map(supplier => ({
                  value: getOptionId(supplier),
                  label: supplier.name,
                })),
              ]}
            />

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
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
                {editingBatch ? 'Update' : 'Create'} Batch
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
};



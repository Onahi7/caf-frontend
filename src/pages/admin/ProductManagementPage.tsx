import { useState, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { ChevronDown, ChevronRight, FileSpreadsheet, Trash2 } from 'lucide-react';
import apiClient from '../../lib/api-client';
import { unwrapArray } from '../../lib/unwrap-response';
import { AdminLayout } from '../../components/AdminLayout';
import { BranchSelector } from '../../components/BranchSelector';
import { AdminPageHeader, AdminStatusBadge } from '../../components/admin';
import { AdminMobileBottomNav } from '../../components/admin/AdminMobileBottomNav';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { CompactPagination } from '../../components/ui/Pagination';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Loading } from '../../components/ui/Loading';
import { Error as ErrorDisplay } from '../../components/ui/Error';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useCurrency } from '../../hooks/useCurrency';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAuthStore } from '../../stores/auth-store';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { useSearchWithDebounce } from '../../hooks/useSearchWithDebounce';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { usePagination } from '../../hooks/usePagination';
import { useBranchAwareCRUDMutations } from '../../hooks/useCRUDMutations';
import { saveProductImage, getProductImage } from '../../services/background-sync.service';
import { useToast } from '../../hooks/useToast';
import { getErrorMessage } from '../../lib/error-utils';
import {
  PACK_TYPE_OPTIONS,
  PRODUCT_CATEGORY_OPTIONS,
  PRODUCT_UNIT_OPTIONS,
} from '../../lib/product-options';

interface PackSize {
  code?: string;
  name: string;
  unit: string;
  quantityPerPack: number;
  sellingPrice: number;
  barcode?: string;
}

interface Product {
  _id: string;
  branchId?: string | { _id: string; name: string };
  name: string;
  sku: string;
  barcode: string;
  category: string;
  brand: string;
  unit: string;
  reorderLevel: number;
  basePrice: number;
  costPrice: number;
  suggestedRetailPrice: number;
  markupPercentage: number;
  requiresPrescription: boolean;
  isControlled: boolean;
  isActive: boolean;
  maxStockLevel?: number;
  quantityAvailable?: number;
  supplierId?: string | { _id: string; name: string };
  supplyDate?: string;
  expiryDate?: string;
  packSizes?: PackSize[];
  createdAt: string;
  updatedAt: string;
}

interface ProductFormData {
   name: string;
   sku: string;
   barcode: string;
   category: string;
   brand: string;
   unit: string;
   initialStock: number;
   initialExpiryDate?: string;
   initialSupplierId?: string;
   initialSupplyDate?: string;
   initialPurchasePrice?: number;
   initialSellingPrice?: number;
   basePrice: number;
   costPrice: number;
   suggestedRetailPrice: number;
   markupPercentage: number;
   requiresPrescription: boolean;
   isControlled: boolean;
   branchId: string;
   reorderLevel: number;
   maxStockLevel?: number;
   packSizes: PackSize[];
 }

interface Branch {
  _id: string;
  name: string;
  code: string;
  isActive: boolean;
}

type BranchesResponse = Branch[] | { data?: Branch[] };

interface Supplier {
  _id: string;
  name: string;
}

interface ProductImportError {
  row: number;
  productName: string;
  message: string;
}

interface ProductImportSummary {
  createdCount: number;
  failedCount: number;
  errors: ProductImportError[];
}

export const ProductManagementPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [wizardStep, setWizardStep] = useState<1 | 2>(1);
  const [productImage, setProductImage] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showPackSizeEditor, setShowPackSizeEditor] = useState(false);
  const [isExportingTemplate, setIsExportingTemplate] = useState(false);
  const [isExportingProducts, setIsExportingProducts] = useState(false);
  const [isImportingProducts, setIsImportingProducts] = useState(false);
  const [importSummary, setImportSummary] = useState<ProductImportSummary | null>(null);
  const fileInputRef = useState<HTMLInputElement | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const {
    value: searchQuery,
    setValue: setSearchQuery,
    debouncedValue: debouncedSearchQuery,
  } = useSearchWithDebounce('');

  const pagination = usePagination({ initialLimit: 20 });
  const queryClient = useQueryClient();
  const { format } = useCurrency();
  const { showSuccess, showError } = useToast();
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const currentUser = useAuthStore((state) => state.user);
  const branchId = getBranchId(selectedBranch);
  const canChooseBranch = currentUser?.role === 'super_admin' || !!selectedBranch?.isHeadquarters;

  const { createMutation, updateMutation, deleteMutation } = useBranchAwareCRUDMutations<Product>(
    'products',
    queryKeys.products.all(),
    branchId || '',
    {
      resourceLabel: 'Product',
      onCreateSuccess: () => {
        setIsModalOpen(false);
      },
      onUpdateSuccess: () => {
        setIsModalOpen(false);
        setEditingProduct(null);
      },
    }
  );

  useWebSocket({
    onInventoryUpdate: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all(), exact: false });
    },
  });

  const { register, handleSubmit, reset, watch, trigger, setValue, formState: { errors } } = useForm<ProductFormData>();
  const initialStock = Number(watch('initialStock') || 0);

  const { isAvailable: cameraAvailable, scanOnce } = useBarcodeScanner();

  const handleScanBarcode = async () => {
    const value = await scanOnce();
    if (value) setValue('barcode', value, { shouldValidate: true });
  };

  const generateSku = (name: string): string => {
    const parts = name
      .trim()
      .split(/\s+/)
      .map((w) => w.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 3))
      .filter(Boolean);
    const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
    return parts.length >= 2
      ? `${parts[0]}${parts[1]}${suffix}`
      : parts.length === 1
        ? `${parts[0]}${suffix}`
        : `PRD${suffix}`;
  };

  const normalizePackSizes = (packSizes: PackSize[] = []) =>
    packSizes
      .map((pack, index) => {
        const name = pack.name.trim();
        const unit = (pack.unit || name.toLowerCase().replace(/\s+/g, '-')).trim();
        const code =
          pack.code?.trim() ||
          `${unit || 'pack'}-${Number(pack.quantityPerPack) || 1}-${index + 1}`
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-');

        return {
          code,
          name,
          unit,
          quantityPerPack: Number(pack.quantityPerPack) || 1,
          sellingPrice: Number(pack.sellingPrice) || 0,
          barcode: pack.barcode?.trim() || undefined,
        };
      })
      .filter((pack) => pack.name && pack.unit);

  const toIsoDate = (value?: string) =>
    value ? new Date(`${value}T00:00:00.000Z`).toISOString() : undefined;

  const getEffectiveSellingPrice = (data: ProductFormData) =>
    Number(data.initialSellingPrice || data.suggestedRetailPrice || data.basePrice || 0);

  const { data: productsData, isLoading, error } = useQuery({
    queryKey: [
      'products',
      branchId,
      debouncedSearchQuery,
      pagination.state.page,
      pagination.state.limit,
    ],
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl('products', undefined), {
        params: {
          branchId,
          search: debouncedSearchQuery,
          page: pagination.state.page,
          limit: pagination.state.limit,
        },
      });
      return response.data;
    },
    enabled: !!branchId,
  });

  const products = productsData?.data || [];
  const total = productsData?.pagination?.total || 0;

  const { data: branches } = useQuery({
    queryKey: queryKeys.branches.list(),
    queryFn: async () => {
      const response = await apiClient.get<BranchesResponse>(buildApiUrl('branches', undefined));
      return unwrapArray<Branch>(response.data);
    },
    enabled: canChooseBranch,
  });

  const { data: suppliers } = useQuery({
    queryKey: ['suppliers', branchId],
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl('suppliers', undefined), {
        params: { branchId },
      });
      return (response.data?.data || []) as Supplier[];
    },
    enabled: !!branchId,
  });

  const handleCreateProduct = async (data: ProductFormData) => {
    const packSizes = normalizePackSizes(data.packSizes);
    const sellingPrice = getEffectiveSellingPrice(data);
    const costPrice = Number(data.initialPurchasePrice || data.costPrice || 0);
    const payload = {
      name: data.name,
      sku: data.sku,
      barcode: data.barcode,
      category: data.category,
      brand: data.brand,
      unit: data.unit,
      reorderLevel: data.reorderLevel,
      basePrice: data.basePrice,
      costPrice: data.costPrice,
      suggestedRetailPrice: data.suggestedRetailPrice,
      markupPercentage: data.markupPercentage,
      requiresPrescription: data.requiresPrescription,
      isControlled: data.isControlled,
      branchId: data.branchId,
      packSizes,
      initialStock: data.initialStock,
      initialExpiryDate: toIsoDate(data.initialExpiryDate),
      initialSupplierId: data.initialSupplierId || undefined,
      initialSupplyDate: data.initialSupplyDate || undefined,
      initialPurchasePrice: costPrice,
      initialSellingPrice: sellingPrice,
      maxStockLevel: data.maxStockLevel,
    };

    createMutation.mutate(payload as unknown as Omit<Product, '_id' | 'id'>, {
      onSuccess: async (response: any) => {
        const productId = response?.data?._id || response?._id;
        if (productId && productImage) {
          await saveProductImage(productId, productImage);
        }
        setProductImage(null);
        setImagePreview(null);
      },
    });
  };

  const handleUpdateProduct = (data: ProductFormData) => {
    if (!editingProduct) return;

    const sellingPrice = getEffectiveSellingPrice(data);
    const costPrice = Number(data.initialPurchasePrice || data.costPrice || 0);
    const payload = {
      name: data.name,
      sku: data.sku,
      barcode: data.barcode,
      category: data.category,
      brand: data.brand,
      unit: data.unit,
      reorderLevel: data.reorderLevel,
      maxStockLevel: data.maxStockLevel,
      basePrice: sellingPrice,
      costPrice,
      suggestedRetailPrice: sellingPrice,
      markupPercentage: data.markupPercentage,
      requiresPrescription: data.requiresPrescription,
      isControlled: data.isControlled,
      quantityAvailable: data.initialStock,
      supplierId: data.initialSupplierId || undefined,
      supplyDate: toIsoDate(data.initialSupplyDate),
      expiryDate: toIsoDate(data.initialExpiryDate),
      packSizes: normalizePackSizes(data.packSizes),
    };

    updateMutation.mutate({ id: editingProduct._id, data: payload });
  };

  const onSubmit = (data: ProductFormData) => {
    const packSizes = normalizePackSizes(data.packSizes);
    const duplicatePackBarcode = packSizes.find(
      (pack, index) =>
        pack.barcode &&
        packSizes.some(
          (other, otherIndex) =>
            otherIndex !== index && other.barcode === pack.barcode,
        ),
    );

    if (duplicatePackBarcode) {
      showError(`Pack barcode "${duplicatePackBarcode.barcode}" is used more than once.`);
      return;
    }

    const normalizedData: ProductFormData = {
      ...data,
      sku: data.sku?.trim() || generateSku(data.name),
      basePrice: getEffectiveSellingPrice(data),
      suggestedRetailPrice: getEffectiveSellingPrice(data),
      initialSellingPrice: getEffectiveSellingPrice(data),
      costPrice: Number(data.initialPurchasePrice || data.costPrice || 0),
      initialPurchasePrice: Number(data.initialPurchasePrice || data.costPrice || 0),
      packSizes,
    };

    if (editingProduct) {
      handleUpdateProduct(normalizedData);
      return;
    }

    handleCreateProduct(normalizedData);
  };

  const handleOpenModal = (product?: Product) => {
    setWizardStep(1);
    if (product) {
      const productBranchId =
        typeof product.branchId === 'string'
          ? product.branchId
          : product.branchId?._id || getBranchId(selectedBranch) || '';

      setEditingProduct(product);
      reset({
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        category: product.category,
        brand: product.brand,
        unit: product.unit,
        initialStock: product.quantityAvailable || 0,
        initialExpiryDate: product.expiryDate ? product.expiryDate.split('T')[0] : '',
        initialSupplierId:
          typeof product.supplierId === 'string'
            ? product.supplierId
            : product.supplierId?._id || '',
        initialSupplyDate: product.supplyDate ? product.supplyDate.split('T')[0] : '',
        initialPurchasePrice: product.costPrice || 0,
        initialSellingPrice: product.suggestedRetailPrice || product.basePrice || 0,
        basePrice: product.basePrice || 0,
        costPrice: product.costPrice || 0,
        suggestedRetailPrice: product.suggestedRetailPrice || 0,
        markupPercentage: product.markupPercentage || 0,
        requiresPrescription: product.requiresPrescription,
        isControlled: product.isControlled,
        reorderLevel: product.reorderLevel || 0,
        maxStockLevel: product.maxStockLevel || undefined,
        packSizes: product.packSizes || [],
        branchId: productBranchId,
      });
    } else {
      setEditingProduct(null);
      const defaultBranchId = getBranchId(selectedBranch) || '';
      reset({
        name: '',
        sku: '',
        barcode: '',
        category: '',
        brand: '',
        unit: 'piece',
        initialStock: 0,
        initialExpiryDate: '',
        initialSupplierId: '',
        initialSupplyDate: '',
        initialPurchasePrice: 0,
        initialSellingPrice: 0,
        basePrice: 0,
        costPrice: 0,
        suggestedRetailPrice: 0,
        markupPercentage: 0,
        requiresPrescription: false,
        isControlled: false,
        branchId: defaultBranchId,
        reorderLevel: 0,
        maxStockLevel: undefined,
        packSizes: [],
      });
    }
    setShowPackSizeEditor(!!product?.packSizes?.length);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingProduct(null);
    setWizardStep(1);
    setProductImage(null);
    setImagePreview(null);
    reset();
  };

  const handleNextStep = async () => {
    const fieldsToValidate: Array<keyof ProductFormData> = [
      'branchId',
      'name',
      'barcode',
      'category',
      'brand',
      'unit',
      'basePrice',
      'costPrice',
    ];
    const valid = await trigger(fieldsToValidate);
    if (valid) setWizardStep(2);
  };

  const handleDownloadTemplate = async () => {
    if (!branchId) return;

    setIsExportingTemplate(true);
    try {
      const response = await apiClient.get('/products/import-template', {
        params: { branchId },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'product-import-template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showSuccess('Product import template downloaded');
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to download product template'));
    } finally {
      setIsExportingTemplate(false);
    }
  };

  const handleExportProducts = async () => {
    if (!branchId) return;

    setIsExportingProducts(true);
    try {
      const response = await apiClient.get('/products/export', {
        params: { branchId },
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'products-export.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showSuccess('Products exported to Excel');
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to export products'));
    } finally {
      setIsExportingProducts(false);
    }
  };

  const handleImportProducts = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file || !branchId) {
      return;
    }

    setIsImportingProducts(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await apiClient.post<ProductImportSummary>(
        '/products/import',
        formData,
        {
          params: { branchId },
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );

      setImportSummary(response.data);
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all(),
        exact: false,
      });

      if (response.data.failedCount > 0) {
        showError(
          `Imported ${response.data.createdCount} product(s). ${response.data.failedCount} row(s) need attention.`,
        );
      } else {
        showSuccess(`Imported ${response.data.createdCount} product(s) successfully`);
      }
    } catch (error) {
      showError(getErrorMessage(error, 'Failed to import product Excel file'));
    } finally {
      setIsImportingProducts(false);
      event.target.value = '';
    }
  };

  if (!branchId) {
    return (
      <AdminLayout>
        <div className="rounded-2xl border border-white/10 bg-primary-dark/60 p-8 text-center">
          <h2 className="text-xl font-semibold text-white">Select a Branch First</h2>
          <p className="mt-2 text-gray-400">
            Products are branch-scoped. Choose a branch before viewing or managing products.
          </p>
          <div className="mx-auto mt-6 max-w-xs">
            <BranchSelector />
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (isLoading) return <AdminLayout><Loading /></AdminLayout>;
  if (error) return <AdminLayout><ErrorDisplay message="Failed to load products" /></AdminLayout>;

  const columns = [
    { key: 'name', header: 'Product Name' },
    { key: 'sku', header: 'SKU' },
    { key: 'category', header: 'Category' },
    { key: 'brand', header: 'Brand' },
    { 
      key: 'basePrice', 
      header: 'Selling Price',
      render: (product: Product) => format(product.basePrice || 0)
    },
    { 
      key: 'costPrice', 
      header: 'Cost Price',
      render: (product: Product) => format(product.costPrice || 0)
    },
    { key: 'unit', header: 'Unit' },
    {
      key: 'requiresPrescription',
      header: 'Prescription',
      render: (product: Product) => (
        product.requiresPrescription ? (
          <AdminStatusBadge tone="info">Required</AdminStatusBadge>
        ) : (
          <AdminStatusBadge>Not Required</AdminStatusBadge>
        )
      ),
    },
    {
      key: 'isControlled',
      header: 'Controlled',
      render: (product: Product) => (
        product.isControlled ? (
          <AdminStatusBadge tone="danger">Yes</AdminStatusBadge>
        ) : (
          <AdminStatusBadge>No</AdminStatusBadge>
        )
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      render: (product: Product) => (
        product.isActive ? (
          <AdminStatusBadge tone="success">Active</AdminStatusBadge>
        ) : (
          <AdminStatusBadge>Inactive</AdminStatusBadge>
        )
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (product: Product) => (
        <div className="flex items-center justify-end gap-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleOpenModal(product)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setProductToDelete(product)}
            className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
            title="Delete Product"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const paginationMeta = {
    page: pagination.state.page,
    limit: pagination.state.limit,
    total,
    pages: Math.ceil(total / pagination.state.limit),
    hasNext: pagination.state.page < Math.ceil(total / pagination.state.limit),
    hasPrev: pagination.state.page > 1,
  };

  return (
    <AdminLayout title="Products" showMobileBranchSelector={false}>
      <div className="space-y-6 pb-24 md:pb-0">
        <input
          ref={importInputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={handleImportProducts}
        />

        <div>
          <AdminPageHeader
            title="Products"
            subtitle={`${total} products catalogued`}
            actions={
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleExportProducts}
                  disabled={isExportingProducts}
                >
                  {isExportingProducts ? 'Exporting...' : 'Export Excel'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleDownloadTemplate}
                  disabled={isExportingTemplate}
                >
                  {isExportingTemplate ? 'Preparing...' : 'Excel Template'}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => importInputRef.current?.click()}
                  disabled={isImportingProducts}
                >
                  {isImportingProducts ? 'Importing...' : 'Import Excel'}
                </Button>
                <Button onClick={() => handleOpenModal()} className="shadow-lg shadow-emerald-500/15">
                  + Add Product
                </Button>
              </div>
            }
          />
        </div>

        {importSummary ? (
          <div className="rounded-2xl border border-white/10 bg-primary-dark/60 p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Latest Import</h2>
                <p className="text-sm text-gray-400">
                  Created {importSummary.createdCount} product(s), failed {importSummary.failedCount} row(s).
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setImportSummary(null)}
              >
                Clear
              </Button>
            </div>

            {importSummary.errors.length > 0 ? (
              <div className="mt-4 space-y-2">
                {importSummary.errors.slice(0, 5).map((item) => (
                  <div
                    key={`${item.row}-${item.productName}`}
                    className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-200"
                  >
                    Row {item.row} ({item.productName}): {item.message}
                  </div>
                ))}
                {importSummary.errors.length > 5 ? (
                  <p className="text-xs text-gray-400">
                    Showing 5 of {importSummary.errors.length} import issues.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex gap-4">
          <Input
            placeholder="Search products by name, SKU, barcode, brand..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
        </div>

        <Table
          columns={columns}
          data={products}
          onRowClick={handleOpenModal}
          pagination={paginationMeta}
          onPageChange={pagination.setPage}
          onLimitChange={pagination.setLimit}
          exportFilename="products"
          title="Product Inventory"
        />

        <Modal isOpen={isModalOpen} onClose={handleCloseModal} size="xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <h2 className="text-xl font-bold text-white">
              {editingProduct
                ? wizardStep === 1
                  ? 'Edit Product (Details)'
                  : 'Edit Product (Stock & Units)'
                : wizardStep === 1
                  ? 'Add Product (Step 1 of 2)'
                  : 'Add Product (Step 2 of 2)'}
            </h2>

            {wizardStep === 1 ? (
              <>
                {canChooseBranch ? (
                  <Select
                    label="Branch"
                    error={errors.branchId?.message}
                    {...register('branchId', { required: 'Branch is required' })}
                    disabled={!!editingProduct}
                  >
                    <option value="" className="bg-primary-dark text-white">Choose a branch...</option>
                    {branches?.map((branch) => (
                      <option key={branch._id} value={branch._id} className="bg-primary-dark text-white">
                        {branch.name}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <>
                    <input type="hidden" {...register('branchId', { required: 'Branch is required' })} />
                    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Outlet</p>
                      <p className="truncate text-sm font-semibold text-white">{selectedBranch?.name}</p>
                    </div>
                  </>
                )}

                <Input
                  label="Product Name"
                  {...register('name', { required: 'Product name is required' })}
                  error={errors.name?.message}
                />

                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    label="Barcode"
                    {...register('barcode', { required: 'Barcode is required' })}
                    error={errors.barcode?.message}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleScanBarcode}
                    disabled={!cameraAvailable}
                    className="sm:mt-8"
                  >
                    {cameraAvailable ? 'Scan' : 'No Camera'}
                  </Button>
                </div>

                <Input
                  label="SKU (auto-generated if empty)"
                  {...register('sku')}
                  placeholder="Auto-generate if empty"
                />

                <Select
                  label="Category"
                  error={errors.category?.message}
                  {...register('category', { required: 'Category is required' })}
                  options={[
                    { value: '', label: 'Select Category' },
                    ...PRODUCT_CATEGORY_OPTIONS,
                  ]}
                >
                </Select>

                <Input
                  label="Brand"
                  {...register('brand', { required: 'Brand is required' })}
                  error={errors.brand?.message}
                />

                <Select
                  label="Unit"
                  error={errors.unit?.message}
                  {...register('unit', { required: 'Unit is required' })}
                  options={[
                    { value: '', label: 'Select Unit' },
                    ...PRODUCT_UNIT_OPTIONS,
                  ]}
                >
                </Select>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Selling Price (per base unit)"
                    type="number"
                    step="0.01"
                    {...register('basePrice', {
                      required: 'Selling price is required',
                      min: { value: 0, message: 'Must be 0 or greater' },
                    })}
                    error={errors.basePrice?.message}
                  />

                  <Input
                    label="Cost Price"
                    type="number"
                    step="0.01"
                    {...register('costPrice', {
                      required: 'Cost price is required',
                      min: { value: 0, message: 'Must be 0 or greater' },
                    })}
                    error={errors.costPrice?.message}
                  />
                </div>

                <Input
                  label="Reorder Level"
                  type="number"
                  {...register('reorderLevel', {
                    min: { value: 0, message: 'Must be 0 or greater' },
                  })}
                  error={errors.reorderLevel?.message}
                />

                <Input
                  label="Maximum Stock Level (Optional)"
                  type="number"
                  min="0"
                  {...register('maxStockLevel', {
                    min: { value: 0, message: 'Must be 0 or greater' },
                  })}
                  error={errors.maxStockLevel?.message}
                />

                <div className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="requiresPrescription"
                      {...register('requiresPrescription')}
                      className="h-5 w-5 rounded border-gray-600 bg-primary-darker text-accent-green focus:ring-accent-green transition-colors"
                    />
                    <label htmlFor="requiresPrescription" className="ml-3 block text-sm font-medium text-white">
                      Requires Prescription
                    </label>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isControlled"
                      {...register('isControlled')}
                      className="h-5 w-5 rounded border-gray-600 bg-primary-darker text-accent-green focus:ring-accent-green transition-colors"
                    />
                    <label htmlFor="isControlled" className="ml-3 block text-sm font-medium text-white">
                      Controlled Substance
                    </label>
                  </div>
                </div>

                <div className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/5">
                  <label className="block text-sm font-medium text-white">Product Image</label>
                  <div className="flex items-start gap-4">
                    {imagePreview ? (
                      <div className="relative w-24 h-24 rounded-xl overflow-hidden border border-gray-600">
                        <img src={imagePreview} alt="Product" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => { setProductImage(null); setImagePreview(null); }}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          x
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-600 flex items-center justify-center">
                        <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                    <div className="flex flex-col gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        id="product-image-input"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              const dataUrl = reader.result as string;
                              setProductImage(dataUrl);
                              setImagePreview(dataUrl);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                      <label
                        htmlFor="product-image-input"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-accent-green/10 border border-accent-green/30 rounded-xl text-accent-green hover:bg-accent-green/20 transition-colors cursor-pointer text-sm font-medium"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {imagePreview ? 'Change Photo' : 'Take Photo / Upload'}
                      </label>
                      <p className="text-xs text-gray-400">Camera or gallery, stored locally</p>
                    </div>
                  </div>
                </div>
              </>
            ) : null}

            {wizardStep === 2 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label={editingProduct ? 'Current Total Stock' : 'Opening Stock'}
                    type="number"
                    min="0"
                    {...register('initialStock', { min: 0 })}
                    error={errors.initialStock?.message}
                  />

                  <Input
                    label={editingProduct ? 'Latest Purchase Price' : 'Purchase Price'}
                    type="number"
                    step="0.01"
                    {...register('initialPurchasePrice', {
                      min: { value: 0, message: 'Must be 0 or greater' },
                    })}
                    error={errors.initialPurchasePrice?.message}
                  />
                </div>

                <Input
                  label="Expiry Date"
                  type="date"
                  {...register('initialExpiryDate')}
                />

                <Input
                  label="Supply Date"
                  type="date"
                  {...register('initialSupplyDate')}
                />

                <Select
                  label="Supplier"
                  {...register('initialSupplierId')}
                >
                  <option value="" className="bg-primary-dark text-white">Select Supplier</option>
                  {suppliers?.map((supplier) => (
                    <option key={supplier._id} value={supplier._id} className="bg-primary-dark text-white">
                      {supplier.name}
                    </option>
                  ))}
                </Select>

                <Input
                  label={editingProduct ? 'Latest Selling Price' : 'Opening Selling Price'}
                  type="number"
                  step="0.01"
                  {...register('initialSellingPrice', {
                    min: { value: 0, message: 'Must be 0 or greater' },
                  })}
                  error={errors.initialSellingPrice?.message}
                  placeholder="Defaults to selling price above"
                />

                <div className="space-y-3 p-4 bg-white/5 rounded-xl border border-white/5">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium text-white">Pack Sizes / Unit Conversion</label>
                    <button
                      type="button"
                      onClick={() => setShowPackSizeEditor(!showPackSizeEditor)}
                      className="text-accent-green text-sm hover:underline"
                    >
                      {showPackSizeEditor ? 'Done' : 'Edit Pack Sizes'}
                    </button>
                  </div>
                  <div className="rounded-xl border border-accent-green/20 bg-accent-green/10 p-3 text-xs text-gray-300">
                    Add pack sizes when the same product is sold in larger or alternate units. Keep stock in the smallest unit above, then define conversions here: example base unit `tablet`, pack `Strip`, qty per pack `10`, selling price for one strip. If a box/strip/bottle has its own barcode, add it here so POS scans select that pack automatically.
                  </div>

                  {!showPackSizeEditor && watch('packSizes') && watch('packSizes').length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {watch('packSizes').map((pack: PackSize, idx: number) => (
                        <span key={idx} className="px-3 py-1.5 bg-primary-darker rounded-lg text-sm text-gray-300 border border-gray-600">
                          {pack.name} ({pack.quantityPerPack} x {pack.unit || watch('unit')}) - {format(pack.sellingPrice)}
                        </span>
                      ))}
                    </div>
                  )}

                  {showPackSizeEditor && (
                    <>
                      <div className="space-y-3">
                        {watch('packSizes').map((pack: PackSize, idx: number) => (
                          <div key={idx} className="flex items-start gap-2 p-3 bg-primary-darker rounded-lg border border-gray-700">
                            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2">
                              <select
                                value={pack.name}
                                onChange={(e) => {
                                  const updated = [...watch('packSizes')];
                                  const name = e.target.value;
                                  updated[idx] = {
                                    ...updated[idx],
                                    name,
                                    unit: name ? name.trim().toLowerCase().replace(/\s+/g, '-') : updated[idx].unit,
                                  };
                                  setValue('packSizes', updated as any);
                                }}
                                className="px-2 py-1.5 bg-primary-dark border border-gray-600 rounded text-white text-sm"
                              >
                                <option value="">Package type</option>
                                {PACK_TYPE_OPTIONS.map((option) => (
                                  <option key={option.value} value={option.value}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              <input
                                placeholder="Custom label"
                                value={pack.name}
                                onChange={(e) => {
                                  const updated = [...watch('packSizes')];
                                  updated[idx] = {
                                    ...updated[idx],
                                    name: e.target.value,
                                    unit: e.target.value.trim().toLowerCase().replace(/\s+/g, '-'),
                                  };
                                  setValue('packSizes', updated as any);
                                }}
                                className="px-2 py-1.5 bg-primary-dark border border-gray-600 rounded text-white text-sm"
                              />
                              <input
                                placeholder="Selling unit"
                                value={pack.unit}
                                onChange={(e) => {
                                  const updated = [...watch('packSizes')];
                                  updated[idx] = { ...updated[idx], unit: e.target.value };
                                  setValue('packSizes', updated as any);
                                }}
                                className="px-2 py-1.5 bg-primary-dark border border-gray-600 rounded text-white text-sm"
                              />
                              <input
                                placeholder="Stable code (optional)"
                                value={pack.code || ''}
                                onChange={(e) => {
                                  const updated = [...watch('packSizes')];
                                  updated[idx] = { ...updated[idx], code: e.target.value };
                                  setValue('packSizes', updated as any);
                                }}
                                className="px-2 py-1.5 bg-primary-dark border border-gray-600 rounded text-white text-sm"
                              />
                              <input
                                type="number"
                                placeholder="Qty per pack"
                                value={pack.quantityPerPack}
                                onChange={(e) => {
                                  const updated = [...watch('packSizes')];
                                  updated[idx] = { ...updated[idx], quantityPerPack: Number(e.target.value) };
                                  setValue('packSizes', updated as any);
                                }}
                                className="px-2 py-1.5 bg-primary-dark border border-gray-600 rounded text-white text-sm"
                              />
                              <input
                                placeholder="Pack barcode (optional)"
                                value={pack.barcode || ''}
                                onChange={(e) => {
                                  const updated = [...watch('packSizes')];
                                  updated[idx] = { ...updated[idx], barcode: e.target.value };
                                  setValue('packSizes', updated as any);
                                }}
                                className="px-2 py-1.5 bg-primary-dark border border-gray-600 rounded text-white text-sm"
                              />
                              <input
                                type="number"
                                placeholder="Price"
                                value={pack.sellingPrice}
                                onChange={(e) => {
                                  const updated = [...watch('packSizes')];
                                  updated[idx] = { ...updated[idx], sellingPrice: Number(e.target.value) };
                                  setValue('packSizes', updated as any);
                                }}
                                className="px-2 py-1.5 bg-primary-dark border border-gray-600 rounded text-white text-sm"
                              />
                              <div className="md:col-span-2 rounded-lg bg-black/20 px-3 py-2 text-xs text-gray-400">
                                {pack.name || 'Pack'} deducts {Number(pack.quantityPerPack) || 1} {watch('unit') || 'base units'} per sale. Unit price per {watch('unit') || 'base unit'}: {format((Number(pack.sellingPrice) || 0) / Math.max(1, Number(pack.quantityPerPack) || 1))}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const updated = watch('packSizes').filter((_: any, i: number) => i !== idx);
                                setValue('packSizes', updated as any);
                              }}
                              className="p-2 text-red-400 hover:text-red-300"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={() => {
                            const current = watch('packSizes') || [];
                            setValue('packSizes', [...current, { code: '', name: '', unit: '', quantityPerPack: 1, sellingPrice: 0 }] as any);
                          }}
                          className="w-full py-2 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition-colors text-sm"
                        >
                          + Add Pack Size
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : null}

            <div className="flex justify-end space-x-3 pt-6 border-t border-white/10">
              <Button
                type="button"
                variant="secondary"
                onClick={handleCloseModal}
              >
                Cancel
              </Button>

              {wizardStep === 1 ? (
                <Button type="button" onClick={handleNextStep}>
                  {editingProduct ? 'Advanced Stock & Units' : 'Next'}
                </Button>
              ) : null}

              {wizardStep === 2 ? (
                <>
                  <Button type="button" variant="secondary" onClick={() => setWizardStep(1)}>
                    Back
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending
                      ? 'Saving...'
                      : editingProduct
                        ? 'Update Product'
                        : 'Create Product'}
                  </Button>
                </>
              ) : null}
            </div>

            {(createMutation.isError || updateMutation.isError) && (
              <ErrorDisplay message="Failed to save product. Please try again." />
            )}
          </form>
        </Modal>
      </div>
      <AdminMobileBottomNav active="inventory" />
    </AdminLayout>
  );
};

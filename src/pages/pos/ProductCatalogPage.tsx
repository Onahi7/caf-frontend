import { useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../lib/api-client';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useCartStore } from '../../stores/cart-store';
import { useAuthStore } from '../../stores/auth-store';
import { getProductImage, handleImageError } from '../../lib/product-images';
import { useCurrency } from '../../hooks/useCurrency';
import { useAlertReplacement } from '../../hooks/useAlertReplacement';
import { useDebounce } from '../../hooks/useDebounce';
import { QRScannerModal } from '../../components/pos/QRScannerModal';
import { POSLayout } from '../../components/pos/POSLayout';
import { queryKeys } from '../../lib/query-keys';
import type { POSProduct } from '../../types/product';

type Category = 'all' | 'otc' | 'prescription' | 'vitamins' | 'supplies';

const getDisplayBrand = (brand?: string) => {
  const trimmed = brand?.trim();
  return trimmed && trimmed.toLowerCase() !== 'unknown' ? trimmed : null;
};

export const ProductCatalogPage = () => {
  const navigate = useNavigate();
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const user = useAuthStore((state) => state.user);
  const { items, addItem, total } = useCartStore();
  const { format } = useCurrency();
  const { alertInfo, alertError, alertWarning } = useAlertReplacement();

  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [showScanner, setShowScanner] = useState(false);
  const branchId = getBranchId(selectedBranch);
  const productsPerPage = 24;

  const terminalId = 'TERMINAL-01';

  const { data: currentShift } = useQuery({
    queryKey: queryKeys.shifts.current({
      branchId,
      cashierId: user?.id,
      terminalId,
    }),
    queryFn: async () => {
      if (!branchId || !user?.id) {
        throw new Error('Missing required parameters: branchId and cashierId');
      }
      const response = await apiClient.get('/shifts/current', {
        params: { branchId, cashierId: user.id, terminalId },
      });
      return (response.data?.data ?? response.data) as { _id: string; status: 'open' | 'closed' };
    },
    enabled: !!branchId && !!user?.id,
    retry: false,
  });

  const isShiftOpen = currentShift?.status === 'open';

  const {
    data: productsResponse,
    isLoading,
    isFetchingNextPage,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.products.list({
      branchId,
      search: debouncedSearchQuery,
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      limit: productsPerPage,
    }),
    queryFn: async ({ pageParam = 1 }) => {
      if (!branchId) throw new Error('Branch ID is required');
      const params: Record<string, string | number> = {
        branchId,
        page: pageParam,
        limit: productsPerPage,
      };
      if (debouncedSearchQuery) params.search = debouncedSearchQuery;
      if (selectedCategory !== 'all') params.category = selectedCategory;
      const response = await apiClient.get('/products', { params });
      return response.data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const meta = lastPage?.pagination;
      return meta?.hasNext ? meta.page + 1 : undefined;
    },
    enabled: !!branchId,
  });

  const products = useMemo(
    () => productsResponse?.pages.flatMap((page) => page.data || []) as POSProduct[] || [],
    [productsResponse],
  );
  const paginationMeta = productsResponse?.pages.at(-1)?.pagination as
    | { page: number; limit: number; total: number; pages: number; hasNext: boolean; hasPrev: boolean }
    | undefined;

  const categories: { id: Category; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'otc', label: 'OTC' },
    { id: 'prescription', label: 'Prescription' },
    { id: 'vitamins', label: 'Vitamins' },
  ];

  const catalogSummary = useMemo(() => {
    if (!paginationMeta) return '';
    return `Showing ${products.length} of ${paginationMeta.total} products`;
  }, [paginationMeta, products.length]);

  const handleAddToCart = (product: POSProduct) => {
    if (product.stock <= 0) {
      alertWarning(`${product.name} is out of stock`);
      return;
    }

    if (!isShiftOpen) {
      alertWarning('Open a shift before adding products to the cart');
      return;
    }

    const packSizes = product.packSizes || [];
    const matchedPack = product.matchedPackSize;

    if (matchedPack) {
      addItem({
        productId: product._id,
        productName: product.name,
        brand: product.brand,
        sku: product.sku,
        barcode: matchedPack.barcode || product.barcode || '',
        quantity: 1,
        unitPrice: matchedPack.sellingPrice,
        requiresPrescription: product.requiresPrescription,
        packSize: matchedPack,
        baseUnit: product.unit || 'unit',
        quantityInBaseUnits: matchedPack.quantityPerPack,
      });
    } else if (packSizes.length > 0) {
      const smallestPack = [...packSizes].sort((a, b) => a.quantityPerPack - b.quantityPerPack)[0];
      addItem({
        productId: product._id,
        productName: product.name,
        brand: product.brand,
        sku: product.sku,
        barcode: smallestPack.barcode || product.barcode || '',
        quantity: 1,
        unitPrice: smallestPack.sellingPrice,
        requiresPrescription: product.requiresPrescription,
        packSize: smallestPack,
        baseUnit: product.unit || 'unit',
        quantityInBaseUnits: smallestPack.quantityPerPack,
      });
    } else {
      addItem({
        productId: product._id,
        productName: product.name,
        brand: product.brand,
        sku: product.sku,
        barcode: product.barcode || '',
        quantity: 1,
        unitPrice: product.price,
        requiresPrescription: product.requiresPrescription,
        baseUnit: product.unit || 'unit',
        quantityInBaseUnits: 1,
      });
    }
  };

  const handleBarcodeScan = async (barcode: string) => {
    try {
      const response = await apiClient.get('/products', {
        params: { branchId, barcode },
      });
      const product = (response.data?.data ?? response.data)[0] as POSProduct | undefined;
      if (!product) {
        alertError('Product not found');
        return;
      }
      if (product.stock <= 0) {
        alertError(`${product.name} is out of stock`);
        return;
      }
      if (!isShiftOpen) {
        alertWarning('Open a shift before adding products to the cart');
        return;
      }
      handleAddToCart(product);
      alertInfo(`Added ${product.name} to cart`);
    } catch {
      alertError('Failed to find product');
    }
  };

  const cartItemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <POSLayout title="Product Catalog" hideHeader>
      <div className="min-h-screen bg-slate-950 flex flex-col pt-safe-top">
        <div className="px-4 py-4 border-b border-white/[0.08]">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => navigate('/pos')} className="text-white min-w-11 min-h-11 flex items-center justify-center -ml-2 rounded-lg hover:bg-white/5" aria-label="Back to POS">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div className="text-center">
              <h1 className="text-lg font-bold text-white">{selectedBranch?.name || 'Main Pharmacy'}</h1>
            </div>
            <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-slate-950 font-bold">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex-1 relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products by name, brand, SKU, or barcode..."
                className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <button onClick={() => setShowScanner(true)} className="p-3 bg-slate-900 border border-white/10 rounded-xl text-white" aria-label="Scan barcode">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
            </button>
          </div>

          <div className="flex space-x-2 mt-4 overflow-x-auto pb-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 text-white border border-emerald-500'
                    : 'bg-emerald-500/15 text-emerald-400'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          {catalogSummary ? (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
              <span>{catalogSummary}</span>
            </div>
          ) : null}

          {isLoading ? (
            <div className="text-center py-8 text-slate-400">Loading products...</div>
          ) : products.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4">
              {products.map((product) => (
                <div
                  key={product._id}
                  className="bg-slate-900 rounded-2xl overflow-hidden relative"
                >
                  <div className="aspect-square relative">
                    <img
                      src={getProductImage(product)}
                      alt={product.name}
                      onError={handleImageError}
                      className={`w-full h-full object-cover ${product.stock <= 0 ? 'opacity-50' : ''}`}
                    />
                    {product.stock <= 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="px-3 py-1 bg-slate-800/80 text-white text-sm rounded-full">
                          Out of Stock
                        </span>
                      </div>
                    )}
                    {product.stock > 0 && (
                      <button
                        onClick={() => handleAddToCart(product)}
                        className="absolute bottom-2 right-2 w-12 h-12 bg-slate-950/80 rounded-lg flex items-center justify-center text-emerald-400 hover:bg-slate-950 transition-colors"
                        aria-label={`Add ${product.name} to cart`}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="p-3 bg-slate-950">
                    <h3 className="text-white font-medium text-sm leading-snug whitespace-normal break-words">{product.name}</h3>
                    {getDisplayBrand(product.brand) && (
                      <p className="mt-1 rounded-md bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-400 whitespace-normal break-words">
                        Brand: {getDisplayBrand(product.brand)}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-slate-400 whitespace-normal break-words">{product.category}</p>
                    <p className="mt-1 text-emerald-400 font-bold">{format(product.price)}</p>
                  </div>
                </div>
                ))}
              </div>
              {hasNextPage && (
                <button
                  type="button"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="mt-5 w-full rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-400 disabled:opacity-60"
                >
                  {isFetchingNextPage ? 'Loading more...' : 'Load more products'}
                </button>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-slate-400">No products found</div>
          )}
        </div>

        {cartItemCount > 0 && (
          <div className="p-4 bg-slate-900 border-t border-white/[0.1]">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-white font-bold">{cartItemCount} Items</span>
                <p className="text-emerald-400 text-sm">Subtotal: {format(total)}</p>
              </div>
              <button
                onClick={() => navigate('/pos/payment')}
                className="flex items-center px-6 py-3 bg-emerald-500 hover:bg-emerald-400 rounded-xl text-slate-950 font-bold transition-colors"
              >
                Checkout
                <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </button>
            </div>
          </div>
        )}

        <QRScannerModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          onScan={handleBarcodeScan}
          title="Scan Product Barcode"
        />
      </div>
    </POSLayout>
  );
};

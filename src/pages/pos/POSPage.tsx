import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInfiniteQuery, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../lib/api-client';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useCartStore, itemKey, type CartItem } from '../../stores/cart-store';
import { useHeldSalesStore, type HeldSale } from '../../stores/held-sales-store';
import { useAuthStore } from '../../stores/auth-store';
import { useWebSocket } from '../../hooks/useWebSocket';
import { useCurrency } from '../../hooks/useCurrency';
import { useAlertReplacement } from '../../hooks/useAlertReplacement';
import { useBarcodeScanner } from '../../hooks/useBarcodeScanner';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import { OfflineIndicator, POSLayout } from '../../components/pos';
import { getProductImage, handleImageError } from '../../lib/product-images';
import { UserProfileModal } from '../../components/pos/UserProfileModal';
import { ParkedSalesBar } from '../../components/pos/ParkedSalesBar';
import { QuickKeysGrid } from '../../components/pos/QuickKeysGrid';
import type { QuickKeyProduct } from '../../stores/quick-keys-store';
import { queryKeys } from '../../lib/query-keys';
import {
  Search,
  ScanLine,
  LayoutGrid,
  List as ListIcon,
  Minus,
  Plus,
  Trash2,
  X,
  ShoppingBag,
  Percent,
  ArrowRight,
  Package,
} from 'lucide-react';

interface Shift {
  _id: string;
  status: 'open' | 'closed';
  openedAt: string;
  openingCash: number;
  expectedCash?: number;
  totalSales?: number;
}

interface Expense {
  _id: string;
  amount: number;
}

interface ShiftSale {
  _id: string;
  total: number;
}

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
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  brand?: string;
  price: number;
  imageUrl?: string;
  stock: number;
  requiresPrescription: boolean;
  unit: string;
  packSizes?: PackSize[];
  matchedPackSize?: PackSize;
}

const getDisplayBrand = (brand?: string) => {
  const trimmed = brand?.trim();
  return trimmed && trimmed.toLowerCase() !== 'unknown' ? trimmed : 'No brand set';
};

export const POSPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const user = useAuthStore((state) => state.user);
  const { alertInfo, alertWarning } = useAlertReplacement();
  const { 
    items, 
    addItem, 
    removeItem, 
    updateQuantity, 
    total, 
    subtotal, 
    discount 
  } = useCartStore();
  const heldSales = useHeldSalesStore((s) => s.heldSales);
  const recallHeldSale = useHeldSalesStore((s) => s.recallSale);
  const discardHeldSale = useHeldSalesStore((s) => s.discardSale);
  const restoreCart = useCartStore((s) => s.restoreCart);
  const { showSuccess, showError } = useToast();
  const requestConfirmation = useConfirm();
  const { format, symbol } = useCurrency();
  
  // Helper to convert stock to readable units
  const getStockDisplay = (stock: number, unit: string, packSizes?: PackSize[]): string => {
    if (!packSizes || packSizes.length === 0) {
      return `${stock} ${unit}s`;
    }
    
    // Sort pack sizes by quantity descending (largest first)
    const sorted = [...packSizes].sort((a, b) => b.quantityPerPack - a.quantityPerPack);
    
    // Check if this is a size variant pack (all have qty 1)
    const allSizeVariants = sorted.every(p => p.quantityPerPack === 1);
    
    if (allSizeVariants) {
      // For size variants, show count and available sizes
      const availableSizes = sorted.filter(p => stock >= p.quantityPerPack).map(p => p.name);
      if (availableSizes.length > 0) {
        return `${stock} (${availableSizes.join(', ')})`;
      }
      return `${stock} ${unit}s`;
    }
    
    // Regular pack sizes with quantity > 1
    const largestPack = sorted.find(p => p.quantityPerPack > 1);
    if (!largestPack) {
      return `${stock} ${unit}s`;
    }
    
    // Calculate packs and remaining
    const packs = Math.floor(stock / largestPack.quantityPerPack);
    const remaining = stock % largestPack.quantityPerPack;
    
    if (packs > 0 && remaining > 0) {
      return `${packs} ${largestPack.name}(s), ${remaining} ${unit}s`;
    } else if (packs > 0) {
      return `${packs} ${largestPack.name}(s)`;
    } else {
      return `${stock} ${unit}s`;
    }
  };
  
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [closeShiftNotes, setCloseShiftNotes] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('supplies');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [stockWarning, setStockWarning] = useState<{ productId: string; message: string } | null>(null);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [scanMode, setScanMode] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<{ message: string; ok: boolean } | null>(null);
  const [showPackSizeModal, setShowPackSizeModal] = useState(false);
  const [selectedProductForPack, setSelectedProductForPack] = useState<Product | null>(null);
  const [productViewMode, setProductViewMode] = useState<'grid' | 'list'>('grid');
  const scanFeedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { isAvailable: cameraAvailable, startContinuousScan, stopContinuousScan } = useBarcodeScanner();

  const terminalId = 'TERMINAL-01';

  const productsPerPage = 48;

  // Get products
  const {
    data: productsResponse,
    isLoading: loadingProducts,
    isFetchingNextPage: loadingMoreProducts,
    fetchNextPage,
    hasNextPage,
  } = useInfiniteQuery({
    queryKey: queryKeys.products.list({
      branchId: getBranchId(selectedBranch),
      search: debouncedSearchQuery,
      category: selectedCategory !== 'all' ? selectedCategory : undefined,
      limit: productsPerPage,
    }),
    queryFn: async ({ pageParam = 1 }) => {
      const branchId = getBranchId(selectedBranch);
      
      if (!branchId) {
        throw new Error('Branch ID is required');
      }
      
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
    enabled: !!getBranchId(selectedBranch),
    retry: false,
  });

  const products = useMemo(
    () => (productsResponse?.pages.flatMap((page) => page.data || []) as Product[] | undefined) ?? [],
    [productsResponse],
  );
  const productsPagination = productsResponse?.pages.at(-1)?.pagination as
    | { total: number; page: number; limit: number; pages: number; hasNext: boolean }
    | undefined;

  // Get current shift
  const { data: currentShift, refetch: refetchCurrentShift } = useQuery({
    queryKey: queryKeys.shifts.current({
      branchId: getBranchId(selectedBranch),
      cashierId: user?.id,
      terminalId,
    }),
    queryFn: async () => {
      const branchId = getBranchId(selectedBranch);
      const cashierId = user?.id;
      
      if (!branchId || !cashierId) {
        throw new Error('Missing required parameters: branchId and cashierId');
      }
      
      const response = await apiClient.get('/shifts/current', {
        params: { branchId, cashierId, terminalId },
      });
      return (response.data?.data ?? response.data) as Shift;
    },
    enabled: !!getBranchId(selectedBranch) && !!user?.id,
    retry: false,
  });

  const { data: shiftExpenses } = useQuery({
    queryKey: queryKeys.expenses.shift(currentShift?._id),
    queryFn: async () => {
      if (!currentShift?._id) return [] as Expense[];
      const response = await apiClient.get(`/expenses/shift/${currentShift._id}`);
      const payload = response.data?.data ?? response.data;
      return (Array.isArray(payload) ? payload : []) as Expense[];
    },
    enabled: !!currentShift?._id && currentShift?.status === 'open',
    retry: false,
  });

  const { data: shiftSales } = useQuery({
    queryKey: queryKeys.sales.list({ branchId: getBranchId(selectedBranch), search: currentShift?._id }),
    queryFn: async () => {
      const branchId = getBranchId(selectedBranch);
      if (!currentShift?._id || !branchId) return [] as ShiftSale[];
      const response = await apiClient.get('/sales', {
        params: { shiftId: currentShift._id, branchId, limit: 500 },
      });
      const payload = response.data?.data ?? response.data;
      return (Array.isArray(payload) ? payload : []) as ShiftSale[];
    },
    enabled: !!currentShift?._id && currentShift?.status === 'open' && !!getBranchId(selectedBranch),
    retry: false,
  });

  // Handle a barcode value from the continuous scanner
  const handleBarcodeScan = useCallback(async (barcode: string) => {
    const branchId = getBranchId(selectedBranch);
    if (!branchId) return;

    // 1. Look up in already-loaded products list first (fast path)
    let found: Product | undefined = products?.find(
      (p) =>
        p.barcode === barcode ||
        p.sku === barcode ||
        p.packSizes?.some((pack) => pack.barcode === barcode),
    );
    if (found) {
      const matchedPackSize = found.packSizes?.find((pack) => pack.barcode === barcode);
      found = matchedPackSize ? { ...found, matchedPackSize } : found;
    }

    // 2. Fallback: query API by barcode
    if (!found) {
      try {
        const res = await apiClient.get('/products', {
          params: { branchId, barcode },
        });
        const list = (res.data?.data ?? res.data) as Product[];
        found = list[0];
      } catch {
        // ignore
      }
    }

    if (!found) {
      setScanFeedback({ message: `No product for barcode: ${barcode}`, ok: false });
    } else if (found.stock <= 0) {
      setScanFeedback({ message: `${found.name} - out of stock`, ok: false });
    } else {
      if (!currentShift || currentShift.status !== 'open') {
        setShowShiftModal(true);
        setScanFeedback({ message: 'Open a shift before adding scanned products', ok: false });
      } else {
        // Check if product has pack sizes - if so, show selector
        if (found.matchedPackSize) {
          handleAddToCart(found, found.matchedPackSize);
          setScanFeedback({ message: `Added: ${found.name} (${found.matchedPackSize.name})`, ok: true });
        } else if (found.packSizes && found.packSizes.length > 0) {
          setSelectedProductForPack(found);
          setShowPackSizeModal(true);
          setScanFeedback({ message: `Select pack size for: ${found.name}`, ok: true });
        } else {
          addItem({
            productId: found._id,
            productName: found.name,
            brand: found.brand,
            sku: found.sku,
            barcode: found.barcode || '',
            quantity: 1,
            unitPrice: found.price,
            requiresPrescription: found.requiresPrescription,
            baseUnit: found.unit || 'unit',
            quantityInBaseUnits: 1,
          });
          setScanFeedback({ message: `Added: ${found.name}`, ok: true });
        }
      }
    }

    if (scanFeedbackTimeout.current) clearTimeout(scanFeedbackTimeout.current);
    scanFeedbackTimeout.current = setTimeout(() => setScanFeedback(null), 2500);
  }, [addItem, currentShift, products, selectedBranch]);

  const toggleScanMode = useCallback(async () => {
    if (scanMode) {
      await stopContinuousScan();
      setScanMode(false);
      setScanFeedback(null);
    } else {
      await startContinuousScan(handleBarcodeScan);
      setScanMode(true);
    }
  }, [scanMode, startContinuousScan, stopContinuousScan, handleBarcodeScan]);

  // Stop scan when component unmounts
  useEffect(() => {
    return () => {
      stopContinuousScan();
    };
  }, [stopContinuousScan]);

  // WebSocket for real-time stock updates (Task 22.2)
  const handleInventoryUpdate = useCallback((update: { productId: string; quantityAvailable: number; updateType: string }) => {
    // Invalidate products query to refresh stock levels
    queryClient.invalidateQueries({ queryKey: queryKeys.products.all(), exact: false });
    
    // Check if any cart items are affected
    const affectedItem = items.find(item => item.productId === update.productId);
    if (affectedItem && update.quantityAvailable < affectedItem.quantity) {
      setStockWarning({
        productId: update.productId,
        message: `Stock for "${affectedItem.productName}" has changed. Only ${update.quantityAvailable} available.`,
      });
      // Auto-dismiss after 5 seconds
      setTimeout(() => setStockWarning(null), 5000);
    }
  }, [queryClient, items]);

  const { isConnected: wsConnected } = useWebSocket({
    onInventoryUpdate: handleInventoryUpdate,
  });

  // Cart handlers
  const handleQuantityIncrement = (productId: string, packSize: PackSize | undefined, currentQuantity: number) => {
    updateQuantity(productId, currentQuantity + 1, packSize);
  };

  const handleQuantityDecrement = (productId: string, packSize: PackSize | undefined, currentQuantity: number) => {
    if (currentQuantity > 1) {
      updateQuantity(productId, currentQuantity - 1, packSize);
    } else {
      removeItem(productId, packSize);
    }
  };

  const handleQuantityChange = (productId: string, packSize: PackSize | undefined, value: string) => {
    const qty = parseInt(value);
    if (!isNaN(qty) && qty > 0) {
      updateQuantity(productId, qty, packSize);
    }
  };

  // Open shift mutation
  const openShiftMutation = useMutation({
    mutationFn: async (data: { openingCash: number }) => {
      const branchId = getBranchId(selectedBranch);
      const cashierId = user?.id;
      
      if (!branchId || !cashierId) {
        throw new Error('Missing required parameters: branchId and cashierId');
      }
      
      const response = await apiClient.post('/shifts/open', {
        branchId,
        terminalId,
        cashierId,
        openingCash: data.openingCash,
      });
      return (response.data?.data ?? response.data) as Shift;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all(), exact: false });
      setShowShiftModal(false);
      setOpeningCash('');
      refetchCurrentShift();
    },
    onError: async (error: unknown) => {
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status?: number }; message?: string };
        if (axiosError.response?.status === 409) {
          queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all(), exact: false });
          await refetchCurrentShift();
          setShowShiftModal(false);
          alertInfo('An active shift already exists for this cashier. Loaded existing shift.');
          return;
        }
        alertWarning(axiosError.message || 'Failed to open shift. Please try again.');
        return;
      }

      alertWarning(error instanceof Error ? error.message : 'Failed to open shift. Please try again.');
    },
  });

  // Close shift mutation
  const closeShiftMutation = useMutation({
    mutationFn: async (data: { shiftId: string; closingCash: number; notes?: string }) => {
      if (!data.shiftId) {
        throw new Error('Shift ID is required');
      }

      if (isNaN(data.closingCash) || data.closingCash < 0) {
        throw new Error('Valid closing cash amount is required');
      }

      const response = await apiClient.post(`/shifts/${data.shiftId}/close`, {
        closingCash: data.closingCash,
        notes: data.notes,
        totalSales,
      });
      return (response.data?.data ?? response.data) as Shift;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all(), exact: false });
      setShowCloseShiftModal(false);
      setClosingCash('');
      setCloseShiftNotes('');
      refetchCurrentShift();
      alertInfo('Shift closed successfully');
    },
    onError: (error: unknown) => {
      alertWarning(error instanceof Error ? error.message : 'Failed to close shift. Please try again.');
    },
  });

  // Create expense mutation
  const createExpenseMutation = useMutation({
    mutationFn: async (data: { amount: number; category: string; description: string }) => {
      const branchId = getBranchId(selectedBranch);
      const recordedBy = user?.id;

      if (!currentShift || !branchId || !recordedBy) {
        throw new Error('Missing required data');
      }

      const response = await apiClient.post('/expenses', {
        branchId,
        shiftId: currentShift._id,
        recordedBy,
        amount: data.amount,
        category: data.category,
        description: data.description,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all(), exact: false });
      setShowExpenseModal(false);
      setExpenseAmount('');
      setExpenseCategory('supplies');
      setExpenseDescription('');
      alertInfo('Expense recorded successfully');
    },
    onError: (error: unknown) => {
      alertWarning(error instanceof Error ? error.message : 'Failed to record expense. Please try again.');
    },
  });

  const handleOpenShift = () => {
    const amount = parseFloat(openingCash);
    if (isNaN(amount) || amount < 0) return;
    openShiftMutation.mutate({ openingCash: amount });
  };

  const handleCloseShift = () => {
    if (!currentShift) {
      alertWarning('No active shift found.');
      return;
    }

    const amount = parseFloat(closingCash);
    if (isNaN(amount) || amount < 0) {
      alertWarning('Please enter a valid closing cash amount.');
      return;
    }

    closeShiftMutation.mutate({
      shiftId: currentShift._id,
      closingCash: amount,
      notes: closeShiftNotes || undefined,
    });
  };

  const handleCreateExpense = () => {
    if (!currentShift || currentShift.status !== 'open') {
      alertWarning('Open a shift before logging expenses.');
      return;
    }

    const amount = parseFloat(expenseAmount);
    if (isNaN(amount) || amount <= 0) {
      alertWarning('Enter a valid expense amount.');
      return;
    }

    if (!expenseDescription.trim()) {
      alertWarning('Expense description is required.');
      return;
    }

    createExpenseMutation.mutate({
      amount,
      category: expenseCategory,
      description: expenseDescription.trim(),
    });
  };

  const handleAddToCart = (product: Product, packSize?: PackSize) => {
    if (product.stock <= 0) return;
    if (packSize && product.stock < packSize.quantityPerPack) {
      alertWarning(`Not enough stock for ${packSize.name}. Available: ${getStockDisplay(product.stock, product.unit, product.packSizes)}.`);
      return;
    }
    if (!currentShift || currentShift.status !== 'open') {
      setShowShiftModal(true);
      return;
    }

    // If product has pack sizes and none selected, show modal
    const hasPackSizes = product.packSizes && product.packSizes.length > 0;
    if (hasPackSizes && !packSize) {
      setSelectedProductForPack(product);
      setShowPackSizeModal(true);
      return;
    }

    const unitPrice = packSize?.sellingPrice ?? product.price;
    const quantityPerPack = packSize?.quantityPerPack ?? 1;
    const baseUnit = product.unit || 'unit';

    addItem({
      productId: product._id,
      productName: packSize ? `${product.name} (${packSize.name})` : product.name,
      brand: product.brand,
      sku: product.sku,
      barcode: packSize?.barcode || product.barcode || '',
      quantity: 1,
      unitPrice,
      requiresPrescription: product.requiresPrescription,
      baseUnit,
      packSize: packSize || undefined,
      quantityInBaseUnits: quantityPerPack,
    });
  };

  const handleQuickKeyAdd = (key: QuickKeyProduct) => {
    // Find the product in the currently loaded products
    const product = products.find((p) => p._id === key.productId);
    if (!product) {
      showError(`Product not loaded. Scroll the catalog to refresh.`);
      return;
    }
    const packSize = key.packSizeCode
      ? product.packSizes?.find((pk) => pk.code === key.packSizeCode)
      : undefined;
    handleAddToCart(product, packSize);
  };


  const categories = [
    { id: 'all', label: 'All' },
    { id: 'otc', label: 'OTC' },
    { id: 'prescription', label: 'Prescription' },
    { id: 'vitamins', label: 'Vitamins' },
  ];

  const expenseCategories = [
    { value: 'utilities', label: 'Utilities' },
    { value: 'supplies', label: 'Supplies' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'petty_cash', label: 'Petty Cash' },
    { value: 'other', label: 'Other' },
  ];

  const cartItemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalSales = (shiftSales || []).reduce(
    (sum, sale) => sum + (Number(sale.total) || 0),
    0,
  );
  const totalExpenses = (shiftExpenses || []).reduce(
    (sum, expense) => sum + (Number(expense.amount) || 0),
    0,
  );
  const expectedCash = (currentShift?.openingCash || 0) + totalSales - totalExpenses;

  // Guard: Redirect to branch selection if no branch is selected
  if (!selectedBranch) {
    return (
      <POSLayout>
        <div className="flex flex-col items-center justify-center h-full text-center">
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white mb-2">No Branch Selected</h2>
            <p className="text-gray-400 mb-6">Please select a branch to continue using the POS system.</p>
            <button
              onClick={() => navigate('/branches')}
              className="px-6 py-2 bg-accent-green text-primary-dark font-semibold rounded-lg hover:bg-accent-green/90"
            >
              Select Branch
            </button>
          </div>
        </div>
      </POSLayout>
    );
  }

  return (
    <POSLayout>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Top Bar */}
        <div className="bg-linear-to-r from-primary-dark to-primary-darker border-b border-gray-700 px-4 sm:px-6 py-3">
        <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
          {/* Left: Branch Info */}
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-12 h-12 rounded-xl bg-linear-to-br from-accent-green to-emerald-600 flex items-center justify-center text-primary-dark font-bold text-lg shrink-0">
              {selectedBranch?.name?.charAt(0) || 'N'}
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white truncate">{selectedBranch?.name || 'No Branch'}</h1>
              <p className="text-xs text-gray-400 truncate">Terminal - {currentShift?.status === 'open' ? 'Shift Open' : 'No Shift'}</p>
            </div>
          </div>

          {/* Center: Shift Status */}
          <div className="flex flex-wrap items-center gap-2">
            {currentShift?.status === 'open' ? (
              <>
                <div className="flex items-center space-x-2 px-3 py-1.5 min-h-10 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400 text-xs font-medium">Shift Active</span>
                </div>
                <button
                  onClick={() => setShowCloseShiftModal(true)}
                  className="px-4 py-1.5 min-h-10 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs font-medium hover:bg-red-500/20 transition-colors"
                >
                  Close Shift
                </button>
                <button
                  onClick={() => setShowExpenseModal(true)}
                  className="px-4 py-1.5 min-h-10 bg-orange-500/10 border border-orange-500/30 rounded-lg text-orange-300 text-xs font-medium hover:bg-orange-500/20 transition-colors"
                >
                  Log Expense
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowShiftModal(true)}
                className="px-4 py-1.5 min-h-10 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors"
              >
                Open Shift
              </button>
            )}
          </div>

          {/* Right: User & Status */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center space-x-2 px-2 py-1 min-h-10 rounded-lg ${wsConnected ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
              <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-400'} ${wsConnected ? 'animate-pulse' : ''}`} />
              <span className={`text-xs font-medium ${wsConnected ? 'text-green-400' : 'text-red-400'}`}>{wsConnected ? 'Online' : 'Offline'}</span>
            </div>
            <button 
              onClick={() => setShowProfile(true)}
              className="w-12 h-12 rounded-xl bg-linear-to-br from-accent-green to-emerald-600 flex items-center justify-center text-primary-dark font-bold text-sm hover:shadow-lg hover:shadow-accent-green/50 transition-shadow"
            >
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </button>
          </div>
        </div>
      </div>

      {/* Parked Sales Banner */}
      {heldSales.length > 0 && (
        <div className="px-3 md:px-6 pt-3">
          <ParkedSalesBar
            heldSales={heldSales}
            onRecall={(id) => {
              const sale = recallHeldSale(id);
              if (sale) {
                restoreCart({
                  items: sale.items,
                  discount: sale.discount,
                  manualDiscount: sale.manualDiscount,
                  promotionId: sale.promotionId,
                  prescriptionUrl: sale.prescriptionUrl,
                });
                showSuccess(`Recalled "${sale.label}"`);
              }
            }}
            onDiscard={async (id) => {
              const sale = heldSales.find((s) => s.id === id);
              if (!sale) return;

              const confirmed = await requestConfirmation({
                title: 'Discard parked sale?',
                message: `"${sale.label}" will be permanently removed. This cannot be undone.`,
                confirmLabel: 'Discard sale',
                variant: 'danger',
              });
              if (!confirmed) return;

              discardHeldSale(id);
              showSuccess(`Discarded "${sale.label}"`);
            }}
            format={format}
          />
        </div>
      )}

      {/* Main Content - Split View */}
      <div className="flex-1 flex gap-6 overflow-hidden p-3 md:p-6">
        {/* Left: Products Section */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Search & Filters */}
          <div className="mb-4 space-y-3">
            {/* Search Bar + Scan Button */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search drug name, brand, SKU, or barcode..."
                  className="w-full pl-11 pr-4 py-2.5 bg-slate-900/80 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 focus:ring-2 focus:ring-emerald-500/20 text-sm transition-all shadow-xs"
                />
              </div>

              {/* Scan Mode Toggle - native only */}
              {cameraAvailable && (
                <button
                  onClick={toggleScanMode}
                  title={scanMode ? 'Stop scanning' : 'Start barcode scanner'}
                  className={`px-4 py-2.5 rounded-xl border font-medium text-xs transition-all flex items-center gap-2 ${
                    scanMode
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/25 font-bold'
                      : 'bg-slate-900/80 border-white/10 text-slate-300 hover:border-emerald-500/40 hover:text-white'
                  }`}
                >
                  <ScanLine className="w-4 h-4" />
                  <span className="hidden sm:inline">{scanMode ? 'Stop' : 'Scan'}</span>
                </button>
              )}
            </div>

            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              {/* Category Filter */}
              <div className="flex gap-1.5 overflow-x-auto pb-1.5 xl:pb-0">
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${
                      selectedCategory === cat.id
                        ? 'bg-emerald-500/15 text-emerald-300 font-semibold border border-emerald-500/25 shadow-xs'
                        : 'bg-slate-900/80 border border-white/[0.08] text-slate-400 hover:text-slate-200 hover:border-white/15'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              <div className="flex rounded-xl border border-white/[0.08] bg-slate-900/90 p-1">
                {(['grid', 'list'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setProductViewMode(mode)}
                    className={`flex items-center space-x-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all ${
                      productViewMode === mode
                        ? 'bg-white/[0.08] text-slate-100 shadow-xs'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {mode === 'grid' ? <LayoutGrid className="w-3.5 h-3.5" /> : <ListIcon className="w-3.5 h-3.5" />}
                    <span>{mode}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Keys (Square-style speed buttons) */}
          <QuickKeysGrid
            onAdd={handleQuickKeyAdd}
            format={format}
            branchId={getBranchId(selectedBranch)}
            products={products}
          />

          {/* Product Grid */}
          <div className="flex-1 overflow-y-auto pr-2">
            {loadingProducts ? (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 xl:grid-cols-3" role="status" aria-busy="true">
                {[0, 1, 2, 3, 4, 5].map((item) => (
                  <div key={item} className="overflow-hidden rounded-xl border border-white/5 bg-primary-dark">
                    <div className="aspect-[4/3] animate-pulse bg-white/[0.06]" />
                    <div className="space-y-2 p-3">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-white/10" />
                      <div className="h-3 w-1/2 animate-pulse rounded bg-white/5" />
                    </div>
                  </div>
                ))}
                <span className="sr-only">Loading products…</span>
              </div>
            ) : products.length > 0 ? (
              <div className="space-y-4">
                {productsPagination && (
                  <div className="rounded-xl border border-white/[0.08] bg-slate-900/60 px-4 py-2.5 text-xs text-slate-400">
                    Showing {products.length} of {productsPagination.total} products
                  </div>
                )}

                {productViewMode === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-3 gap-3 md:gap-4">
                {products.map((product) => (
                  <button
                    key={product._id}
                    onClick={() => handleAddToCart(product)}
                    disabled={product.stock <= 0}
                    className={`group rounded-2xl overflow-hidden bg-slate-900/80 border border-white/[0.08] text-left flex flex-col transition-all duration-150 ${
                      product.stock <= 0
                        ? 'opacity-40 cursor-not-allowed'
                        : 'hover:border-emerald-500/40 hover:shadow-xl hover:shadow-emerald-500/5 hover:-translate-y-0.5'
                    }`}
                  >
                    <div className="aspect-4/3 relative bg-slate-950 overflow-hidden">
                      <img
                        src={getProductImage(product)}
                        alt={product.name}
                        onError={handleImageError}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {product.stock <= 0 && (
                        <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs">
                          <span className="px-2.5 py-1 bg-rose-500 text-white text-[11px] font-bold rounded-lg shadow-md">
                            Out of Stock
                          </span>
                        </div>
                      )}
                      {product.stock > 0 && product.stock <= 5 && (
                        <div className="absolute top-2 right-2 px-2 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-bold rounded-md shadow-xs">
                          Low Stock ({getStockDisplay(product.stock, product.unit, product.packSizes)})
                        </div>
                      )}
                      <div className="absolute inset-0 bg-linear-to-t from-slate-950/50 to-transparent opacity-60 group-hover:opacity-80 transition-opacity" />
                    </div>
                    <div className="p-3 bg-slate-900/90 flex-1 flex flex-col justify-between border-t border-white/[0.06]">
                      <div>
                        <h3 className="text-xs font-semibold leading-snug text-slate-100 line-clamp-2">
                          {product.name}
                        </h3>
                        <p className="mt-1.5 inline-block text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                          {getDisplayBrand(product.brand)}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400 truncate">
                          {product.category || 'General'} · #{product.sku || 'No SKU'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-white/[0.04]">
                        <p className="text-emerald-400 font-bold text-sm tabular-nums font-mono">{format(product.price)}</p>
                        {product.stock > 0 && (
                          <span className="text-[10px] font-medium text-slate-400">
                            {product.stock} {product.unit}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
                </div>
                ) : (
                  <div className="space-y-2.5">
                    {products.map((product) => (
                      <button
                        key={product._id}
                        type="button"
                        onClick={() => handleAddToCart(product)}
                        disabled={product.stock <= 0}
                        className={`group flex w-full gap-3.5 rounded-2xl border border-white/[0.08] bg-slate-900/80 p-3 text-left transition-all duration-150 ${
                          product.stock <= 0
                            ? 'cursor-not-allowed opacity-40'
                            : 'hover:border-emerald-500/40 hover:bg-slate-800/80 hover:shadow-lg hover:shadow-emerald-500/5'
                        }`}
                      >
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-950 border border-white/[0.06] sm:h-24 sm:w-24">
                          <img
                            src={getProductImage(product)}
                            alt={product.name}
                            onError={handleImageError}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          {product.stock <= 0 && (
                            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs">
                              <span className="rounded-lg bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white">
                                Out
                              </span>
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <h3 className="text-sm font-bold leading-snug text-slate-100 break-words">
                                {product.name}
                              </h3>
                              <p className="mt-1 inline-flex rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
                                {getDisplayBrand(product.brand)}
                              </p>
                            </div>
                            <p className="shrink-0 text-base font-bold text-emerald-400 tabular-nums font-mono">
                              {format(product.price)}
                            </p>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                            <span>{product.category || 'General'}</span>
                            <span className="font-mono">#{product.sku || 'No SKU'}</span>
                            <span>Stock: {getStockDisplay(product.stock, product.unit, product.packSizes)}</span>
                          </div>
                          {product.packSizes && product.packSizes.length > 0 && (
                            <p className="mt-1 text-[11px] font-medium text-slate-500">
                              Packs: {product.packSizes.map((pack) => pack.name).join(', ')}
                            </p>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {hasNextPage && (
                  <button
                    type="button"
                    onClick={() => fetchNextPage()}
                    disabled={loadingMoreProducts}
                    className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition-colors disabled:opacity-60"
                  >
                    {loadingMoreProducts ? 'Loading more...' : 'Load more products'}
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-full py-12">
                <div className="text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3 text-slate-500">
                    <Package className="w-6 h-6 stroke-[1.5]" />
                  </div>
                  <p className="text-slate-300 font-semibold text-sm">No products found</p>
                  <p className="text-slate-500 text-xs mt-1">Try adjusting your search or filters</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Shopping Cart Section - Desktop Only */}
        <div className="hidden lg:flex w-96 flex-col bg-slate-900/95 rounded-2xl border border-white/[0.08] overflow-hidden shadow-2xl backdrop-blur-xl">
          {/* Cart Header */}
          <div className="border-b border-white/[0.08] px-5 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-100 tracking-tight">Order</h2>
                <p className="text-[11px] text-slate-400">{items.length} item{items.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            {items.length > 0 && (
              <span className="px-2.5 py-1 bg-slate-800 border border-white/10 rounded-full text-slate-300 text-xs font-semibold tabular-nums">
                {items.length}
              </span>
            )}
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
            {items.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3 text-slate-500">
                  <ShoppingBag className="w-6 h-6 stroke-[1.5]" />
                </div>
                <p className="text-slate-300 font-semibold text-sm">Your cart is empty</p>
                <p className="text-slate-500 text-xs mt-1">Add products to get started</p>
              </div>
            ) : (
              items.map((item) => (
                <div key={itemKey(item.productId, item.packSize)} className="bg-slate-900/90 rounded-2xl p-3 border border-white/[0.08] hover:border-white/15 transition-all shadow-xs group">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-slate-100 font-semibold text-xs leading-snug break-words">{item.productName}</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        <span className="font-mono">#{item.sku}</span>
                        {item.packSize && (
                          <span className="ml-1 px-1.5 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded text-[10px] font-semibold">
                            {item.packSize.name}
                          </span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={() => removeItem(item.productId, item.packSize)}
                      className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors p-1.5 rounded-lg shrink-0"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                    <div className="flex items-center space-x-1 bg-slate-950/80 rounded-xl p-0.5 border border-white/[0.06]">
                      <button
                        onClick={() => handleQuantityDecrement(item.productId, item.packSize, item.quantity)}
                        className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white disabled:opacity-30"
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="text"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(item.productId, item.packSize, e.target.value)}
                        className="w-8 bg-transparent text-center text-slate-100 font-semibold text-xs focus:outline-none tabular-nums"
                      />
                      <button
                        onClick={() => handleQuantityIncrement(item.productId, item.packSize, item.quantity)}
                        className="w-7 h-7 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <p className="text-emerald-400 font-bold text-xs tabular-nums font-mono">{format(item.unitPrice * item.quantity)}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Summary */}
          {items.length > 0 && (
            <>
              <div className="border-t border-white/[0.08] px-5 py-3 space-y-1.5 bg-slate-900/90 text-xs">
                <div className="flex items-center justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span className="text-slate-200 font-medium tabular-nums">{format(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex items-center justify-between text-rose-400">
                    <span>Discount</span>
                    <span className="font-semibold tabular-nums">-{format(discount)}</span>
                  </div>
                )}
                <div className="border-t border-white/[0.08] pt-2 flex items-center justify-between">
                  <span className="text-slate-300 font-bold">Total</span>
                  <span className="text-lg font-black text-emerald-400 tabular-nums font-mono">{format(total)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-white/[0.08] px-5 py-4 space-y-2 bg-slate-900/90">
                <button
                  onClick={() => navigate('/pos/discounts')}
                  className="w-full py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl text-slate-300 hover:text-white font-medium text-xs transition-colors flex items-center justify-center space-x-1.5"
                >
                  <Percent className="w-3.5 h-3.5 text-slate-400" />
                  <span>Apply Discount</span>
                </button>
                <button
                  onClick={() => navigate('/pos/payment')}
                  className="w-full py-2.5 bg-linear-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 rounded-xl text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center space-x-1.5 active:scale-[0.99]"
                >
                  <span>Proceed to Checkout</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile Cart Button - Fixed at Bottom */}
      {items.length > 0 && (
        <button
          onClick={() => setShowMobileCart(true)}
          className="lg:hidden fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom))] right-6 z-40 w-14 h-14 bg-linear-to-r from-emerald-500 to-teal-600 rounded-full shadow-2xl shadow-emerald-500/40 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform"
          aria-label="View current order"
        >
          <div className="relative">
            <ShoppingBag className="w-6 h-6 text-slate-950" />
            <span className="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 border border-slate-900 rounded-full text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
              {cartItemCount}
            </span>
          </div>
        </button>
      )}

      {/* Mobile Cart Overlay */}
      {showMobileCart && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-slate-950 animate-fade-in">
          {/* Mobile Cart Header */}
          <div className="bg-slate-900/90 backdrop-blur-xl border-b border-white/[0.08] px-4 py-3.5 flex items-center justify-between pt-safe-top">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-100 tracking-tight">Your Order</h2>
                <p className="text-[11px] text-slate-400">{items.length} item{items.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
            <button
              onClick={() => setShowMobileCart(false)}
              className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/[0.05] border border-white/10 text-slate-400 hover:text-white transition-colors"
              aria-label="Close cart"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Cart Items */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
            {items.map((item) => (
              <div key={itemKey(item.productId, item.packSize)} className="bg-slate-900/90 rounded-2xl p-3.5 border border-white/[0.08]">
                <div className="flex items-start justify-between gap-2 mb-2.5">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-slate-100 font-semibold text-xs leading-snug break-words">{item.productName}</h3>
                    <div className="flex items-center flex-wrap gap-1.5 mt-1">
                      {item.brand && item.brand.trim().toLowerCase() !== 'unknown' && (
                        <span className="text-[10px] text-emerald-400 font-medium">
                          {item.brand}
                        </span>
                      )}
                      {item.packSize && (
                        <span className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded text-[10px] font-semibold">
                          {item.packSize.name}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-500 font-mono">
                        #{item.sku}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => removeItem(item.productId, item.packSize)}
                    className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors p-1.5 rounded-lg shrink-0"
                    aria-label="Remove item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
                  <div className="flex items-center space-x-1 bg-slate-950/80 rounded-xl p-0.5 border border-white/[0.06]">
                    <button
                      onClick={() => handleQuantityDecrement(item.productId, item.packSize, item.quantity)}
                      className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white disabled:opacity-30"
                      disabled={item.quantity <= 1}
                      aria-label="Decrease quantity"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <input
                      type="text"
                      value={item.quantity}
                      onChange={(e) => handleQuantityChange(item.productId, item.packSize, e.target.value)}
                      className="w-10 bg-transparent text-center text-slate-100 font-semibold text-xs focus:outline-none tabular-nums"
                    />
                    <button
                      onClick={() => handleQuantityIncrement(item.productId, item.packSize, item.quantity)}
                      className="w-8 h-8 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
                      aria-label="Increase quantity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-emerald-400 font-bold text-sm tabular-nums font-mono">{format(item.unitPrice * item.quantity)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Mobile Cart Summary & Actions */}
          <div className="bg-slate-900/95 border-t border-white/[0.08] backdrop-blur-xl">
            <div className="px-4 py-3.5 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-400">
                <span>Subtotal</span>
                <span className="text-slate-200 font-medium tabular-nums">{format(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex items-center justify-between text-rose-400">
                  <span>Discount</span>
                  <span className="font-semibold tabular-nums">-{format(discount)}</span>
                </div>
              )}
              <div className="border-t border-white/[0.08] pt-2 flex items-center justify-between">
                <span className="text-slate-300 font-bold">Total Due</span>
                <span className="text-xl font-black text-emerald-400 tabular-nums font-mono">{format(total)}</span>
              </div>
            </div>

            <div className="px-4 pb-6 pb-safe-bottom space-y-2">
              <button
                onClick={() => {
                  setShowMobileCart(false);
                  navigate('/pos/discounts');
                }}
                className="w-full py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl text-slate-300 hover:text-white font-medium text-xs transition-colors flex items-center justify-center space-x-1.5"
              >
                <Percent className="w-3.5 h-3.5 text-slate-400" />
                <span>Apply Discount</span>
              </button>
              <button
                onClick={() => {
                  setShowMobileCart(false);
                  navigate('/pos/payment');
                }}
                className="w-full py-3 bg-linear-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 rounded-xl text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/25 transition-all flex items-center justify-center space-x-2 active:scale-[0.99]"
              >
                <span>Proceed to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stock Warning Toast */}
      {stockWarning && (
        <div className="fixed top-[calc(1rem+env(safe-area-inset-top))] right-4 z-50 max-w-sm">
          <div className="bg-yellow-500 text-primary-dark px-4 py-3 rounded-xl shadow-lg flex items-start space-x-3">
            <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <p className="font-semibold">Stock Update</p>
              <p className="text-sm">{stockWarning.message}</p>
            </div>
            <button onClick={() => setStockWarning(null)} className="text-primary-dark/70 hover:text-primary-dark">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Open Shift Modal */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/75" onClick={() => setShowShiftModal(false)} />
          <div className="relative bg-primary-dark rounded-t-2xl sm:rounded-2xl p-6 pb-safe-bottom w-full max-w-md mx-0 sm:mx-4 border border-gray-700 max-h-[85vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">Open Shift</h2>
            <p className="text-gray-400 mb-4">Enter the opening cash amount to start your shift.</p>
            
            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Opening Cash Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-green font-bold">{symbol}</span>
                <input
                  type="number"
                  value={openingCash}
                  onChange={(e) => setOpeningCash(e.target.value)}
                  placeholder={`${symbol} 0.00`}
                  className="w-full pl-10 pr-4 py-3 bg-primary-darker border border-gray-600 rounded-xl text-white focus:outline-none focus:border-accent-green"
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowShiftModal(false)}
                className="flex-1 py-3 bg-gray-700 text-white font-medium rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleOpenShift}
                disabled={openShiftMutation.isPending}
                className="flex-1 py-3 bg-accent-green text-primary-dark font-semibold rounded-xl disabled:opacity-50"
              >
                {openShiftMutation.isPending ? 'Opening...' : 'Open Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {showCloseShiftModal && currentShift && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/75" onClick={() => setShowCloseShiftModal(false)} />
          <div className="relative bg-primary-dark rounded-t-2xl sm:rounded-2xl p-6 pb-safe-bottom w-full max-w-md mx-0 sm:mx-4 border border-gray-700 max-h-[85vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">Close Shift</h2>
            <p className="text-gray-400 mb-4">Count the cash in the register and confirm shift closure.</p>

            <div className="bg-primary-darker rounded-xl p-4 mb-4 space-y-2 border border-gray-700">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Opening Cash</span>
                <span className="text-white">{format(currentShift.openingCash)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Total Sales</span>
                <span className="text-white">{format(totalSales)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Expenses</span>
                <span className="text-red-300">- {format(totalExpenses)}</span>
              </div>
              <div className="flex justify-between text-base pt-2 border-t border-gray-700">
                <span className="text-white font-medium">Expected Cash</span>
                <span className="text-accent-green font-bold">{format(expectedCash)}</span>
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Actual Closing Cash Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-green font-bold">{symbol}</span>
                <input
                  type="number"
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  placeholder={`${symbol} 0.00`}
                  className="w-full pl-10 pr-4 py-3 bg-primary-darker border border-gray-600 rounded-xl text-white focus:outline-none focus:border-accent-green"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Notes (Optional)</label>
              <textarea
                value={closeShiftNotes}
                onChange={(e) => setCloseShiftNotes(e.target.value)}
                placeholder="Any discrepancy or handover note..."
                rows={3}
                className="w-full px-4 py-3 bg-primary-darker border border-gray-600 rounded-xl text-white resize-none focus:outline-none focus:border-accent-green"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowCloseShiftModal(false)}
                className="flex-1 py-3 bg-gray-700 text-white font-medium rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleCloseShift}
                disabled={closeShiftMutation.isPending || !closingCash.trim()}
                className="flex-1 py-3 bg-red-600 text-white font-semibold rounded-xl disabled:opacity-50"
              >
                {closeShiftMutation.isPending ? 'Closing...' : 'Close Shift'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expense Modal */}
      {showExpenseModal && currentShift && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/75" onClick={() => setShowExpenseModal(false)} />
          <div className="relative bg-primary-dark rounded-t-2xl sm:rounded-2xl p-6 pb-safe-bottom w-full max-w-md mx-0 sm:mx-4 border border-gray-700 max-h-[85vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-4">Log Expense</h2>
            <p className="text-gray-400 mb-4">Record a cash expense for this active shift.</p>

            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Amount</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-green font-bold">{symbol}</span>
                <input
                  type="number"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  placeholder={`${symbol} 0.00`}
                  className="w-full pl-10 pr-4 py-3 bg-primary-darker border border-gray-600 rounded-xl text-white focus:outline-none focus:border-accent-green"
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Category</label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className="w-full px-4 py-3 bg-primary-darker border border-gray-600 rounded-xl text-white focus:outline-none focus:border-accent-green"
              >
                {expenseCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-gray-400 text-sm mb-2">Description</label>
              <textarea
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
                placeholder="What was this expense for?"
                rows={3}
                className="w-full px-4 py-3 bg-primary-darker border border-gray-600 rounded-xl text-white resize-none focus:outline-none focus:border-accent-green"
              />
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => setShowExpenseModal(false)}
                className="flex-1 py-3 bg-gray-700 text-white font-medium rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateExpense}
                disabled={createExpenseMutation.isPending || !expenseAmount.trim() || !expenseDescription.trim()}
                className="flex-1 py-3 bg-accent-green text-primary-dark font-semibold rounded-xl disabled:opacity-50"
              >
                {createExpenseMutation.isPending ? 'Logging...' : 'Log Expense'}
              </button>
            </div>
</div>
          </div>
      )}

      {/* Pack Size Selector Modal */}
      {showPackSizeModal && selectedProductForPack && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/75" onClick={() => setShowPackSizeModal(false)} />
          <div className="relative bg-primary-dark rounded-t-2xl sm:rounded-2xl p-6 pb-safe-bottom w-full max-w-md mx-0 sm:mx-4 border border-gray-700 max-h-[85vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-white mb-1">Select Pack Size</h2>
            <p className="text-gray-400 text-sm mb-4">{selectedProductForPack.name}</p>

            <div className="space-y-3 mb-6">
              {/* Base unit option (default) */}
              <button
                onClick={() => {
                  handleAddToCart(selectedProductForPack, undefined);
                  setShowPackSizeModal(false);
                }}
                className="w-full p-4 bg-primary-darker border border-gray-600 rounded-xl text-left hover:border-accent-green transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-white font-semibold">{selectedProductForPack.unit || 'Unit'}</p>
                    <p className="text-gray-400 text-sm">1 {selectedProductForPack.unit || 'unit'}</p>
                  </div>
                  <p className="text-accent-green font-bold">{format(selectedProductForPack.price)}</p>
                </div>
              </button>

              {/* Pack size options */}
              {selectedProductForPack.packSizes?.map((pack) => (
                <button
                  key={pack.unit}
                  onClick={() => {
                    if (selectedProductForPack.stock < pack.quantityPerPack) return;
                    handleAddToCart(selectedProductForPack, pack);
                    setShowPackSizeModal(false);
                  }}
                  disabled={selectedProductForPack.stock < pack.quantityPerPack}
                  className={`w-full p-4 bg-primary-darker border rounded-xl text-left transition-colors ${
                    selectedProductForPack.stock < pack.quantityPerPack
                      ? 'cursor-not-allowed border-red-500/30 opacity-60'
                      : 'border-gray-600 hover:border-accent-green'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-white font-semibold">{pack.name}</p>
                      <p className="text-gray-400 text-sm">{pack.quantityPerPack} {selectedProductForPack.unit}s per {pack.name.toLowerCase()}</p>
                      {selectedProductForPack.stock < pack.quantityPerPack && (
                        <p className="mt-1 text-xs text-red-400">Not enough stock for this pack</p>
                      )}
                    </div>
                    <p className="text-accent-green font-bold">{format(pack.sellingPrice)}</p>
                  </div>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowPackSizeModal(false)}
              className="w-full py-3 bg-gray-700 text-white font-medium rounded-xl"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <UserProfileModal isOpen={showProfile} onClose={() => setShowProfile(false)} />

      <OfflineIndicator />

      {/* -- Barcode Scan Mode Overlay ----------------------------------------
           When active, the WebView background is transparent so the native
           camera shows behind this overlay. Only visible HTML elements are
           the targeting reticle, feedback toast, and the stop button.       */}
      {scanMode && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-between pointer-events-none">
          {/* Top instruction bar */}
          <div className="w-full px-4 pt-[calc(1.5rem+env(safe-area-inset-top))] flex justify-center pointer-events-auto">
            <div className="bg-black/70 backdrop-blur-sm rounded-2xl px-5 py-3 flex items-center gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-accent-green animate-pulse" />
              <span className="text-white text-sm font-medium">Point camera at a barcode to add it to the cart</span>
            </div>
          </div>

          {/* Centre targeting reticle */}
          <div className="relative w-64 h-48">
            {/* Corner brackets */}
            <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-accent-green rounded-tl-lg" />
            <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-accent-green rounded-tr-lg" />
            <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-accent-green rounded-bl-lg" />
            <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-accent-green rounded-br-lg" />
            {/* Scan line animation */}
            <span className="absolute inset-x-2 top-1/2 h-0.5 bg-accent-green/70 animate-pulse" />
          </div>

          {/* Scan feedback toast */}
          <div className="w-full px-4 flex flex-col items-center gap-3 pb-32 pointer-events-auto">
            {scanFeedback && (
              <div
                className={`px-5 py-3 rounded-2xl text-sm font-semibold shadow-lg ${
                  scanFeedback.ok
                    ? 'bg-accent-green text-primary-dark'
                    : 'bg-red-500/90 text-white'
                }`}
              >
                {scanFeedback.ok ? 'OK ' : 'Error '}{scanFeedback.message}
              </div>
            )}

            {/* Stop button */}
            <button
              onClick={toggleScanMode}
              className="px-6 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl text-white font-semibold hover:bg-white/20 transition-colors"
            >
              Stop Scanning
            </button>
          </div>
        </div>
      )}
      </div>
    </POSLayout>
  );
};

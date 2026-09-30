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
import { useHardwareBarcodeScanner } from '../../hooks/useHardwareBarcodeScanner';
import { useDebounce } from '../../hooks/useDebounce';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import { OfflineIndicator, POSLayout } from '../../components/pos';
import { OpenShiftModal, CloseShiftModal } from '../../components/pos/ShiftModals';
import { ExpenseModal } from '../../components/pos/ExpenseModal';
import { Modal } from '../../components/ui/Modal';
import { getErrorMessage } from '../../lib/error-utils';
import { getProductImage, handleImageError } from '../../lib/product-images';
import { UserProfileModal } from '../../components/pos/UserProfileModal';
import { ParkedSalesBar } from '../../components/pos/ParkedSalesBar';
import { QuickKeysGrid } from '../../components/pos/QuickKeysGrid';
import { CartQuantityInput } from '../../components/pos/CartQuantityInput';
import type { QuickKeyProduct } from '../../stores/quick-keys-store';
import { queryKeys } from '../../lib/query-keys';
import { NotificationBell } from '../../components/NotificationBell';
import { usePOSSidebarStore } from '../../stores/pos-sidebar-store';
import {
  Menu,
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
  AlertCircle,
  Clock,
  RotateCcw,
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
  paymentMethod?: string;
  payments?: Array<{ paymentMethod?: string; amount?: number }>;
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
    discount,
    manualDiscount,
    promotionId,
    prescriptionUrl,
    clearCart 
  } = useCartStore();
  const heldSales = useHeldSalesStore((s) => s.heldSales);
  const holdSale = useHeldSalesStore((s) => s.holdSale);
  const recallHeldSale = useHeldSalesStore((s) => s.recallSale);
  const discardHeldSale = useHeldSalesStore((s) => s.discardSale);
  const restoreCart = useCartStore((s) => s.restoreCart);
  const { showSuccess, showError } = useToast();
  const requestConfirmation = useConfirm();
  const { format, symbol } = useCurrency();
  const openPOSSidebar = usePOSSidebarStore((s) => s.openSidebar);
  
  // Helper to convert stock to readable units
  const getStockDisplay = (stock: number, unit: string, packSizes?: PackSize[]): string => {
    if (stock <= 0) {
      return 'Out of stock';
    }

    const formatCountAndUnit = (count: number, unitName: string) => {
      const cleanName = unitName || 'unit';
      if (count === 1) return `1 ${cleanName}`;
      const lower = cleanName.toLowerCase();
      if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('ch') || lower.endsWith('sh')) {
        return `${count} ${cleanName}es`;
      }
      return `${count} ${cleanName}s`;
    };

    if (!packSizes || packSizes.length === 0) {
      return formatCountAndUnit(stock, unit);
    }

    // Sort pack sizes by quantity descending (largest first)
    const sorted = [...packSizes].sort((a, b) => b.quantityPerPack - a.quantityPerPack);

    // Check if this is a size variant pack (all have qty 1)
    const allSizeVariants = sorted.every(p => p.quantityPerPack === 1);

    if (allSizeVariants) {
      // For size variants, show count and available sizes
      const availableSizes = sorted.filter(p => stock >= p.quantityPerPack).map(p => p.name);
      if (availableSizes.length > 0) {
        return `${formatCountAndUnit(stock, unit)} (${availableSizes.join(', ')})`;
      }
      return formatCountAndUnit(stock, unit);
    }

    // Regular pack sizes with quantity > 1
    const largestPack = sorted.find(p => p.quantityPerPack > 1);
    if (!largestPack) {
      return formatCountAndUnit(stock, unit);
    }

    // Calculate packs and remaining
    const packs = Math.floor(stock / largestPack.quantityPerPack);
    const remaining = stock % largestPack.quantityPerPack;

    if (packs > 0 && remaining > 0) {
      return `${formatCountAndUnit(packs, largestPack.name)}, ${formatCountAndUnit(remaining, unit)}`;
    } else if (packs > 0) {
      return formatCountAndUnit(packs, largestPack.name);
    } else {
      return formatCountAndUnit(stock, unit);
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
  const [packSelectionQty, setPackSelectionQty] = useState(1);
  const [productViewMode, setProductViewMode] = useState<'grid' | 'list'>('grid');
  const scanFeedbackTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevBranchIdRef = useRef<string | undefined>(selectedBranch?._id);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // When branch changes, reset active cart to prevent cross-branch inventory conflicts
  useEffect(() => {
    if (prevBranchIdRef.current && selectedBranch?._id && prevBranchIdRef.current !== selectedBranch._id) {
      if (items.length > 0) {
        clearCart();
        alertInfo('Switched branch: active cart was cleared to match the new branch inventory.');
      }
    }
    prevBranchIdRef.current = selectedBranch?._id;
  }, [selectedBranch?._id, items.length, clearCart, alertInfo]);

  const { isAvailable: cameraAvailable, startContinuousScan, stopContinuousScan, ScannerModal } = useBarcodeScanner();

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

  // Fetch shift report for accurate totals (server-side computation from all sales records)
  const { data: shiftReport } = useQuery<{
    totalSales: number;
    salesCount: number;
    expectedCash: number;
    openingCash: number;
    totalCashSales?: number;
    totalExpenses?: number;
  }>({
    queryKey: queryKeys.shifts.report(currentShift?._id),
    queryFn: async () => {
      const response = await apiClient.get(`/shifts/${currentShift!._id}/report`);
      return response.data?.data ?? response.data;
    },
    enabled: !!currentShift?._id && currentShift?.status === 'open',
    refetchInterval: 30_000,
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

  // Hardware barcode scanner support (USB / Bluetooth scanner guns)
  useHardwareBarcodeScanner({
    onScan: handleBarcodeScan,
    enabled: isShiftActive,
  });

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
      showSuccess('Expense recorded successfully');
    },
    onError: (error: unknown) => {
      showError(getErrorMessage(error, 'Failed to record expense. Please try again.'));
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

  const handleAddToCart = (product: Product, packSize?: PackSize, customQty = 1) => {
    if (product.stock <= 0) return;
    const requiredStock = (packSize ? packSize.quantityPerPack : 1) * customQty;
    if (product.stock < requiredStock) {
      alertWarning(`Not enough stock for ${customQty}x ${packSize ? packSize.name : product.unit}. Available: ${getStockDisplay(product.stock, product.unit, product.packSizes)}.`);
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
      setPackSelectionQty(1);
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
      quantity: customQty,
      unitPrice,
      requiresPrescription: product.requiresPrescription,
      baseUnit,
      packSize: packSize || undefined,
      quantityInBaseUnits: quantityPerPack * customQty,
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

  const handleParkSale = useCallback(() => {
    if (items.length === 0) return;
    const branchId = getBranchId(selectedBranch) || user?.branchId || '';
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const label = `Sale (${items.length} item${items.length > 1 ? 's' : ''}) · ${timestamp}`;
    
    holdSale({
      label,
      items: [...items],
      discount,
      manualDiscount,
      promotionId,
      prescriptionUrl,
      heldBy: user?.id || 'cashier',
      branchId,
      subtotal,
      total,
    });
    clearCart();
    showSuccess(`Parked sale: "${label}". Register is ready for the next customer.`);
  }, [items, selectedBranch, user, discount, manualDiscount, promotionId, prescriptionUrl, subtotal, total, holdSale, clearCart, showSuccess]);

  // Global POS Keyboard Shortcuts (F1/slash for search, F4/Ctrl+Enter for checkout, F8 for park sale, Esc to clear)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT';

      // Focus search: '/' (when not typing) or 'Ctrl+K' / 'Cmd+K' or 'F1'
      if ((e.key === '/' && !isInput) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || e.key === 'F1') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // Escape: clear search query or blur search input
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        if (searchQuery) {
          setSearchQuery('');
        }
        searchInputRef.current?.blur();
        return;
      }

      // Quick checkout: F4 or (Ctrl+Enter / Cmd+Enter)
      if (e.key === 'F4' || ((e.ctrlKey || e.metaKey) && e.key === 'Enter')) {
        if (items.length > 0) {
          e.preventDefault();
          navigate('/pos/payment');
        }
        return;
      }

      // Quick park sale: F8
      if (e.key === 'F8') {
        if (items.length > 0) {
          e.preventDefault();
          handleParkSale();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [items, searchQuery, navigate, handleParkSale]);


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
  // Prefer server-computed totals from the shift report (accurate across all records)
  // Fall back to client-side sums (which may miss records beyond the 500 limit)
  const clientTotalSales = (shiftSales || []).reduce(
    (sum, sale) => sum + (Number(sale.total) || 0),
    0,
  );
  const clientCashSales = (shiftSales || []).reduce((sum, sale) => {
    if (sale.payments && sale.payments.length > 0) {
      return (
        sum +
        sale.payments
          .filter((p: any) => p.paymentMethod === 'cash')
          .reduce((pSum: number, p: any) => pSum + (Number(p.amount) || 0), 0)
      );
    }
    return sum + (sale.paymentMethod === 'cash' ? (Number(sale.total) || 0) : 0);
  }, 0);
  const totalSales = shiftReport?.totalSales ?? clientTotalSales;
  const totalCashSales = shiftReport?.totalCashSales ?? clientCashSales;
  const totalExpenses = (shiftExpenses || []).reduce(
    (sum, expense) => sum + (Number(expense.amount) || 0),
    0,
  );
  const expectedCash =
    shiftReport?.expectedCash !== undefined &&
    Math.abs(shiftReport.expectedCash - ((currentShift?.openingCash || 0) + totalCashSales - totalExpenses)) < 0.01
      ? shiftReport.expectedCash
      : Math.max(0, (currentShift?.openingCash || 0) + totalCashSales - totalExpenses);
  const salesCount = shiftReport?.salesCount;

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
    <POSLayout hideHeader>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Top Bar */}
        <div className="bg-linear-to-r from-primary-dark to-primary-darker border-b border-gray-700 px-3 sm:px-6 py-2.5 sm:py-3 shrink-0">
          <div className="flex items-center justify-between gap-2 sm:gap-4">
            {/* Left: Menu Toggle (mobile) + Branch Info */}
            <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
              <button
                type="button"
                onClick={openPOSSidebar}
                className="lg:hidden p-2 -ml-1 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 transition-colors active:scale-95 shrink-0"
                aria-label="Open navigation menu"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-linear-to-br from-accent-green to-emerald-600 flex items-center justify-center text-primary-dark font-bold text-sm sm:text-base shrink-0 shadow-sm">
                {selectedBranch?.name?.charAt(0) || 'N'}
              </div>
              <div className="min-w-0">
                <h1 className="text-sm sm:text-base font-bold text-white truncate leading-tight">
                  {selectedBranch?.name || 'No Branch'}
                </h1>
                <p className="text-[11px] sm:text-xs text-gray-400 truncate">
                  Terminal - {currentShift?.status === 'open' ? 'Shift Open' : 'No Shift'}
                </p>
              </div>
            </div>

            {/* Center: Shift Status (hidden on small mobile, shown on md/lg) */}
            <div className="hidden md:flex items-center gap-2">
              {currentShift?.status === 'open' ? (
                <>
                  <div className="flex items-center space-x-2 px-3 py-1.5 min-h-10 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-green-400 text-xs font-medium">Shift Active</span>
                  </div>
                  <button
                    onClick={() => setShowCloseShiftModal(true)}
                    className="px-3.5 py-1.5 min-h-10 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs font-medium hover:bg-red-500/20 transition-colors cursor-pointer"
                  >
                    Close Shift
                  </button>
                  <button
                    onClick={() => setShowExpenseModal(true)}
                    className="px-3.5 py-1.5 min-h-10 bg-orange-500/10 border border-orange-500/30 rounded-lg text-orange-300 text-xs font-medium hover:bg-orange-500/20 transition-colors cursor-pointer"
                  >
                    Log Expense
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setShowShiftModal(true)}
                  className="px-4 py-1.5 min-h-10 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors cursor-pointer"
                >
                  Open Shift
                </button>
              )}
            </div>

            {/* Right: Online Status + Notifications + User Avatar */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <div className={`flex items-center space-x-1.5 px-2 py-1 rounded-lg ${wsConnected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="text-[11px] font-medium hidden sm:inline">{wsConnected ? 'Online' : 'Offline'}</span>
              </div>
              <div className="lg:hidden">
                <NotificationBell />
              </div>
              <button 
                onClick={() => setShowProfile(true)}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-linear-to-br from-accent-green to-emerald-600 flex items-center justify-center text-primary-dark font-bold text-xs sm:text-sm hover:shadow-lg hover:shadow-accent-green/50 transition-shadow active:scale-95 shrink-0 cursor-pointer"
                aria-label="User Profile"
              >
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </button>
            </div>
          </div>

          {/* Mobile Shift Status Bar (Row 2 - on mobile < md) */}
          <div className="md:hidden flex items-center gap-2 overflow-x-auto no-scrollbar pt-2 mt-2 border-t border-white/[0.08]">
            {currentShift?.status === 'open' ? (
              <>
                <div className="flex items-center space-x-1.5 px-2.5 py-1 bg-green-500/10 border border-green-500/30 rounded-lg shrink-0">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400 text-xs font-medium">Shift Active</span>
                </div>
                <button
                  onClick={() => setShowCloseShiftModal(true)}
                  className="px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs font-medium hover:bg-red-500/20 transition-colors shrink-0"
                >
                  Close Shift
                </button>
                <button
                  onClick={() => setShowExpenseModal(true)}
                  className="px-3 py-1 bg-orange-500/10 border border-orange-500/30 rounded-lg text-orange-300 text-xs font-medium hover:bg-orange-500/20 transition-colors shrink-0"
                >
                  Log Expense
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowShiftModal(true)}
                className="px-3.5 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-400 text-xs font-medium hover:bg-amber-500/20 transition-colors shrink-0"
              >
                Open Shift
              </button>
            )}
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
                  ref={searchInputRef}
                  type="text"
                  data-is-search="true"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search drug name, brand, SKU, or barcode..."
                  className="w-full pl-11 pr-16 py-2.5 bg-slate-900/80 border border-white/10 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500/80 focus:ring-2 focus:ring-emerald-500/20 text-sm transition-all shadow-xs"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        searchInputRef.current?.focus();
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                      title="Clear search (Esc)"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-white/5 border border-white/10 rounded">
                      /
                    </kbd>
                  )}
                </div>
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

                      {/* 1-Tap Quick Packaging Chips */}
                      {product.packSizes && product.packSizes.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2 pt-1.5 border-t border-white/[0.04]" onClick={(e) => e.stopPropagation()}>
                          {product.packSizes.slice(0, 3).map((pack) => {
                            const hasStock = product.stock >= pack.quantityPerPack;
                            return (
                              <button
                                key={pack.unit}
                                type="button"
                                disabled={!hasStock}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddToCart(product, pack, 1);
                                }}
                                className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold transition-all border ${
                                  hasStock
                                    ? 'bg-emerald-500/10 hover:bg-emerald-500/25 border-emerald-500/30 text-emerald-300 hover:scale-105 active:scale-95'
                                    : 'bg-slate-900 border-white/5 text-slate-500 opacity-50 cursor-not-allowed'
                                }`}
                                title={`1-Tap Add: 1 ${pack.name} (${pack.quantityPerPack} ${product.unit}s)`}
                              >
                                {pack.name}: {format(pack.sellingPrice)}
                              </button>
                            );
                          })}
                        </div>
                      )}
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
                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-white/[0.04]" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Quick Add:</span>
                              {product.packSizes.map((pack) => {
                                const hasStock = product.stock >= pack.quantityPerPack;
                                return (
                                  <button
                                    key={pack.unit}
                                    type="button"
                                    disabled={!hasStock}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddToCart(product, pack, 1);
                                    }}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                                      hasStock
                                        ? 'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/25 text-emerald-300 hover:scale-[1.02] active:scale-95'
                                        : 'bg-slate-950 border-white/5 text-slate-500 opacity-50 cursor-not-allowed'
                                    }`}
                                    title={`1-Tap Add: 1 ${pack.name} (${pack.quantityPerPack} ${product.unit}s)`}
                                  >
                                    <span className="font-semibold text-white">{pack.name}</span>
                                    <span className="text-slate-400 text-[10px]">({pack.quantityPerPack} {product.unit}s)</span>
                                    <span className="text-emerald-400 font-mono font-bold ml-0.5">{format(pack.sellingPrice)}</span>
                                  </button>
                                );
                              })}
                            </div>
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
                <div className="text-center max-w-xs">
                  <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-3 text-slate-500">
                    <Package className="w-6 h-6 stroke-[1.5]" />
                  </div>
                  <p className="text-slate-300 font-semibold text-sm">No products found</p>
                  <p className="text-slate-500 text-xs mt-1">
                    {searchQuery
                      ? `No items matching "${searchQuery}"`
                      : 'Try adjusting your category or stock filter'}
                  </p>
                  {(searchQuery || selectedCategory !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setSelectedCategory('all');
                        searchInputRef.current?.focus();
                      }}
                      className="mt-3 px-3.5 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-xl transition-colors inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Reset filters
                    </button>
                  )}
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
                      <CartQuantityInput
                        value={item.quantity}
                        min={1}
                        onChange={(newQty) => updateQuantity(item.productId, newQty, item.packSize)}
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
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => navigate('/pos/discounts')}
                    className="py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl text-slate-300 hover:text-white font-medium text-xs transition-colors flex items-center justify-center space-x-1.5"
                  >
                    <Percent className="w-3.5 h-3.5 text-slate-400" />
                    <span>Discount</span>
                  </button>
                  <button
                    onClick={handleParkSale}
                    title="Park active sale (F8)"
                    className="py-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl text-amber-300 hover:text-amber-200 font-medium text-xs transition-colors flex items-center justify-center space-x-1.5"
                  >
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                    <span>Park (F8)</span>
                  </button>
                </div>
                <button
                  onClick={() => navigate('/pos/payment')}
                  className="w-full py-2.5 bg-linear-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 rounded-xl text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-between px-4 active:scale-[0.99]"
                >
                  <div className="flex items-center space-x-1.5">
                    <span>Proceed to Checkout</span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-black/15 text-slate-950 rounded font-bold">
                    F4
                  </kbd>
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
                    <CartQuantityInput
                      value={item.quantity}
                      min={1}
                      onChange={(newQty) => updateQuantity(item.productId, newQty, item.packSize)}
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
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setShowMobileCart(false);
                    navigate('/pos/discounts');
                  }}
                  className="py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl text-slate-300 hover:text-white font-medium text-xs transition-colors flex items-center justify-center space-x-1.5"
                >
                  <Percent className="w-3.5 h-3.5 text-slate-400" />
                  <span>Discount</span>
                </button>
                <button
                  onClick={() => {
                    setShowMobileCart(false);
                    handleParkSale();
                  }}
                  className="py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl text-amber-300 hover:text-amber-200 font-medium text-xs transition-colors flex items-center justify-center space-x-1.5"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Park Sale</span>
                </button>
              </div>
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
        <div className="fixed top-[calc(1rem+env(safe-area-inset-top))] right-4 z-50 max-w-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="bg-amber-950/80 border border-amber-500/40 text-amber-100 px-4 py-3.5 rounded-2xl shadow-2xl shadow-black/80 backdrop-blur-xl flex items-start space-x-3">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-xs font-bold text-amber-300">Stock Update</p>
              <p className="text-xs text-amber-200/90 mt-0.5 leading-relaxed">{stockWarning.message}</p>
            </div>
            <button
              onClick={() => setStockWarning(null)}
              className="text-amber-400/60 hover:text-amber-200 hover:bg-amber-500/10 p-1.5 rounded-lg transition-colors shrink-0"
              aria-label="Dismiss stock update"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Open Shift Modal */}
      <OpenShiftModal
        isOpen={showShiftModal}
        onClose={() => setShowShiftModal(false)}
        onSubmit={(openingCash) => openShiftMutation.mutate({ openingCash })}
        isLoading={openShiftMutation.isPending}
      />

      {/* Close Shift Modal */}
      {currentShift && (
        <CloseShiftModal
          isOpen={showCloseShiftModal}
          onClose={() => setShowCloseShiftModal(false)}
          onSubmit={(closingCash, notes) =>
            closeShiftMutation.mutate({
              shiftId: currentShift._id,
              closingCash,
              notes: notes || undefined,
            })
          }
          isLoading={closeShiftMutation.isPending}
          openingCash={currentShift.openingCash}
          totalSales={totalCashSales}
          totalExpenses={totalExpenses}
          expectedCash={expectedCash}
          salesCount={salesCount}
        />
      )}

      {/* Expense Modal */}
      {currentShift && (
        <ExpenseModal
          isOpen={showExpenseModal}
          onClose={() => setShowExpenseModal(false)}
          onSubmit={(data) => createExpenseMutation.mutate(data)}
          isLoading={createExpenseMutation.isPending}
        />
      )}

      {/* Pack Size Selector Modal */}
      <Modal
        isOpen={showPackSizeModal && !!selectedProductForPack}
        onClose={() => setShowPackSizeModal(false)}
        title="Choose How to Sell"
        size="md"
      >
        {selectedProductForPack && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="p-3.5 bg-slate-950/70 border border-white/10 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-white font-semibold text-base truncate">
                    {selectedProductForPack.name}
                  </h3>
                  {selectedProductForPack.brand && (
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/10">
                      {selectedProductForPack.brand}
                    </span>
                  )}
                  {selectedProductForPack.sku && (
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 text-slate-400 border border-white/5">
                      SKU: {selectedProductForPack.sku}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <Package className="w-3.5 h-3.5 text-emerald-400" />
                    Dispensary Stock:
                  </span>
                  <span className="font-medium text-emerald-300">
                    {getStockDisplay(selectedProductForPack.stock, selectedProductForPack.unit, selectedProductForPack.packSizes)}
                  </span>
                  <span className="text-slate-500">
                    ({selectedProductForPack.stock} total {selectedProductForPack.unit ? `${selectedProductForPack.unit}${selectedProductForPack.stock === 1 ? '' : 's'}` : 'units'})
                  </span>
                </div>
              </div>

              {/* Quantity Stepper */}
              <div className="flex items-center gap-2 bg-slate-900/90 border border-white/10 rounded-xl p-1.5 self-start sm:self-auto">
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold px-2">Packs/Qty:</span>
                <button
                  type="button"
                  onClick={() => setPackSelectionQty((prev) => Math.max(1, prev - 1))}
                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors disabled:opacity-30"
                  disabled={packSelectionQty <= 1}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-8 text-center font-bold font-mono text-white text-sm">
                  {packSelectionQty}
                </span>
                <button
                  type="button"
                  onClick={() => setPackSelectionQty((prev) => prev + 1)}
                  className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-white flex items-center justify-center transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Packaging Option Cards */}
            <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
              {/* Base unit option */}
              {(() => {
                const baseStockRequired = 1 * packSelectionQty;
                const hasBaseStock = selectedProductForPack.stock >= baseStockRequired;
                const totalBasePrice = selectedProductForPack.price * packSelectionQty;
                const unitName = selectedProductForPack.unit || 'unit';

                return (
                  <button
                    type="button"
                    onClick={() => {
                      if (!hasBaseStock) return;
                      handleAddToCart(selectedProductForPack, undefined, packSelectionQty);
                      setShowPackSizeModal(false);
                    }}
                    disabled={!hasBaseStock}
                    className={`w-full p-4 rounded-2xl border text-left transition-all group flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      !hasBaseStock
                        ? 'bg-slate-950/40 border-rose-500/20 opacity-50 cursor-not-allowed'
                        : 'bg-slate-950/70 border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/[0.04]'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold text-sm group-hover:text-emerald-300 transition-colors">
                          Single {unitName}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-white/10">
                          Single Item
                        </span>
                      </div>
                      <p className="text-slate-400 text-xs">
                        Sold individually as loose {unitName}s
                      </p>
                      <p className="text-[11px] text-slate-400">
                        Dispensary Stock: <span className={hasBaseStock ? 'text-emerald-400 font-medium' : 'text-rose-400 font-medium'}>{selectedProductForPack.stock} loose {unitName}s available</span>
                      </p>
                      {!hasBaseStock && (
                        <p className="text-[11px] text-rose-400 font-medium">
                          Insufficient stock for {packSelectionQty} {unitName}{packSelectionQty === 1 ? '' : 's'}
                        </p>
                      )}
                    </div>

                    <div className="text-right sm:self-center">
                      <p className="text-emerald-400 font-bold font-mono text-base">
                        {format(totalBasePrice)}
                      </p>
                      {packSelectionQty > 1 && (
                        <p className="text-[11px] text-slate-400 font-mono">
                          {format(selectedProductForPack.price)} each
                        </p>
                      )}
                      {hasBaseStock && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400/80 font-medium mt-1 group-hover:text-emerald-300">
                          Add {packSelectionQty} to order <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })()}

              {/* Pack sizes options */}
              {selectedProductForPack.packSizes?.map((pack) => {
                const stockRequired = pack.quantityPerPack * packSelectionQty;
                const availablePacks = Math.floor(selectedProductForPack.stock / pack.quantityPerPack);
                const hasPackStock = selectedProductForPack.stock >= stockRequired;
                const totalPackPrice = pack.sellingPrice * packSelectionQty;
                const unitName = selectedProductForPack.unit || 'unit';

                // Bulk price & savings comparison
                const effectiveUnitPrice = pack.quantityPerPack > 0 ? pack.sellingPrice / pack.quantityPerPack : pack.sellingPrice;
                const regularPrice = selectedProductForPack.price || 0;
                const savingsPercent =
                  regularPrice > 0 && effectiveUnitPrice < regularPrice
                    ? Math.round(((regularPrice - effectiveUnitPrice) / regularPrice) * 100)
                    : 0;

                return (
                  <button
                    key={pack.unit}
                    type="button"
                    onClick={() => {
                      if (!hasPackStock) return;
                      handleAddToCart(selectedProductForPack, pack, packSelectionQty);
                      setShowPackSizeModal(false);
                    }}
                    disabled={!hasPackStock}
                    className={`w-full p-4 rounded-2xl border text-left transition-all group flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      !hasPackStock
                        ? 'bg-slate-950/40 border-rose-500/20 opacity-50 cursor-not-allowed'
                        : 'bg-slate-950/70 border-white/10 hover:border-emerald-500/50 hover:bg-emerald-500/[0.04]'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold text-sm transition-colors ${hasPackStock ? 'text-white group-hover:text-emerald-300' : 'text-slate-400'}`}>
                          {pack.name}
                        </span>
                        <span className="text-[10px] font-semibold tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-300 border border-blue-500/20">
                          Contains {pack.quantityPerPack} {unitName}{pack.quantityPerPack === 1 ? '' : 's'}
                        </span>
                        {savingsPercent > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-0.5">
                            <Percent className="w-2.5 h-2.5" />
                            SAVE {savingsPercent}%
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span>≈ {format(effectiveUnitPrice)} each</span>
                        <span className="text-slate-600">·</span>
                        <span className={availablePacks > 0 ? 'text-slate-300' : 'text-rose-400'}>
                          {availablePacks} full {pack.name.toLowerCase()}{availablePacks === 1 ? '' : 's'} available
                        </span>
                      </div>

                      {!hasPackStock && (
                        <p className="text-[11px] text-rose-400 font-medium pt-0.5">
                          Insufficient stock for {packSelectionQty} {pack.name.toLowerCase()}{packSelectionQty === 1 ? '' : 's'} ({stockRequired} {unitName}s needed, only {selectedProductForPack.stock} available)
                        </p>
                      )}
                    </div>

                    <div className="text-right sm:self-center">
                      <p className={`font-bold font-mono text-base ${hasPackStock ? 'text-emerald-400' : 'text-slate-500'}`}>
                        {format(totalPackPrice)}
                      </p>
                      {packSelectionQty > 1 && (
                        <p className="text-[11px] text-slate-400 font-mono">
                          {format(pack.sellingPrice)} each
                        </p>
                      )}
                      {hasPackStock && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400/80 font-medium mt-1 group-hover:text-emerald-300">
                          Add {packSelectionQty} to order <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowPackSizeModal(false)}
                className="w-full py-2.5 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 font-medium text-xs rounded-xl border border-white/[0.08] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </Modal>

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

      {/* Universal Web Camera Barcode Scanner Modal */}
      <ScannerModal />
      </div>
    </POSLayout>
  );
};

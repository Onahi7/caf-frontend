import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCartStore } from '../../stores/cart-store';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAlertReplacement } from '../../hooks/useAlertReplacement';
import { useToast } from '../../hooks/useToast';
import { useCurrency } from '../../hooks/useCurrency';
import { useHaptics } from '../../hooks/useHaptics';
import apiClient from '../../lib/api-client';
import { getErrorMessage } from '../../lib/error-utils';
import { useAuthStore } from '../../stores/auth-store';
import { queryKeys } from '../../lib/query-keys';
import { CustomerTypeahead, type CustomerOption } from '../../components/ui/CustomerTypeahead';
import { useHeldSalesStore } from '../../stores/held-sales-store';
import { AlertTriangle, Clock, ArrowLeft, Receipt, CreditCard, CheckCircle2, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { OpenShiftModal } from '../../components/pos/ShiftModals';
import { 
  CartSummary, 
  PaymentMethodCard, 
  ConfirmationModal, 
  CheckoutSkeleton,
  type PaymentMethodConfig 
} from '../../components/checkout';

type PaymentMethod =
  | 'cash'
  | 'card'
  | 'orange_money'
  | 'africell_money'
  | 'qmoney'
  | 'bank_transfer'
  | 'insurance'
  | 'credit';
type CreditCollectionMethod =
  | 'cash'
  | 'card'
  | 'orange_money'
  | 'africell_money'
  | 'qmoney'
  | 'bank_transfer';

interface Shift {
  _id: string;
  status: 'open' | 'closed';
}

interface RecentSale {
  _id: string;
  total: number;
  createdAt: string;
  paymentMethod?: string;
  items?: Array<unknown>;
}

interface PaymentMethodDef {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
  brandColor?: string;
  brandBg?: string;
}

export const PaymentPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { items, total: cartTotal, discount, manualDiscount, promotionId, subtotal, prescriptionUrl, clearCart } = useCartStore();
  const holdSale = useHeldSalesStore((s) => s.holdSale);
  const heldSales = useHeldSalesStore((s) => s.heldSales);
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const user = useAuthStore((state) => state.user);
  const branchId = user?.role === 'super_admin'
    ? (getBranchId(selectedBranch) || user?.branchId)
    : (user?.branchId || getBranchId(selectedBranch));
  const { alertInfo } = useAlertReplacement();
  const { showSuccess, showError } = useToast();
  const { format, symbol } = useCurrency();
  const { haptic } = useHaptics();

  // currencyCode is refreshed centrally by POSLayout
  const currencyCode = selectedBranch?.currencyCode ?? 'SLE';
  const isUSD = currencyCode === 'USD';

  const terminalId = 'TERMINAL-01';
  
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState(cartTotal.toFixed(2));
  const isAmountManuallyEditedRef = useRef(false);
  const [creditCustomerName, setCreditCustomerName] = useState('');
  const [creditCustomerPhone, setCreditCustomerPhone] = useState('');
  const [creditDueDate, setCreditDueDate] = useState('');
  const [creditCustomerId, setCreditCustomerId] = useState<string | undefined>(undefined);
  const [linkedCustomer, setLinkedCustomer] = useState<CustomerOption | null>(null);
  const [creditAmountPaid, setCreditAmountPaid] = useState('0');

  const { data: checkoutQuote, isLoading: quoteLoading } = useQuery({
    queryKey: ['checkout-quote', branchId, promotionId, manualDiscount, items],
    queryFn: async () => {
      if (!branchId) throw new Error('Missing branch ID');
      const payload: Record<string, unknown> = {
        branchId,
        discount: typeof manualDiscount === 'number' && manualDiscount >= 0 ? manualDiscount : 0,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          ...(item.packSize ? {
            packSize: {
              code: item.packSize.code,
              name: item.packSize.name,
              unit: item.packSize.unit,
              quantityPerPack: item.packSize.quantityPerPack,
              barcode: item.packSize.barcode,
            },
          } : {}),
          quantityInBaseUnits: item.quantityInBaseUnits,
        })),
      };
      if (promotionId && promotionId.trim() && promotionId !== 'null') {
        payload.promotionId = promotionId;
      }
      const response = await apiClient.post('/sales/quote', payload);
      return response.data as { subtotal: number; discount: number; taxAmount: number; total: number };
    },
    enabled: Boolean(branchId && items.length),
    retry: 1,
  });
  const total = checkoutQuote?.total ?? cartTotal;

  useEffect(() => {
    if (checkoutQuote && paymentMethod === 'cash' && !isAmountManuallyEditedRef.current) {
      setAmountReceived(checkoutQuote.total.toFixed(2));
    }
  }, [checkoutQuote, paymentMethod]);
  const [creditInitialMethod, setCreditInitialMethod] =
    useState<CreditCollectionMethod>('cash');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [emailAddress, setEmailAddress] = useState('');
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [paymentReference, setPaymentReference] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const paymentSectionRef = useRef<HTMLDivElement>(null);

  const openShiftMutation = useMutation({
    mutationFn: async (openingCash: number) => {
      const response = await apiClient.post('/shifts/open', {
        branchId,
        openingCash,
        terminalId,
      });
      return response.data;
    },
    onSuccess: () => {
      showSuccess('Shift opened! You can now complete the transaction.');
      setShowOpenShiftModal(false);
      queryClient.invalidateQueries({
        queryKey: queryKeys.shifts.current({
          branchId: getBranchId(selectedBranch),
          cashierId: user?.id,
          terminalId,
        }),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.shifts.current({
          branchId: getBranchId(selectedBranch),
          cashierId: user?.id,
        }),
      });
    },
    onError: (error) => {
      showError(getErrorMessage(error, 'Failed to open shift'));
    },
  });

  const { data: currentShift, refetch: refetchCurrentShift } = useQuery({
    queryKey: ['pos-payment-current-shift', getBranchId(selectedBranch), user?.id],
    queryFn: async () => {
      const branchId = getBranchId(selectedBranch);
      const cashierId = user?.id;

      if (!branchId || !cashierId) {
        throw new Error('Missing required parameters: branchId and cashierId');
      }

      try {
        const response = await apiClient.get('/shifts/current', {
          params: { branchId, cashierId, terminalId },
        });
        const shiftData = response.data?.data ?? response.data;
        if (shiftData && shiftData._id && shiftData.status === 'open') {
          return shiftData as Shift;
        }
      } catch {
        // Fall through to query without terminalId
      }

      const fallbackResponse = await apiClient.get('/shifts/current', {
        params: { branchId, cashierId },
      });
      const fallbackData = fallbackResponse.data?.data ?? fallbackResponse.data;
      return (fallbackData || null) as Shift | null;
    },
    enabled: !!getBranchId(selectedBranch) && !!user?.id,
    refetchInterval: 15000,
    retry: false,
  });

  const changeDue = Math.max(0, parseFloat(amountReceived || '0') - total);
  const parsedCreditAmount = parseFloat(creditAmountPaid || '0');
  const parsedAmountReceived = parseFloat(amountReceived || '0');
  const isShiftOpen = Boolean(currentShift && currentShift.status === 'open');
  const isCashValid = paymentMethod !== 'cash' || (!isNaN(parsedAmountReceived) && parsedAmountReceived >= total);
  const isCreditValid =
    paymentMethod !== 'credit' ||
    (Boolean(creditDueDate) &&
      !isNaN(parsedCreditAmount) &&
      parsedCreditAmount >= 0 &&
      parsedCreditAmount <= total);

  // Remove skeleton loader after initial mount
  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoad(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Scroll to payment method section when it changes
  useEffect(() => {
    if (paymentSectionRef.current) {
      paymentSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [paymentMethod]);

  // Smart quick amounts based on total
  const getSmartQuickAmounts = useCallback(() => {
    if (isUSD) {
      const base = [5, 10, 20, 50, 100];
      if (total > 100) return [50, 100, 200, 500];
      if (total > 50) return [20, 50, 100, 200];
      return base;
    } else {
      const base = [10000, 20000, 50000, 100000, 200000];
      if (total > 200000) return [100000, 200000, 500000, 1000000];
      if (total > 100000) return [50000, 100000, 200000, 500000];
      return base;
    }
  }, [total, isUSD]);

  const quickAmounts = getSmartQuickAmounts();

  // Email receipt mutation
  const emailReceiptMutation = useMutation({
    mutationFn: async (data: { saleId: string; email: string }) => {
      const response = await apiClient.post('/email/receipt', {
        saleId: data.saleId,
        email: data.email,
      });
      return response.data;
    },
    onSuccess: () => {
      showSuccess('Receipt sent successfully');
      setShowEmailModal(false);
      setEmailAddress('');
    },
    onError: (error) => {
      showError(getErrorMessage(error, 'Failed to send receipt'));
    },
  });

  const handleHoldSale = () => {
    if (items.length === 0) {
      showError('Cart is empty');
      return;
    }
    if (!user?.id || !branchId) {
      showError('Cannot hold sale: missing user or branch');
      return;
    }
    haptic('medium');
    const customerName = paymentMethod === 'credit' ? creditCustomerName.trim() : undefined;
    const customerPhone = paymentMethod === 'credit' ? creditCustomerPhone.trim() : undefined;
    const heldCount = heldSales.length + 1;
    const defaultLabel = customerName
      ? `Sale for ${customerName}`
      : `Sale ${heldCount}`;
    const held = holdSale({
      label: defaultLabel,
      items: items.map((i) => ({ ...i })),
      discount,
      manualDiscount,
      promotionId,
      prescriptionUrl,
      customerId: paymentMethod === 'credit' ? creditCustomerId : undefined,
      customerName,
      customerPhone,
      heldBy: user.id,
      branchId,
      subtotal,
      total,
    });
    clearCart();
    showSuccess(`Held "${held.label}" - ${heldSales.length + 1} sale(s) parked`);
    navigate(-1);
  };

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    haptic('light');
    setPaymentMethod(method);
    if (method !== 'orange_money' && method !== 'africell_money' && method !== 'qmoney') {
      setPaymentReference('');
    }
  };

  const handleEmailReceipt = () => {
    if (!emailAddress) {
      showError('Please enter an email address');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) {
      showError('Please enter a valid email address');
      return;
    }
    if (!lastSaleId) {
      showError('No sale to email');
      return;
    }

    emailReceiptMutation.mutate({ saleId: lastSaleId, email: emailAddress });
  };

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const effectiveBranchId = user?.role === 'super_admin'
        ? (getBranchId(selectedBranch) || user?.branchId)
        : (user?.branchId || getBranchId(selectedBranch));
      const parsedAmount = parseFloat(amountReceived);
      
      if (!effectiveBranchId) {
        throw new Error('Branch ID is required');
      }
      
      if (items.length === 0) {
        throw new Error('No items in cart');
      }

      if (!currentShift || currentShift.status !== 'open') {
        throw new Error('No open shift found for this terminal');
      }
      
      if (isNaN(parsedAmount) || parsedAmount < 0) {
        throw new Error('Invalid amount received');
      }

      if (paymentMethod === 'credit') {
        if (!creditDueDate) {
          throw new Error('Due date is required for credit sales');
        }

        if (isNaN(parsedCreditAmount) || parsedCreditAmount < 0 || parsedCreditAmount > total) {
          throw new Error('Invalid upfront payment amount');
        }
      }

      const paymentMethodMap: Record<PaymentMethod, string> = {
        cash: 'cash',
        card: 'card',
        orange_money: 'orange_money',
        africell_money: 'africell_money',
        qmoney: 'qmoney',
        bank_transfer: 'bank_transfer',
        insurance: 'insurance',
        credit: 'credit',
      };

      const creditInitialMethodMap: Record<CreditCollectionMethod, string> = {
        cash: 'cash',
        card: 'card',
        orange_money: 'orange_money',
        africell_money: 'africell_money',
        qmoney: 'qmoney',
        bank_transfer: 'bank_transfer',
      };

      const payload = {
        branchId: effectiveBranchId,
        shiftId: currentShift._id,
        terminalId,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          ...(item.packSize ? {
            packSize: {
              code: item.packSize.code,
              name: item.packSize.name,
              unit: item.packSize.unit,
              quantityPerPack: item.packSize.quantityPerPack,
              barcode: item.packSize.barcode,
            },
          } : {}),
          quantityInBaseUnits: item.quantityInBaseUnits,
        })),
        discount: typeof manualDiscount === 'number' && manualDiscount >= 0 ? manualDiscount : 0,
        promotionId: promotionId && promotionId.trim() && promotionId !== 'null' ? promotionId : undefined,
        paymentMethod: paymentMethodMap[paymentMethod],
        paymentReference: ['orange_money', 'africell_money', 'qmoney'].includes(paymentMethod) && paymentReference.trim()
          ? paymentReference.trim()
          : undefined,
        saleType: paymentMethod === 'credit' ? 'credit' : 'cash',
        amountPaid: paymentMethod === 'credit' ? parsedCreditAmount : total,
        dueDate: paymentMethod === 'credit' ? creditDueDate : undefined,
        customerName: paymentMethod === 'credit' && creditCustomerName.trim() ? creditCustomerName.trim() : undefined,
        customerPhone: paymentMethod === 'credit' ? creditCustomerPhone.trim() || undefined : undefined,
        customerId: paymentMethod === 'credit' ? creditCustomerId : undefined,
        initialPaymentMethod:
          paymentMethod === 'credit' && parsedCreditAmount > 0
            ? creditInitialMethodMap[creditInitialMethod]
            : undefined,
      };

      try {
        const response = await apiClient.post('/sales/checkout', payload);
        return response.data;
      } catch (error) {
        // Temporary resilience: if backend throws 500 after commit, recover by
        // scanning most recent sales and redirecting to the created receipt.
        const axiosError = error as {
          response?: { status?: number };
        };
        if (axiosError?.response?.status === 500) {
          const recentResponse = await apiClient.get('/sales', {
            params: { branchId, limit: 10 },
          });

          const sales = (recentResponse.data?.data || []) as RecentSale[];
          const now = Date.now();
          const targetPaymentMethod = paymentMethodMap[paymentMethod];
          const candidate = sales.find((sale) => {
            const createdAtMs = new Date(sale.createdAt).getTime();
            const isFresh = Number.isFinite(createdAtMs) && now - createdAtMs < 2 * 60 * 1000;
            const sameTotal = Math.abs((sale.total || 0) - total) < 0.01;
            const sameItemCount = (sale.items?.length || 0) === items.length;
            const samePaymentMethod = sale.paymentMethod === targetPaymentMethod;
            return isFresh && sameTotal && sameItemCount && samePaymentMethod;
          });

          if (candidate?._id) {
            return {
              success: true,
              message: 'Checkout recovered from server error',
              data: {
                saleId: candidate._id,
              },
            };
          }
        }

        throw error;
      }
    },
    onSuccess: (data) => {
      const saleId = data?.data?.saleId;
      if (!saleId) {
        showError('Checkout completed but sale ID is missing from response');
        return;
      }

      haptic('success');
      setLastSaleId(saleId);
      clearCart();
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all(), exact: false });
      navigate(`/pos/receipt/${saleId}`);
    },
    onError: (error) => {
      haptic('error');
      showError(getErrorMessage(error, 'Failed to process checkout'));
    },
  });

  const canCompleteSale =
    !checkoutMutation.isPending &&
    items.length > 0 &&
    isShiftOpen &&
    isCashValid &&
    isCreditValid;

  const getDisabledReason = () => {
    if (items.length === 0) return 'No items in cart';
    if (!currentShift) return 'Register shift data unavailable';
    if (!isShiftOpen) return 'Register shift is closed. Click "Open Shift Now" above to begin.';
    if (paymentMethod === 'cash' && !isCashValid) {
      const short = total - (isNaN(parsedAmountReceived) ? 0 : parsedAmountReceived);
      return short > 0 ? `Amount received is short by ${format(short)}` : 'Please enter valid cash amount';
    }
    if (paymentMethod === 'credit' && !creditDueDate) return 'Please set a due date for credit sale';
    if (paymentMethod === 'credit' && parsedCreditAmount > total) return 'Upfront payment cannot exceed total';
    return null;
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Enter' && !showConfirmModal && !checkoutMutation.isPending) {
        const canPay = 
          (paymentMethod === 'cash' && parseFloat(amountReceived) >= total) ||
          (paymentMethod === 'credit' && creditDueDate) ||
          (paymentMethod !== 'cash' && paymentMethod !== 'credit');
        
        if (canPay && currentShift?.status === 'open') {
          setShowConfirmModal(true);
        }
      }

      if (e.key.toLowerCase() === 'h' && items.length > 0) {
        handleHoldSale();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [paymentMethod, amountReceived, total, creditDueDate, items.length, currentShift, showConfirmModal, checkoutMutation.isPending]);

  const allPaymentMethods: PaymentMethodDef[] = [
    { id: 'cash', label: 'Cash', shortLabel: 'Cash', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
    { id: 'bank_transfer', label: 'Bank Transfer', shortLabel: 'Transfer', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0012 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75z" />
      </svg>
    )},
    { id: 'credit', label: 'Credit Sale', shortLabel: 'Credit', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    )},
  ];

  const slePaymentMethods: PaymentMethodDef[] = [
    ...allPaymentMethods,
    { id: 'card', label: 'Debit Card', shortLabel: 'Card', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    )},
    { id: 'orange_money', label: 'Orange Money', shortLabel: 'Orange', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    )},
    { id: 'africell_money', label: 'Africell Money', shortLabel: 'Africell', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    )},
    { id: 'qmoney', label: 'QMoney', shortLabel: 'QMoney', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
    { id: 'insurance', label: 'Insurance', shortLabel: 'Insurance', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    )},
  ];

  const paymentMethods = isUSD ? allPaymentMethods : slePaymentMethods;

  const creditInitialMethods = isUSD
    ? ([
        { value: 'cash', label: 'Cash' },
        { value: 'bank_transfer', label: 'Bank Transfer' },
      ] as const)
    : ([
        { value: 'cash', label: 'Cash' },
        { value: 'card', label: 'Card' },
        { value: 'orange_money', label: 'Orange Money' },
        { value: 'africell_money', label: 'Africell Money' },
        { value: 'qmoney', label: 'QMoney' },
        { value: 'bank_transfer', label: 'Bank Transfer' },
      ] as const);

  return (
    <>
      {isInitialLoad ? (
        <CheckoutSkeleton />
      ) : (
        <div className="h-[100dvh] bg-slate-950 flex flex-col overflow-hidden pt-safe-top">
          {/* Header */}
          <header className="shrink-0 border-b border-white/[0.08] bg-slate-900/80 backdrop-blur-xl px-4 sm:px-6 py-3">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => navigate(-1)} 
                  className="w-10 h-10 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] flex items-center justify-center text-slate-400 hover:text-white transition-colors active:scale-95"
                  aria-label="Go back"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div>
                  <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">Checkout Terminal</h1>
                  <p className="text-xs text-slate-400">{items.length} item{items.length === 1 ? '' : 's'} in order</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[11px] text-slate-300">Enter</kbd>
                <span>to pay</span>
              </div>
            </div>
          </header>

          {/* Main 2-Column Responsive Layout - Scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
            <div className="max-w-7xl mx-auto lg:grid lg:grid-cols-12 lg:gap-8 items-start">
              
              {/* LEFT COLUMN: Order Summary & Totals */}
              <div className="lg:col-span-5 space-y-4">
                {/* Cart Summary */}
                <CartSummary
                  items={items}
                  subtotal={subtotal}
                  discount={discount}
                  total={total}
                  format={format}
                />

                {(checkoutQuote?.taxAmount ?? 0) > 0 && (
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                    <span className="text-gray-400">Tax</span>
                    <span className="font-medium text-white">{format(checkoutQuote?.taxAmount ?? 0)}</span>
                  </div>
                )}

                {/* Amount Due Card */}
                <div className="rounded-2xl bg-gradient-to-br from-emerald-500/20 via-emerald-500/10 to-transparent border border-emerald-500/25 p-5 sm:p-6 text-center backdrop-blur-lg shadow-xl shadow-emerald-950/20">
                  <p className="text-emerald-400 text-xs font-semibold uppercase tracking-wider">Total Amount Due</p>
                  <p
                    className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white mt-2 tracking-tight tabular-nums break-words leading-tight animate-in fade-in duration-500"
                    title={quoteLoading ? undefined : format(total)}
                  >
                    {quoteLoading ? 'Calculating…' : format(total)}
                  </p>
                  {discount > 0 && (
                    <p className="text-xs text-slate-400 mt-2 animate-in slide-in-from-bottom duration-300">
                      Subtotal {format(subtotal)} <span className="text-rose-400 font-semibold">-{format(discount)}</span>
                    </p>
                  )}
                </div>

                {/* Desktop Order Actions */}
                <div className="hidden lg:grid grid-cols-2 gap-2.5 pt-1">
                  <button
                    onClick={handleHoldSale}
                    disabled={items.length === 0}
                    className="py-2.5 px-3 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs active:scale-95"
                    aria-label={`Hold sale${heldSales.length > 0 ? ` (${heldSales.length} held)` : ''}`}
                  >
                    <Clock className="w-4 h-4 text-slate-400" />
                    Hold{heldSales.length > 0 ? ` (${heldSales.length})` : ''}
                  </button>
                  <button
                    onClick={() => lastSaleId && setShowEmailModal(true)}
                    disabled={!lastSaleId}
                    className="py-2.5 px-3 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] font-semibold rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs active:scale-95"
                    aria-label="Email receipt"
                  >
                    <Receipt className="w-4 h-4 text-slate-400" />
                    Email Receipt
                  </button>
                </div>
              </div>

              {/* RIGHT COLUMN: Shift Alert, Payment Selection, Tender Inputs, Complete CTA */}
              <div className="lg:col-span-7 space-y-4 mt-6 lg:mt-0">
                {/* Shift Warning Banner if not open */}
                {!isShiftOpen && (
                  <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent p-4 sm:p-5 backdrop-blur-md">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-amber-200">Register Shift Required</h4>
                          <p className="text-[11px] sm:text-xs text-amber-300/80 mt-0.5">
                            An open shift is required to record cash and credit transactions.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowOpenShiftModal(true)}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-bold text-xs rounded-xl shadow-md shadow-emerald-500/20 hover:from-emerald-400 hover:to-teal-500 transition-all shrink-0 active:scale-95 cursor-pointer"
                      >
                        <Clock className="w-3.5 h-3.5 stroke-[2.5]" />
                        Open Shift Now
                      </button>
                    </div>
                  </div>
                )}

                {/* Payment Methods */}
                <div className="rounded-2xl border border-white/[0.08] bg-slate-900/60 p-4 sm:p-5 backdrop-blur-md" ref={paymentSectionRef}>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Select Payment Method</p>
                  <div className="grid gap-2.5 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                    {paymentMethods.map((method) => (
                      <PaymentMethodCard
                        key={method.id}
                        method={method as PaymentMethodConfig}
                        isActive={paymentMethod === method.id}
                        onClick={() => handlePaymentMethodChange(method.id as PaymentMethod)}
                      />
                    ))}
                  </div>
                </div>

                {/* Cash Input - Smart Quick Amounts */}
                {paymentMethod === 'cash' && (
                  <div className="rounded-2xl border border-white/[0.08] bg-slate-900/60 p-4 sm:p-5 backdrop-blur-md space-y-3 animate-in slide-in-from-right duration-300">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Amount Received</p>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-400 text-lg font-bold">{symbol}</span>
                      <input
                        type="number"
                        value={amountReceived}
                        onFocus={() => {
                          isAmountManuallyEditedRef.current = true;
                        }}
                        onChange={(e) => {
                          isAmountManuallyEditedRef.current = true;
                          setAmountReceived(e.target.value);
                        }}
                        onWheel={(e) => e.currentTarget.blur()}
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-950/60 border border-white/10 rounded-xl text-white text-xl sm:text-2xl font-bold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-all font-mono"
                        aria-label="Amount received"
                      />
                    </div>
                    {/* Smart Quick Amount Buttons */}
                    <div className="flex gap-2 flex-wrap">
                      {quickAmounts.map((amt) => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => {
                            haptic('light');
                            isAmountManuallyEditedRef.current = true;
                            setAmountReceived(amt.toString());
                          }}
                          className="flex-1 min-w-[70px] py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs sm:text-sm font-semibold text-slate-300 hover:border-emerald-500/50 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all active:scale-95 font-mono"
                        >
                          {symbol}{amt.toLocaleString()}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          haptic('light');
                          isAmountManuallyEditedRef.current = true;
                          setAmountReceived(total.toFixed(2));
                        }}
                        className="flex-1 min-w-[70px] py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-xs sm:text-sm font-bold text-emerald-300 hover:bg-emerald-500/25 transition-all active:scale-95 font-mono"
                      >
                        Exact
                      </button>
                    </div>
                    {/* Change Due */}
                    {changeDue > 0 && (
                      <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/25 animate-in fade-in slide-in-from-bottom duration-300">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          </div>
                          <span className="text-xs sm:text-sm text-emerald-300 font-medium">Change Due</span>
                        </div>
                        <span className="text-lg sm:text-xl font-bold text-emerald-400 font-mono">{format(changeDue)}</span>
                      </div>
                    )}
                    {parseFloat(amountReceived || '0') < total && (
                      <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-rose-500/10 border border-rose-500/20 animate-in fade-in slide-in-from-bottom duration-300">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                          </div>
                          <span className="text-xs sm:text-sm text-rose-300 font-medium">Insufficient Amount</span>
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-rose-400 font-mono">{format(total - parseFloat(amountReceived || '0'))} short</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Mobile Money Reference */}
                {['orange_money', 'africell_money', 'qmoney'].includes(paymentMethod) && (
                  <div className="rounded-2xl border border-white/[0.08] bg-slate-900/60 p-4 sm:p-5 backdrop-blur-md space-y-3 animate-in slide-in-from-right duration-300">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Transaction Reference</p>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="Enter mobile transaction ID or reference"
                      className="w-full px-4 py-3 bg-slate-950/60 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-all text-sm"
                      aria-label="Transaction reference"
                    />
                    <p className="text-slate-400 text-xs flex items-center gap-1">
                      Optional: for customer reconciliation
                    </p>
                  </div>
                )}

                {/* Bank Transfer Reference */}
                {paymentMethod === 'bank_transfer' && (
                  <div className="rounded-2xl border border-white/[0.08] bg-slate-900/60 p-4 sm:p-5 backdrop-blur-md space-y-3 animate-in slide-in-from-right duration-300">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Transfer Reference</p>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="Enter bank reference or confirmation number"
                      className="w-full px-4 py-3 bg-slate-950/60 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-all text-sm"
                      aria-label="Bank transfer reference"
                    />
                    <p className="text-slate-400 text-xs flex items-center gap-1">
                      Optional: for bank record keeping
                    </p>
                  </div>
                )}

                {/* Credit Sale Form */}
                {paymentMethod === 'credit' && (
                  <div className="rounded-2xl border border-white/[0.08] bg-slate-900/60 p-4 sm:p-5 backdrop-blur-md space-y-4 animate-in slide-in-from-right duration-300">
                    {/* Credit Notice */}
                    <div className="rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-3.5 backdrop-blur-sm">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-amber-300 mb-0.5">Credit Sale Notice</p>
                          <p className="text-xs text-amber-200/80">
                            Inventory will be reduced now. The unpaid balance remains open on customer account.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-3.5 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <CustomerTypeahead
                          label="Customer Name"
                          value={creditCustomerName}
                          onChange={setCreditCustomerName}
                          onSelectCustomer={(c) => {
                            setCreditCustomerId(c._id);
                            setLinkedCustomer(c);
                            if (!creditCustomerPhone.trim() && c.phone) {
                              setCreditCustomerPhone(c.phone);
                            }
                          }}
                          onClearCustomer={() => {
                            setCreditCustomerId(undefined);
                            setLinkedCustomer(null);
                          }}
                          selectedCustomerId={creditCustomerId}
                          placeholder="Search or type customer name..."
                          helperText="Optional: track balance for registered customers"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Customer Phone</label>
                        <input
                          type="text"
                          value={creditCustomerPhone}
                          onChange={(e) => setCreditCustomerPhone(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-950/60 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-all text-sm"
                          placeholder="Optional"
                          aria-label="Customer phone"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                          Due Date <span className="text-rose-400">*</span>
                        </label>
                        <input
                          type="date"
                          value={creditDueDate}
                          onChange={(e) => setCreditDueDate(e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-950/60 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-all text-sm"
                          aria-label="Due date"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Upfront Partial Payment</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-bold text-sm">{symbol}</span>
                          <input
                            type="number"
                            min="0"
                            max={total}
                            step="0.01"
                            value={creditAmountPaid}
                            onChange={(e) => setCreditAmountPaid(e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            className="w-full pl-9 pr-4 py-2.5 bg-slate-950/60 border border-white/10 rounded-xl text-white font-semibold focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-all text-sm font-mono"
                            aria-label="Upfront payment amount"
                          />
                        </div>
                      </div>
                    </div>

                    {parsedCreditAmount > 0 && (
                      <div className="animate-in slide-in-from-bottom duration-300">
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Initial Payment Method</label>
                        <select
                          value={creditInitialMethod}
                          onChange={(e) => {
                            haptic('light');
                            setCreditInitialMethod(e.target.value as CreditCollectionMethod);
                          }}
                          className="w-full px-4 py-2.5 bg-slate-950/60 border border-white/10 rounded-xl text-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/30 transition-all text-sm"
                          aria-label="Initial payment method"
                        >
                          {creditInitialMethods.map((m) => (
                            <option key={m.value} value={m.value}>{m.label}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Balance Due */}
                    <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 backdrop-blur-sm animate-in fade-in slide-in-from-bottom duration-300">
                      <span className="text-xs sm:text-sm text-amber-300 font-medium">Remaining Balance Due</span>
                      <span className="text-lg font-bold text-amber-300 font-mono">
                        {format(Math.max(0, total - (Number.isFinite(parsedCreditAmount) ? parsedCreditAmount : 0)))}
                      </span>
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* Pinned Action Footer - Always visible and accessible on all viewports */}
          <footer className="shrink-0 border-t border-white/10 bg-slate-900/95 backdrop-blur-xl px-4 sm:px-6 py-3.5 pb-safe-bottom shadow-2xl z-30">
            <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Left summary / status */}
              <div className="flex items-center gap-3 min-w-0">
                {getDisabledReason() ? (
                  <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 font-medium">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                    <span className="truncate">{getDisabledReason()}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Total Due</span>
                      <span className="text-lg font-bold text-emerald-400 font-mono">{format(total)}</span>
                    </div>
                    {paymentMethod === 'cash' && changeDue > 0 && (
                      <div className="border-l border-white/10 pl-4">
                        <span className="text-slate-400 block text-[11px]">Change Due</span>
                        <span className="text-lg font-bold text-teal-300 font-mono">{format(changeDue)}</span>
                      </div>
                    )}
                    {paymentMethod === 'credit' && (
                      <div className="border-l border-white/10 pl-4">
                        <span className="text-slate-400 block text-[11px]">Unpaid Balance</span>
                        <span className="text-lg font-bold text-amber-300 font-mono">
                          {format(Math.max(0, total - (Number.isFinite(parsedCreditAmount) ? parsedCreditAmount : 0)))}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right action buttons */}
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={handleHoldSale}
                  disabled={items.length === 0}
                  className="px-4 py-3 bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 border border-white/[0.08] font-semibold rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-xs active:scale-95 cursor-pointer"
                  aria-label={`Hold sale${heldSales.length > 0 ? ` (${heldSales.length} held)` : ''}`}
                >
                  <Clock className="w-4 h-4 text-slate-400" />
                  <span>Hold{heldSales.length > 0 ? ` (${heldSales.length})` : ''}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    haptic('medium');
                    setShowConfirmModal(true);
                  }}
                  disabled={!canCompleteSale}
                  className="flex-1 sm:flex-none px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 font-bold rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer min-w-[210px]"
                  aria-label={paymentMethod === 'credit' ? 'Create credit sale' : 'Complete sale'}
                >
                  {paymentMethod === 'credit' ? (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>Create Credit Sale</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Complete Sale ({format(total)})</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </footer>
        </div>
      )}

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={() => {
          setShowConfirmModal(false);
          checkoutMutation.mutate();
        }}
        title="Confirm Payment"
        message={`Process payment of ${format(total)} via ${paymentMethod.replace('_', ' ')}?`}
        confirmText="Process Payment"
        cancelText="Review"
        isLoading={checkoutMutation.isPending}
        type="info"
      />

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setShowEmailModal(false)} />
          <div className="relative bg-slate-900/95 border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/80 max-w-md w-full p-6 animate-in zoom-in-95 duration-200 backdrop-blur-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-white tracking-tight">Email Receipt</h3>
              <button
                onClick={() => setShowEmailModal(false)}
                className="w-8 h-8 rounded-xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full px-3.5 py-2.5 bg-slate-950/70 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500/80 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                  autoFocus
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => setShowEmailModal(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleEmailReceipt}
                  isLoading={emailReceiptMutation.isPending}
                  className="flex-1"
                >
                  Send Receipt
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Open Shift Modal */}
      <OpenShiftModal
        isOpen={showOpenShiftModal}
        onClose={() => setShowOpenShiftModal(false)}
        onSubmit={(openingCash) => openShiftMutation.mutate(openingCash)}
        isLoading={openShiftMutation.isPending}
      />
    </>
  );
};

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCartStore } from '../../stores/cart-store';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useToast } from '../../hooks/useToast';
import { useCurrency } from '../../hooks/useCurrency';
import { useHaptics } from '../../hooks/useHaptics';
import apiClient from '../../lib/api-client';
import { getErrorMessage } from '../../lib/error-utils';
import { useAuthStore } from '../../stores/auth-store';
import { queryKeys } from '../../lib/query-keys';
import { CustomerTypeahead, type CustomerOption } from '../../components/ui/CustomerTypeahead';
import { useHeldSalesStore } from '../../stores/held-sales-store';
import { AlertTriangle, Clock, ArrowLeft, Receipt, CreditCard, CheckCircle2, Plus, Trash2, User, UserCheck, Split } from 'lucide-react';
import { OpenShiftModal } from '../../components/pos/ShiftModals';
import { EmailInputModal } from '../../components/pos/EmailInputModal';
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
  | 'credit'
  | 'split';

export interface SplitPaymentLine {
  id: string;
  method: PaymentMethod;
  amount: number;
  reference?: string;
}
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
  const { showSuccess, showError, showWarning } = useToast();
  const { format, symbol } = useCurrency();
  const { haptic } = useHaptics();

  // currencyCode is refreshed centrally by POSLayout
  const currencyCode = selectedBranch?.currencyCode ?? 'SLE';
  const isUSD = currencyCode === 'USD';

  const terminalId = 'TERMINAL-01';
  
  const cartCustomer = useCartStore((s) => s.customer);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountReceived, setAmountReceived] = useState(cartTotal.toFixed(2));
  const isAmountManuallyEditedRef = useRef(false);
  const [creditCustomerName, setCreditCustomerName] = useState(cartCustomer?.name || '');
  const [creditCustomerPhone, setCreditCustomerPhone] = useState(cartCustomer?.phone || '');
  const [creditDueDate, setCreditDueDate] = useState('');
  const [creditCustomerId, setCreditCustomerId] = useState<string | undefined>(cartCustomer?.id);
  const [linkedCustomer, setLinkedCustomer] = useState<CustomerOption | null>(
    cartCustomer ? { _id: cartCustomer.id, name: cartCustomer.name, phone: cartCustomer.phone || '', email: cartCustomer.email } : null
  );
  const [creditAmountPaid, setCreditAmountPaid] = useState('0');
  const [splitLines, setSplitLines] = useState<SplitPaymentLine[]>([
    { id: '1', method: 'cash', amount: 0 },
    { id: '2', method: 'orange_money', amount: 0 },
  ]);

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

  // Keep displayed amount up to date if user has not manually modified tender
  const effectiveCashReceived = isAmountManuallyEditedRef.current
    ? amountReceived
    : (checkoutQuote?.total ?? cartTotal).toFixed(2);
  const [creditInitialMethod, setCreditInitialMethod] =
    useState<CreditCollectionMethod>('cash');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
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

  const { data: currentShift } = useQuery({
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

  const tenderToUse = isAmountManuallyEditedRef.current ? amountReceived : effectiveCashReceived;
  const parsedAmountReceived = parseFloat(tenderToUse || '0');
  const changeDue = Math.max(0, parsedAmountReceived - total);
  const parsedCreditAmount = parseFloat(creditAmountPaid || '0');
  const isShiftOpen = Boolean(currentShift && currentShift.status === 'open');
  const isCashValid = paymentMethod !== 'cash' || (!isNaN(parsedAmountReceived) && parsedAmountReceived >= total);
  const isCreditValid =
    paymentMethod !== 'credit' ||
    (Boolean(creditDueDate) &&
      !isNaN(parsedCreditAmount) &&
      parsedCreditAmount >= 0 &&
      parsedCreditAmount <= total);

  const totalSplitTendered = splitLines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
  const splitRemaining = Math.max(0, total - totalSplitTendered);
  const isSplitValid =
    paymentMethod !== 'split' ||
    (splitLines.length >= 2 &&
      Math.abs(totalSplitTendered - total) < 0.01 &&
      splitLines.every((l) => Number(l.amount) > 0));

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
    },
    onError: (error) => {
      showError(getErrorMessage(error, 'Failed to send receipt'));
    },
  });

  const handleHoldSale = useCallback(() => {
    if (items.length === 0) {
      showError('Cart is empty');
      return;
    }
    if (!user?.id || !branchId) {
      showError('Cannot hold sale: missing user or branch');
      return;
    }
    haptic('medium');
    const customerName = (creditCustomerName.trim() || cartCustomer?.name) || undefined;
    const customerPhone = (creditCustomerPhone.trim() || cartCustomer?.phone) || undefined;
    const customerId = creditCustomerId || cartCustomer?.id || undefined;
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
      customerId,
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
  }, [items, user, branchId, haptic, creditCustomerName, cartCustomer, creditCustomerPhone, creditCustomerId, heldSales.length, holdSale, discount, manualDiscount, promotionId, prescriptionUrl, subtotal, total, clearCart, showSuccess, navigate, showError]);

  const handlePaymentMethodChange = (method: PaymentMethod) => {
    haptic('light');
    setPaymentMethod(method);
    if (method !== 'orange_money' && method !== 'africell_money' && method !== 'qmoney') {
      setPaymentReference('');
    }
  };

  const handleEmailReceipt = (email: string) => {
    if (!lastSaleId) {
      showError('No sale to email');
      return;
    }
    emailReceiptMutation.mutate({ saleId: lastSaleId, email });
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

      if (paymentMethod === 'split') {
        if (splitLines.length < 2) {
          throw new Error('Split tender requires at least 2 payment methods');
        }
        if (Math.abs(totalSplitTendered - total) > 0.01) {
          throw new Error(`Total split payments (${totalSplitTendered.toFixed(2)}) must match order total (${total.toFixed(2)})`);
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
        split: 'split',
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
        payments: paymentMethod === 'split' ? splitLines.map((line) => ({
          paymentMethod: paymentMethodMap[line.method],
          amount: Number(line.amount),
          paymentReference: line.reference?.trim() || undefined,
        })) : undefined,
        paymentReference: ['orange_money', 'africell_money', 'qmoney'].includes(paymentMethod) && paymentReference.trim()
          ? paymentReference.trim()
          : undefined,
        saleType: paymentMethod === 'credit' ? 'credit' : 'cash',
        amountPaid: paymentMethod === 'credit' ? parsedCreditAmount : (paymentMethod === 'split' ? totalSplitTendered : total),
        dueDate: paymentMethod === 'credit' ? creditDueDate : undefined,
        customerName: (creditCustomerName.trim() || cartCustomer?.name) || undefined,
        customerPhone: (creditCustomerPhone.trim() || cartCustomer?.phone) || undefined,
        customerId: creditCustomerId || cartCustomer?.id || undefined,
        initialPaymentMethod:
          paymentMethod === 'credit' && parsedCreditAmount > 0
            ? creditInitialMethodMap[creditInitialMethod]
            : undefined,
      };

      const response = await apiClient.post('/sales/checkout', payload);
      return response.data;
    },
    onSuccess: (data) => {
      setShowConfirmModal(false);
      haptic('success');
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all(), exact: false });
      queryClient.invalidateQueries({ queryKey: queryKeys.sales.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all() });
      clearCart();

      const saleId = data?.data?.saleId;
      if (!saleId) {
        showWarning(
          'Sale recorded',
          'The sale was recorded but the receipt ID is missing. Check Sales history for the record.'
        );
        navigate('/pos');
        return;
      }

      setLastSaleId(saleId);
      navigate(`/pos/receipt/${saleId}`);
    },
    onError: (error) => {
      haptic('error');
      setShowConfirmModal(false);

      const wasQueuedOffline = Boolean((error as { isOfflineQueued?: boolean })?.isOfflineQueued);
      if (wasQueuedOffline) {
        clearCart();
        showWarning(
          'Sale saved offline',
          'It will sync automatically when the connection returns. Do not re-enter this sale.'
        );
        navigate('/pos');
        return;
      }

      showError(getErrorMessage(error, 'Failed to process checkout'));
    },
  });

  const canCompleteSale =
    !checkoutMutation.isPending &&
    items.length > 0 &&
    isShiftOpen &&
    isCashValid &&
    isCreditValid &&
    isSplitValid;

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
    if (paymentMethod === 'split' && !isSplitValid) {
      if (splitLines.length < 2) return 'Split tender requires at least 2 payment methods';
      if (splitLines.some((l) => Number(l.amount) <= 0)) return 'Every split line needs an amount';
      return `Allocated ${format(totalSplitTendered)} of ${format(total)} — allocation must match the order total`;
    }
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
          (paymentMethod === 'cash' && parsedAmountReceived >= total) ||
          (paymentMethod === 'credit' && isCreditValid) ||
          (paymentMethod === 'split' && isSplitValid) ||
          (paymentMethod !== 'cash' && paymentMethod !== 'credit' && paymentMethod !== 'split');
        
        if (canPay && currentShift?.status === 'open') {
          setShowConfirmModal(true);
        }
      }

      if (e.key.toLowerCase() === 'h' && items.length > 0 && !showConfirmModal && !showEmailModal && !showOpenShiftModal && !checkoutMutation.isPending) {
        handleHoldSale();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [paymentMethod, parsedAmountReceived, total, isCreditValid, isSplitValid, items.length, currentShift, showConfirmModal, showEmailModal, showOpenShiftModal, checkoutMutation.isPending, handleHoldSale]);

  const allPaymentMethods: PaymentMethodDef[] = [
    { id: 'cash', label: 'Cash', shortLabel: 'Cash', icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
    { id: 'split', label: 'Split Tender', shortLabel: 'Split', icon: (
      <Split className="w-6 h-6" />
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
                {/* Active Customer Card */}
                <div className="rounded-2xl border border-white/[0.08] bg-slate-900/60 p-4 backdrop-blur-md">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shrink-0">
                        {creditCustomerName || cartCustomer ? <UserCheck className="w-4 h-4" /> : <User className="w-4 h-4 text-slate-500" />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-400 font-medium">Customer for Sale</p>
                        <p className="text-xs sm:text-sm font-bold text-white truncate">
                          {creditCustomerName || cartCustomer?.name || 'Walk-in Customer'}
                        </p>
                        {(creditCustomerPhone || cartCustomer?.phone) && (
                          <p className="text-[10px] text-slate-400 font-mono truncate">{creditCustomerPhone || cartCustomer?.phone}</p>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/pos/customers')}
                      className="px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-xs font-semibold text-emerald-400 transition-colors shrink-0"
                    >
                      {creditCustomerName || cartCustomer ? 'Change' : '+ Attach'}
                    </button>
                  </div>
                </div>

                {(checkoutQuote?.taxAmount ?? 0) > 0 && (
                  <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                    <span className="text-slate-400">Tax</span>
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
                    {paymentMethod === 'cash' && !isNaN(parsedAmountReceived) && parsedAmountReceived < total && (
                      <div className="flex items-center justify-between py-3 px-4 rounded-xl bg-rose-500/10 border border-rose-500/20 animate-in fade-in slide-in-from-bottom duration-300">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-lg bg-rose-500/20 flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                          </div>
                          <span className="text-xs sm:text-sm text-rose-300 font-medium">Insufficient Amount</span>
                        </div>
                        <span className="text-xs sm:text-sm font-bold text-rose-400 font-mono">{format(total - parsedAmountReceived)} short</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Split Tender Input */}
                {paymentMethod === 'split' && (
                  <div className="rounded-2xl border border-white/[0.08] bg-slate-900/60 p-4 sm:p-5 backdrop-blur-md space-y-4 animate-in slide-in-from-right duration-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Split Tender Allocation</p>
                        <p className="text-[11px] text-slate-400">Allocate total across multiple payment methods</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSplitLines([
                            ...splitLines,
                            { id: Date.now().toString(), method: 'card', amount: splitRemaining > 0 ? splitRemaining : 0 },
                          ]);
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-semibold transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add Line
                      </button>
                    </div>

                    {/* Split Lines List */}
                    <div className="space-y-3">
                      {splitLines.map((line, idx) => (
                        <div key={line.id} className="p-3.5 rounded-xl bg-slate-950/70 border border-white/[0.08] space-y-2.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-bold text-slate-300">Payment Line #{idx + 1}</span>
                            {splitLines.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setSplitLines(splitLines.filter((l) => l.id !== line.id))}
                                className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                            {/* Method Selector */}
                            <div className="sm:col-span-5">
                              <label className="block text-[10px] text-slate-400 font-medium mb-1">Method</label>
                              <select
                                value={line.method}
                                onChange={(e) => {
                                  const method = e.target.value as PaymentMethod;
                                  setSplitLines(splitLines.map((l) => l.id === line.id ? { ...l, method } : l));
                                }}
                                className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs font-semibold focus:outline-none focus:border-emerald-500"
                              >
                                <option value="cash">Cash</option>
                                <option value="card">Debit Card</option>
                                <option value="orange_money">Orange Money</option>
                                <option value="africell_money">Africell Money</option>
                                <option value="qmoney">QMoney</option>
                                <option value="bank_transfer">Bank Transfer</option>
                              </select>
                            </div>

                            {/* Amount Input */}
                            <div className="sm:col-span-4">
                              <label className="block text-[10px] text-slate-400 font-medium mb-1">Amount ({symbol})</label>
                              <div className="relative">
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={line.amount || ''}
                                  placeholder="0.00"
                                  onChange={(e) => {
                                    const amount = parseFloat(e.target.value) || 0;
                                    setSplitLines(splitLines.map((l) => l.id === line.id ? { ...l, amount } : l));
                                  }}
                                  className="w-full px-3 py-2 bg-slate-900 border border-white/10 rounded-xl text-white text-xs font-bold font-mono focus:outline-none focus:border-emerald-500"
                                />
                              </div>
                            </div>

                            {/* Fill Remaining CTA */}
                            <div className="sm:col-span-3 flex items-end">
                              <button
                                type="button"
                                onClick={() => {
                                  const currentOtherSum = splitLines.filter((l) => l.id !== line.id).reduce((s, l) => s + (Number(l.amount) || 0), 0);
                                  const fillAmt = Math.max(0, total - currentOtherSum);
                                  setSplitLines(splitLines.map((l) => l.id === line.id ? { ...l, amount: fillAmt } : l));
                                }}
                                className="w-full py-2 px-2 rounded-xl bg-white/[0.05] hover:bg-white/10 border border-white/10 text-[11px] font-semibold text-emerald-400 transition-colors"
                              >
                                Fill Remaining
                              </button>
                            </div>
                          </div>

                          {/* Reference for non-cash */}
                          {line.method !== 'cash' && (
                            <div>
                              <input
                                type="text"
                                value={line.reference || ''}
                                placeholder="Reference / Txn ID (optional)"
                                onChange={(e) => {
                                  const reference = e.target.value;
                                  setSplitLines(splitLines.map((l) => l.id === line.id ? { ...l, reference } : l));
                                }}
                                className="w-full px-3 py-1.5 bg-slate-900/60 border border-white/10 rounded-lg text-white text-[11px] placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Split Summary Bar */}
                    <div className="p-3.5 rounded-xl border border-white/[0.08] bg-slate-950/80 space-y-2">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Total Due</span>
                        <span className="font-mono text-white font-bold">{format(total)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>Total Allocated</span>
                        <span className="font-mono text-emerald-400 font-bold">{format(totalSplitTendered)}</span>
                      </div>
                      <div className="pt-2 border-t border-white/[0.08] flex justify-between items-center text-xs">
                        {Math.abs(totalSplitTendered - total) < 0.01 ? (
                          <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            <span>Tender allocation balanced exactly</span>
                          </div>
                        ) : totalSplitTendered < total ? (
                          <div className="flex items-center gap-1.5 text-rose-300 font-bold">
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                            <span>Remaining to allocate: {format(total - totalSplitTendered)}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                            <AlertTriangle className="w-4 h-4 text-amber-400" />
                            <span>Change/Overallocated: {format(totalSplitTendered - total)}</span>
                          </div>
                        )}
                      </div>
                    </div>
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
        onConfirm={() => checkoutMutation.mutate()}
        title="Confirm Payment"
        message={`Process payment of ${format(total)} via ${paymentMethod.replace('_', ' ')}?`}
        confirmText={checkoutMutation.isPending ? 'Processing…' : 'Process Payment'}
        cancelText="Review"
        isLoading={checkoutMutation.isPending}
        type="info"
      />

      {/* Email Modal */}
      <EmailInputModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        onSubmit={handleEmailReceipt}
        isLoading={emailReceiptMutation.isPending}
      />

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

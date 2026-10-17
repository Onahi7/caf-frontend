import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../lib/api-client';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import { useCurrency } from '../../hooks/useCurrency';
import { useDebounce } from '../../hooks/useDebounce';
import { QRScannerModal } from '../../components/pos/QRScannerModal';
import { Button } from '../../components/ui/Button';
import { queryKeys } from '../../lib/query-keys';
import { getErrorMessage } from '../../lib/error-utils';
import { formatDate } from '../../lib/date-format';
import { POSLayout } from '../../components/pos/POSLayout';
import { 
  ArrowLeft, 
  Search, 
  ScanLine, 
  RotateCcw, 
  Check, 
  CheckCircle2, 
  AlertTriangle, 
  Package, 
  ShieldAlert,
  Minus,
  Plus,
  Receipt
} from 'lucide-react';

interface SaleItem {
  saleItemId?: string;
  batchId?: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  returnedQuantity?: number;
}

interface Sale {
  _id: string;
  receiptNumber: string;
  customerName?: string;
  items: SaleItem[];
  total: number;
  createdAt: string;
  status: string;
  returnedAmount?: number;
}

interface ReturnItem {
  lineKey: string;
  saleItemId?: string;
  batchId?: string;
  productId: string;
  productName: string;
  quantity: number;
  maxQuantity: number;
  unitPrice: number;
  condition: 'restock' | 'quarantine';
  selected: boolean;
}

export const ProcessReturnPage = () => {
  const navigate = useNavigate();
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const { showSuccess, showError, showWarning } = useToast();
  const requestConfirmation = useConfirm();
  const { format } = useCurrency();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [showReturnForm, setShowReturnForm] = useState(false);

  const { data: recentSales, isLoading } = useQuery({
    queryKey: queryKeys.sales.recent({
      branchId: getBranchId(selectedBranch),
      search: debouncedSearch,
      limit: 20,
    }),
    queryFn: async () => {
      const branchId = getBranchId(selectedBranch);
      if (!branchId) throw new Error('Branch ID is required');

      const params: Record<string, string | number> = { branchId, limit: 20 };
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      const response = await apiClient.get('/sales', { params });
      return (response.data?.data ?? response.data) as Sale[];
    },
    enabled: !!getBranchId(selectedBranch),
    retry: false,
  });

  const returnMutation = useMutation({
    mutationFn: async (data: {
      saleId: string;
      items: Array<{ saleItemId?: string; batchId?: string; productId: string; quantity: number }>;
      reason: string;
    }) => {
      const response = await apiClient.post(`/sales/${data.saleId}/return`, {
        items: data.items,
        reason: data.reason,
      });
      return response.data;
    },
    onSuccess: (data) => {
      showSuccess(`Return processed successfully. Refund amount: ${format(data.data?.returnedAmount || 0)}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.sales.all(), exact: false });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all(), exact: false });
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all(), exact: false });
      setSelectedSale(null);
      setReturnItems([]);
      setReturnReason('');
      setShowReturnForm(false);
    },
    onError: (error: unknown) => {
      showError(getErrorMessage(error, 'Failed to process return'));
    },
  });

  const handleSelectSale = (sale: Sale) => {
    if (sale.status === 'returned') {
      showWarning('This sale has already been fully returned.');
      return;
    }

    setSelectedSale(sale);
    const items: ReturnItem[] = sale.items
      .map((item) => ({
        lineKey: item.saleItemId || item.batchId || item.productId,
        saleItemId: item.saleItemId,
        batchId: item.batchId,
        productId: item.productId,
        productName: item.productName || item.productId,
        quantity: 1,
        maxQuantity: item.quantity - (item.returnedQuantity || 0),
        unitPrice: item.quantity > 0 ? item.subtotal / item.quantity : 0,
        condition: 'restock' as const,
        selected: false,
      }))
      .filter((item) => item.maxQuantity > 0);

    setReturnItems(items);
    setShowReturnForm(true);
  };

  const handleToggleItem = (lineKey: string) => {
    setReturnItems((prev) =>
      prev.map((item) =>
        item.lineKey === lineKey ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleUpdateQuantity = (lineKey: string, quantity: number) => {
    setReturnItems((prev) =>
      prev.map((item) =>
        item.lineKey === lineKey
          ? { ...item, quantity: Math.max(1, Math.min(quantity, item.maxQuantity)) }
          : item
      )
    );
  };

  const handleToggleCondition = (lineKey: string, condition: 'restock' | 'quarantine') => {
    setReturnItems((prev) =>
      prev.map((item) =>
        item.lineKey === lineKey ? { ...item, condition } : item
      )
    );
  };

  const handleProcessReturn = async () => {
    if (!selectedSale) return;

    const itemsToReturn = returnItems
      .filter((item) => item.selected && item.quantity > 0)
      .map((item) => ({
        saleItemId: item.saleItemId,
        batchId: item.batchId,
        productId: item.productId,
        quantity: item.quantity,
      }));

    if (itemsToReturn.length === 0) {
      showWarning('Please select at least one item to return.');
      return;
    }

    const confirmed = await requestConfirmation({
      title: 'Process refund?',
      message: `Refund ${format(returnTotal)} for ${itemsToReturn.length} item${itemsToReturn.length === 1 ? '' : 's'} on receipt #${selectedSale.receiptNumber}. This cannot be undone.`,
      confirmLabel: 'Process refund',
      variant: 'warning',
    });
    if (!confirmed) return;

    // Build descriptive reason including quarantine details if applicable
    const quarantineCount = returnItems.filter((i) => i.selected && i.condition === 'quarantine').length;
    const conditionNote = quarantineCount > 0 ? ` [${quarantineCount} item(s) quarantined]` : ' [Restocked]';
    const finalReason = (returnReason.trim() || 'Customer return') + conditionNote;

    returnMutation.mutate({
      saleId: selectedSale._id,
      items: itemsToReturn,
      reason: finalReason,
    });
  };

  const selectedItems = returnItems.filter((item) => item.selected);
  const grossSubtotal = selectedSale?.items.reduce((sum, item) => sum + item.subtotal, 0) || 0;
  const netRatio = selectedSale && grossSubtotal > 0 ? selectedSale.total / grossSubtotal : 0;
  const returnTotal = selectedItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice * netRatio,
    0
  );

  return (
    <POSLayout title="Process Return">
      <div className="min-h-full bg-slate-950 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08] bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (showReturnForm) {
                  setShowReturnForm(false);
                  setSelectedSale(null);
                } else {
                  navigate(-1);
                }
              }}
              className="text-slate-300 hover:text-white flex items-center min-w-10 min-h-10 justify-center -ml-2 rounded-xl hover:bg-white/5 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-base font-bold text-white">
                {showReturnForm ? `Return Items: #${selectedSale?.receiptNumber}` : 'Process a Sale Return'}
              </h1>
              <p className="text-[11px] text-slate-400">
                {showReturnForm
                  ? 'Select items and disposition for refund and inventory adjustment'
                  : 'Search by receipt number, barcode, or select a recent transaction'}
              </p>
            </div>
          </div>
          {!showReturnForm && (
            <button
              onClick={() => setShowScanner(true)}
              className="px-3 py-2 bg-white/[0.05] hover:bg-white/10 border border-white/10 rounded-xl text-slate-200 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
            >
              <ScanLine className="w-4 h-4 text-emerald-400" />
              <span>Scan Barcode</span>
            </button>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-4">
          {showReturnForm && selectedSale ? (
            /* Return Form View */
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Sale Info Summary Card */}
              <div className="bg-slate-900/80 rounded-2xl p-4 sm:p-5 border border-white/[0.08] flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-emerald-400" />
                    <p className="text-white font-bold text-sm sm:text-base">Receipt #{selectedSale.receiptNumber}</p>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Customer: <span className="text-slate-200 font-medium">{selectedSale.customerName || 'Walk-in'}</span> · {formatDate(selectedSale.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-slate-400">Original Total</p>
                  <p className="text-base sm:text-lg font-bold text-white font-mono">{format(selectedSale.total)}</p>
                </div>
              </div>

              {/* Items to Return List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Select Items to Refund
                  </h2>
                  <span className="text-xs text-slate-400">
                    {selectedItems.length} of {returnItems.length} selected
                  </span>
                </div>

                {returnItems.map((item) => (
                  <div
                    key={item.lineKey}
                    onClick={() => handleToggleItem(item.lineKey)}
                    className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                      item.selected
                        ? 'bg-emerald-500/[0.07] border-emerald-500/40 shadow-xs'
                        : 'bg-slate-900/60 border-white/[0.06] hover:border-white/15'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div
                          className={`w-5 h-5 rounded-md border flex items-center justify-center mt-0.5 transition-colors shrink-0 ${
                            item.selected
                              ? 'bg-emerald-500 border-emerald-500 text-slate-950'
                              : 'border-slate-600 bg-slate-900'
                          }`}
                        >
                          {item.selected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white font-semibold text-sm leading-snug break-words">
                            {item.productName}
                          </p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Max returnable: <span className="font-mono text-slate-200">{item.maxQuantity}</span>
                          </p>
                        </div>
                      </div>
                      <p className="text-emerald-400 font-bold font-mono text-sm shrink-0">
                        {format(item.unitPrice * item.quantity * netRatio)}
                      </p>
                    </div>

                    {/* Quantity Stepper & Condition Selector */}
                    {item.selected && (
                      <div
                        className="pt-3 border-t border-white/[0.06] flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Condition Disposition */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleCondition(item.lineKey, 'restock')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors ${
                              item.condition === 'restock'
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-white/[0.04] text-slate-400 border border-white/[0.06]'
                            }`}
                          >
                            <Package className="w-3 h-3" />
                            Restock to Shelf
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleCondition(item.lineKey, 'quarantine')}
                            className={`px-2.5 py-1 rounded-lg text-xs font-semibold inline-flex items-center gap-1 transition-colors ${
                              item.condition === 'quarantine'
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-white/[0.04] text-slate-400 border border-white/[0.06]'
                            }`}
                          >
                            <ShieldAlert className="w-3 h-3" />
                            Quarantine / Damaged
                          </button>
                        </div>

                        {/* Qty Controls */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">Qty:</span>
                          <div className="flex items-center bg-slate-950 rounded-xl border border-white/10 p-0.5">
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.lineKey, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                              className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 rounded-lg hover:bg-white/10 transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-xs font-bold text-white font-mono">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQuantity(item.lineKey, item.quantity + 1)}
                              disabled={item.quantity >= item.maxQuantity}
                              className="w-7 h-7 flex items-center justify-center text-slate-300 hover:text-white disabled:opacity-30 rounded-lg hover:bg-white/10 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Return Reason Field */}
              <div className="bg-slate-900/60 rounded-2xl p-4 border border-white/[0.08] space-y-2">
                <label className="block text-xs font-semibold text-slate-300">Return Reason</label>
                <input
                  type="text"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  placeholder="e.g. Customer changed mind, incorrect dosage, damaged seal..."
                  className="w-full px-4 py-2.5 bg-slate-950 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500"
                />
                <div className="flex gap-2 flex-wrap pt-1">
                  {['Customer changed mind', 'Wrong item', 'Defective packaging', 'Doctor changed Rx'].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setReturnReason(chip)}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/10 border border-white/[0.08] text-[11px] text-slate-300 transition-colors"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Refund Summary & Action Bar */}
              <div className="bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-white/[0.08] space-y-3">
                <div className="flex justify-between items-center text-base sm:text-lg">
                  <span className="text-slate-300 font-semibold">Total Refund Amount:</span>
                  <span className="text-emerald-400 font-extrabold font-mono text-xl">{format(returnTotal)}</span>
                </div>
                <Button
                  onClick={handleProcessReturn}
                  disabled={selectedItems.length === 0 || returnMutation.isPending}
                  isLoading={returnMutation.isPending}
                  className="w-full py-3"
                  size="lg"
                >
                  {`Process Refund (${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''})`}
                </Button>
              </div>
            </div>
          ) : (
            /* Search & Recent Sales View */
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by receipt number, barcode, or product name..."
                  className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white placeholder-slate-500 text-sm focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                  autoFocus
                />
              </div>

              {/* Recent Sales List */}
              <div className="space-y-2">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
                  Recent Branch Transactions
                </h2>

                {isLoading ? (
                  <div className="text-center py-12 text-slate-400 text-sm">Searching transactions...</div>
                ) : recentSales && recentSales.length > 0 ? (
                  recentSales.map((sale) => (
                    <button
                      key={sale._id}
                      onClick={() => handleSelectSale(sale)}
                      className="w-full flex items-center justify-between p-4 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-white/[0.06] hover:border-white/15 transition-all text-left group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                          <Receipt className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-white font-bold text-sm">Receipt #{sale.receiptNumber}</p>
                            {sale.status === 'partially_returned' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                Partial Return
                              </span>
                            )}
                            {sale.status === 'returned' && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                                Returned
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Customer: <span className="text-slate-200">{sale.customerName || 'Walk-in'}</span> · {sale.items.length} item{sale.items.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-3">
                        <p className="text-sm font-bold text-emerald-400 font-mono">{format(sale.total)}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{formatDate(sale.createdAt)}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-white/[0.04]">
                    <p className="text-slate-400 text-sm">
                      {searchQuery ? 'No sales found matching your query' : 'No recent transactions found'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <QRScannerModal
          isOpen={showScanner}
          onClose={() => setShowScanner(false)}
          onScan={(barcode) => {
            setSearchQuery(barcode);
            setShowScanner(false);
          }}
          title="Scan Receipt Barcode"
        />
      </div>
    </POSLayout>
  );
};

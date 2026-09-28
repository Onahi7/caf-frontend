import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../lib/api-client';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAuthStore } from '../../stores/auth-store';
import { useAlertReplacement } from '../../hooks/useAlertReplacement';
import { useToast } from '../../hooks/useToast';
import { useCurrency } from '../../hooks/useCurrency';
import { useDebounce } from '../../hooks/useDebounce';
import { QRScannerModal } from '../../components/pos/QRScannerModal';
import { Button } from '../../components/ui/Button';
import { queryKeys } from '../../lib/query-keys';
import { formatDate } from '../../lib/date-format';

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
  selected: boolean;
}

type SearchMode = 'receipt';

export const ProcessReturnPage = () => {
  const navigate = useNavigate();
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const user = useAuthStore((state) => state.user);
  const { alertInfo, alertWarning } = useAlertReplacement();
  const { showSuccess, showError } = useToast();
  const { format } = useCurrency();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
  const [returnReason, setReturnReason] = useState('');
  const [showReturnForm, setShowReturnForm] = useState(false);

  const { data: recentSales, isLoading } = useQuery({
    queryKey: queryKeys.sales.recent({
      branchId: getBranchId(selectedBranch),
      search: searchQuery,
      limit: 20,
    }),
    queryFn: async () => {
      const branchId = getBranchId(selectedBranch);
      
      if (!branchId) {
        throw new Error('Branch ID is required');
      }
      
      const params: Record<string, string | number> = { branchId, limit: 20 };
      if (searchQuery) {
        params.search = searchQuery;
      }
      const response = await apiClient.get('/sales', { params });
      return (response.data?.data ?? response.data) as Sale[];
    },
    enabled: !!getBranchId(selectedBranch),
    retry: false,
  });

  const returnMutation = useMutation({
    mutationFn: async (data: { saleId: string; items: Array<{ saleItemId?: string; batchId?: string; productId: string; quantity: number }>; reason: string }) => {
      const response = await apiClient.post(`/sales/${data.saleId}/return`, {
        items: data.items,
        reason: data.reason,
      });
      return response.data;
    },
    onSuccess: (data) => {
      showSuccess(`Return processed successfully. Refund: ${format(data.data?.returnedAmount || 0)}`);
      queryClient.invalidateQueries({ queryKey: queryKeys.sales.all(), exact: false });
      setSelectedSale(null);
      setReturnItems([]);
      setReturnReason('');
      setShowReturnForm(false);
    },
    onError: (error: unknown) => {
      showError(error instanceof Error ? error.message : 'Failed to process return');
    },
  });

  const handleSelectSale = (sale: Sale) => {
    if (sale.status === 'returned') {
      alertWarning('This sale has already been fully returned.');
      return;
    }

    setSelectedSale(sale);
    const items: ReturnItem[] = sale.items.map((item) => ({
      lineKey: item.saleItemId || item.batchId || item.productId,
      saleItemId: item.saleItemId,
      batchId: item.batchId,
      productId: item.productId,
      productName: item.productName || item.productId,
      quantity: 1,
      maxQuantity: item.quantity - (item.returnedQuantity || 0),
      unitPrice: item.quantity > 0 ? item.subtotal / item.quantity : 0,
      selected: false,
    })).filter((item) => item.maxQuantity > 0);

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

  const handleProcessReturn = () => {
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
      alertWarning('Please select at least one item to return.');
      return;
    }

    returnMutation.mutate({
      saleId: selectedSale._id,
      items: itemsToReturn,
      reason: returnReason || 'Customer return',
    });
  };

  const handleBarcodeScan = (barcode: string) => {
    setSearchQuery(barcode);
  };

  const selectedItems = returnItems.filter((item) => item.selected);
  const grossSubtotal = selectedSale?.items.reduce((sum, item) => sum + item.subtotal, 0) || 0;
  const netRatio = selectedSale && grossSubtotal > 0 ? selectedSale.total / grossSubtotal : 0;
  const returnTotal = selectedItems.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice * netRatio,
    0,
  );

  if (showReturnForm && selectedSale) {
    return (
      <div className="min-h-screen bg-secondary-dark flex flex-col pt-safe-top">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
          <button onClick={() => { setShowReturnForm(false); setSelectedSale(null); }} className="text-white min-w-11 min-h-11 flex items-center justify-center -ml-2 rounded-lg hover:bg-white/5">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-white">Return Items</h1>
          <div className="w-6" />
        </div>

        <div className="flex-1 p-4 space-y-4 overflow-y-auto">
          {/* Sale Info */}
          <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
            <p className="text-white font-semibold">Receipt #{selectedSale.receiptNumber}</p>
            <p className="text-gray-400 text-sm">{formatDate(selectedSale.createdAt)}</p>
            <p className="text-gray-400 text-sm">Original Total: {format(selectedSale.total)}</p>
          </div>

          {/* Items to Return */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-3">Select Items to Return</h2>
            <div className="space-y-3">
              {returnItems.map((item) => (
                <div
                  key={item.lineKey}
                  onClick={() => handleToggleItem(item.lineKey)}
                  className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                    item.selected
                      ? 'bg-cyan-500/10 border-cyan-500'
                      : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2 gap-3">
                    <div className="flex items-start space-x-3 min-w-0 flex-1">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                        item.selected ? 'bg-cyan-500 border-cyan-500' : 'border-gray-500'
                      }`}>
                        {item.selected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <p className="text-white font-medium leading-snug whitespace-normal break-words">{item.productName}</p>
                    </div>
                    <p className="text-white font-semibold shrink-0">{format(item.unitPrice * item.quantity)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-gray-400 text-sm">Max: {item.maxQuantity} available for return</p>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUpdateQuantity(item.lineKey, item.quantity - 1); }}
                        className="w-10 h-10 min-h-10 rounded-lg bg-gray-700 text-white flex items-center justify-center hover:bg-gray-600"
                      >
                        -
                      </button>
                      <span className="text-white font-semibold w-8 text-center">{item.quantity}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUpdateQuantity(item.lineKey, item.quantity + 1); }}
                        className="w-10 h-10 min-h-10 rounded-lg bg-gray-700 text-white flex items-center justify-center hover:bg-gray-600"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Return Reason */}
          <div>
            <label className="block text-gray-400 text-sm mb-2">Return Reason</label>
            <input
              type="text"
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="e.g. Customer changed mind, Defective product..."
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>

        {/* Return Summary */}
        <div className="p-4 border-t border-gray-800 space-y-3">
          <div className="flex justify-between text-lg">
            <span className="text-gray-400">Refund Amount</span>
            <span className="text-accent-green font-bold">{format(returnTotal)}</span>
          </div>
          <Button
            onClick={handleProcessReturn}
            disabled={selectedItems.length === 0 || returnMutation.isPending}
            isLoading={returnMutation.isPending}
            className="w-full"
            size="lg"
          >
            {`Process Return (${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''})`}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary-dark flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
        <button onClick={() => navigate(-1)} className="text-white min-w-11 min-h-11 flex items-center justify-center -ml-2 rounded-lg hover:bg-white/5">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-white">Process a Return</h1>
        <button onClick={() => setShowScanner(true)} className="text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
          </svg>
        </button>
      </div>

      <div className="flex-1 p-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by receipt number or product name..."
            className="w-full pl-12 pr-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-gray-600"
          />
        </div>

        {/* Recent Sales */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-3">Recent Sales</h2>
          <div className="space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-gray-400">Loading...</div>
            ) : recentSales && recentSales.length > 0 ? (
              recentSales.map((sale) => (
                <div
                  key={sale._id}
                  onClick={() => handleSelectSale(sale)}
                  className={`flex items-center p-4 rounded-xl border transition-colors cursor-pointer ${
                    selectedSale?._id === sale._id
                      ? 'bg-cyan-500/10 border-cyan-500'
                      : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="w-12 h-12 bg-cyan-500/20 rounded-lg flex items-center justify-center mr-4">
                    <svg className="w-6 h-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-semibold">Receipt #{sale.receiptNumber}</p>
                    <p className="text-gray-400 text-sm">
                      {sale.items.length} {sale.items.length === 1 ? 'Item' : 'Items'} - {format(sale.total)}
                    </p>
                    <p className="text-gray-500 text-sm">Customer: {sale.customerName || 'Walk-in'}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-400 text-sm">{formatDate(sale.createdAt)}</span>
                    {sale.status === 'partially_returned' && (
                      <p className="text-yellow-400 text-xs mt-1">Partially Returned</p>
                    )}
                    {sale.status === 'returned' && (
                      <p className="text-orange-400 text-xs mt-1">Fully Returned</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-400">No recent sales found</div>
            )}
          </div>
        </div>
      </div>

      <QRScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScan}
        title="Scan Receipt Barcode"
      />
    </div>
  );
};

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../../lib/api-client';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAuthStore } from '../../stores/auth-store';
import { useCurrency } from '../../hooks/useCurrency';
import { useToast } from '../../hooks/useToast';
import { getPaymentMethodLabel } from '../../config/payment-methods';
import { Error } from '../../components/ui/Error';
import { queryKeys } from '../../lib/query-keys';
import { POSLayout } from '../../components/pos/POSLayout';

interface Branch {
  _id: string;
  name: string;
}

interface Sale {
  _id: string;
  receiptNumber: string;
  customerName?: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
  total: number;
  paymentMethod: string;
  saleType: string;
  paymentStatus: string;
  amountPaid: number;
  balanceDue: number;
  status: 'completed' | 'partially_returned' | 'returned';
  createdAt: string;
}

export const TransactionHistoryPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith('/admin/');
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>(
    isSuperAdmin ? 'all' : getBranchId(selectedBranch) || '',
  );
  const { format } = useCurrency();
  const { showInfo } = useToast();
  const selectedBranchId = getBranchId(selectedBranch);
  const effectiveBranchId = isSuperAdmin
    ? (branchFilter !== 'all' ? branchFilter : undefined)
    : selectedBranchId;

  const { data: branches } = useQuery({
    queryKey: queryKeys.branches.list(),
    queryFn: async () => {
      const response = await apiClient.get('/branches');
      const payload = response.data?.data ?? response.data;
      return (Array.isArray(payload) ? payload : []) as Branch[];
    },
    enabled: isSuperAdmin,
  });

  const { data: sales, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.sales.history({
      branchId: effectiveBranchId,
      cashierId: user?.role === 'cashier' ? user.id : undefined,
      search: searchQuery,
      startDate: dateFrom,
      endDate: dateTo,
      paymentMethod,
      status,
      limit: 50,
    }),
    queryFn: async () => {
      const params: Record<string, string | number> = { limit: 50 };
      if (effectiveBranchId) params.branchId = effectiveBranchId;
      // Add cashier filtering for cashier role
      if (user?.role === 'cashier' && user?.id) {
        params.cashierId = user.id;
      }
      if (searchQuery) params.search = searchQuery;
      if (dateFrom) params.startDate = dateFrom;
      if (dateTo) params.endDate = dateTo;
      if (paymentMethod && paymentMethod !== 'all') params.paymentMethod = paymentMethod;
      if (status && status !== 'all') params.status = status;
      const response = await apiClient.get('/sales', { params });
      return (response.data?.data ?? response.data) as Sale[];
    },
    enabled: isSuperAdmin || !!selectedBranchId,
  });

  const activeFiltersCount = [
    dateFrom,
    dateTo,
    paymentMethod !== 'all',
    status !== 'all',
    isSuperAdmin && branchFilter !== 'all',
  ].filter(Boolean).length;

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setPaymentMethod('all');
    setStatus('all');
    if (isSuperAdmin) setBranchFilter('all');
  };

  const getStatusBadge = (status: Sale['status']) => {
    const styles = {
      completed: 'bg-green-500/20 text-green-400',
      partially_returned: 'bg-yellow-500/20 text-yellow-400',
      returned: 'bg-orange-500/20 text-orange-400',
    };
    const labels = {
      completed: 'Completed',
      partially_returned: 'Partially Returned',
      returned: 'Returned',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return `Today, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    }
    if (isYesterday) {
      return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    }
    return date.toLocaleDateString('en-US', { 
      day: 'numeric', 
      month: 'short', 
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <POSLayout title="Transaction History">
      <div className={`min-h-screen bg-primary-darker flex flex-col ${isAdmin ? '' : 'pt-safe-top'}`}>
        {/* Header */}
        {!isAdmin && (
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
            <button onClick={() => navigate(-1)} className="text-white min-w-11 min-h-11 flex items-center justify-center -ml-2 rounded-lg hover:bg-white/5">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-white">Transaction History</h1>
            <button onClick={() => setShowFilters(true)} className="text-white relative">
              {activeFiltersCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-accent-green text-primary-dark text-xs font-bold rounded-full flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
            </button>
          </div>
        )}

        <div className="flex-1 p-4 space-y-4">
          {isAdmin && (
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h1 className="text-lg font-bold text-slate-100">Transaction History</h1>
                <p className="text-xs text-slate-400">View and audit all completed sales transactions across branches</p>
              </div>
              <button
                onClick={() => setShowFilters(true)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl border border-white/10 flex items-center gap-2 text-xs font-medium transition-colors"
              >
                <span>Filter Transactions</span>
                {activeFiltersCount > 0 && (
                  <span className="w-4 h-4 bg-emerald-400 text-slate-950 text-[10px] font-bold rounded-full flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>
          )}
        {/* Cashier Notice */}
        {user?.role === 'cashier' && (
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-blue-300">Your Transactions Only</p>
                <p className="text-sm text-blue-200/80 mt-1">
                  You're viewing transactions you personally processed. Managers can see all branch transactions.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Search Bar */}
        <div className="relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by receipt number or customer name..."
            className="w-full pl-12 pr-4 py-3 bg-primary-dark border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-green"
          />
        </div>

        {/* Transaction List */}
        <div className="space-y-3">
          {isLoading ? (
            <div className="text-center py-8 text-gray-400">Loading...</div>
          ) : error ? (
            <Error message="Failed to load transactions" onRetry={() => refetch()} />
          ) : sales && sales.length > 0 ? (
            sales.map((sale) => (
              <div
                key={sale._id}
                onClick={() => navigate(`/pos/receipt/${sale._id}`)}
                className="flex items-center p-4 bg-primary-dark rounded-xl border border-gray-700 cursor-pointer hover:border-gray-600 transition-colors"
              >
                <div className="w-12 h-12 bg-accent-green/20 rounded-full flex items-center justify-center mr-4 border-2 border-accent-green">
                  <svg className="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-white font-semibold truncate">REC-{sale.receiptNumber}</p>
                  <p className="text-gray-400 text-sm truncate">{sale.customerName || 'Walk-in Customer'}</p>
                  <p className="text-gray-500 text-xs mt-1">{getPaymentMethodLabel(sale.paymentMethod)} &middot; {formatDateTime(sale.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold">{format(sale.total)}</p>
                  <div className="mt-1">{getStatusBadge(sale.status)}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400">No transactions found</div>
          )}
        </div>
      </div>

      {/* Filter Modal */}
      {showFilters && (
        <div className="fixed inset-0 bg-black/75 flex items-end z-50" onClick={() => setShowFilters(false)}>
          <div className="bg-primary-dark w-full rounded-t-3xl p-6 pb-safe-bottom space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Filter Transactions</h2>
              <button onClick={() => setShowFilters(false)} className="text-gray-400">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Date Range */}
            {isSuperAdmin && (
              <div>
                <label className="block text-gray-400 text-sm mb-2">Branch</label>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full px-4 py-3 bg-primary-darker border border-gray-600 rounded-xl text-white focus:outline-none focus:border-accent-green"
                >
                  <option value="all">All Branches</option>
                  {(branches || []).map((branch) => (
                    <option key={branch._id} value={branch._id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Range */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">Date Range</label>
              <div className="flex space-x-2">
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="flex-1 px-4 py-3 bg-primary-darker border border-gray-600 rounded-xl text-white focus:outline-none focus:border-accent-green"
                />
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="flex-1 px-4 py-3 bg-primary-darker border border-gray-600 rounded-xl text-white focus:outline-none focus:border-accent-green"
                />
              </div>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-4 py-3 bg-primary-darker border border-gray-600 rounded-xl text-white focus:outline-none focus:border-accent-green"
              >
                <option value="all">All Methods</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="orange_money">Orange Money</option>
                <option value="africell_money">Africell Money</option>
                <option value="qmoney">QMoney</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="insurance">Insurance</option>
                <option value="credit">Credit</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-4 py-3 bg-primary-darker border border-gray-600 rounded-xl text-white focus:outline-none focus:border-accent-green"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="partially_returned">Partially Returned</option>
                <option value="returned">Returned</option>
              </select>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                onClick={() => {
                  clearFilters();
                  setShowFilters(false);
                }}
                className="flex-1 py-3 bg-primary-darker border border-gray-600 rounded-xl text-white font-medium"
              >
                Clear Filters
              </button>
              <button
                onClick={() => setShowFilters(false)}
                className="flex-1 py-3 bg-accent-green text-primary-dark font-semibold rounded-xl"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </POSLayout>
  );
};

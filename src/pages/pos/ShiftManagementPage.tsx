import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../lib/api-client';
import { unwrapArray } from '../../lib/unwrap-response';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAuthStore } from '../../stores/auth-store';
import { useCurrency } from '../../hooks/useCurrency';
import { useToast } from '../../hooks/useToast';
import { POSLayout } from '../../components/pos';
import { ExpenseModal } from '../../components/pos/ExpenseModal';
import { getErrorMessage } from '../../lib/error-utils';
import { queryKeys } from '../../lib/query-keys';

interface Shift {
  _id: string;
  branchId: string;
  terminalId: string;
  cashierId: string;
  openingCash: number;
  closingCash?: number;
  expectedCash?: number;
  variance?: number;
  status: 'open' | 'closed';
  openedAt: string;
  closedAt?: string;
  totalSales?: number;
  salesCount?: number;
  notes?: string;
}

interface Expense {
  _id: string;
  amount: number;
  category: string;
  description: string;
  notes?: string;
  receiptNumber?: string;
  createdAt: string;
  recordedBy: string;
}

export const ShiftManagementPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const user = useAuthStore((state) => state.user);
  const { format, symbol } = useCurrency();
  const { showError, showWarning, showSuccess, showInfo } = useToast();
  
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [activeTab, setActiveTab] = useState<'current' | 'history' | 'expenses'>('current');

  const terminalId = 'TERMINAL-01';

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

  // Get shift history
  const { data: shiftHistory } = useQuery({
    queryKey: queryKeys.shifts.history({ branchId: getBranchId(selectedBranch), limit: 20 }),
    queryFn: async () => {
      const branchId = getBranchId(selectedBranch);
      
      if (!branchId) {
        throw new Error('Branch ID is required');
      }
      
      const response = await apiClient.get('/shifts', {
        params: { branchId, limit: '20' },
      });
      return (response.data?.data ?? response.data) as Shift[];
    },
    enabled: !!getBranchId(selectedBranch) && activeTab === 'history',
    retry: false,
  });

  // Get expenses for current shift
  const { data: expenses, refetch: refetchExpenses } = useQuery<Expense[]>({
    queryKey: queryKeys.expenses.shift(currentShift?._id),
    queryFn: async () => {
      if (!currentShift?._id) return [];
      const response = await apiClient.get(`/expenses/shift/${currentShift._id}`);
      return unwrapArray<Expense>(response.data);
    },
    enabled: !!currentShift?._id && (activeTab === 'expenses' || activeTab === 'current'),
  });

  // Fetch shift report for live totals (totalSales, salesCount, expectedCash, expenses)
  // The shift document doesn't store these while open — the report endpoint computes them from actual records
  const { data: shiftReport } = useQuery<{
    totalSales: number;
    salesCount: number;
    expectedCash: number;
    openingCash: number;
    closingCash: number;
    variance: number;
    totalCashSales: number;
    totalCardSales: number;
    totalMobileSales: number;
  }>({
    queryKey: queryKeys.shifts.report(currentShift?._id),
    queryFn: async () => {
      const response = await apiClient.get(`/shifts/${currentShift!._id}/report`);
      return response.data?.data ?? response.data;
    },
    enabled: !!currentShift?._id && currentShift?.status === 'open',
    refetchInterval: 30_000, // refresh every 30s for live totals
  });

  // Open shift mutation
  const openShiftMutation = useMutation({
    mutationFn: async (data: { openingCash: number }) => {
      const response = await apiClient.post('/shifts/open', {
        branchId: getBranchId(selectedBranch),
        terminalId,
        cashierId: user?.id,
        openingCash: data.openingCash,
      });
      return (response.data?.data ?? response.data) as Shift;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all(), exact: false });
      setShowOpenModal(false);
      setOpeningCash('');
      refetchCurrentShift();
      showSuccess('Shift opened successfully');
    },
    onError: (error) => {
      const status = (error as any)?.response?.status;
      if (status === 409) {
        queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all(), exact: false });
        refetchCurrentShift();
        setShowOpenModal(false);
        showInfo('Shift Already Open', 'An active shift already exists for this cashier. Loaded existing shift.');
        return;
      }

      showError(getErrorMessage(error, 'Failed to open shift'));
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
        totalSales: shiftReport?.totalSales || 0,
      });
      return (response.data?.data ?? response.data) as Shift;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all(), exact: false });
      setShowCloseModal(false);
      setClosingCash('');
      setCloseNotes('');
      refetchCurrentShift();
      showSuccess('Shift closed successfully');
    },
    onError: (error) => {
      showError(getErrorMessage(error, 'Failed to close shift'));
    },
  });

  // Create expense mutation
  const createExpenseMutation = useMutation({
    mutationFn: async (data: { amount: number; category: string; description: string; notes?: string; receiptNumber?: string }) => {
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
        notes: data.notes,
        receiptNumber: data.receiptNumber,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all(), exact: false });
      setShowExpenseModal(false);
      refetchExpenses();
      showSuccess('Expense recorded successfully');
    },
    onError: (error) => {
      showError(getErrorMessage(error, 'Failed to record expense'));
    },
  });

  const handleOpenShift = () => {
    const amount = parseFloat(openingCash);
    if (isNaN(amount) || amount < 0) return;
    openShiftMutation.mutate({ openingCash: amount });
  };

  const handleCloseShift = () => {
    if (!currentShift) {
      showWarning('No Active Shift', 'No active shift found');
      return;
    }
    
    if (!closingCash.trim()) {
      showWarning('Missing Information', 'Please enter the closing cash amount');
      return;
    }
    
    const amount = parseFloat(closingCash);
    if (isNaN(amount) || amount < 0) {
      showError('Invalid Amount', 'Please enter a valid closing cash amount');
      return;
    }
    
    closeShiftMutation.mutate({
      shiftId: currentShift._id,
      closingCash: amount,
      notes: closeNotes || undefined,
    });
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { 
    month: 'short', day: 'numeric', year: 'numeric' 
  });

  const formatTime = (dateStr: string) => new Date(dateStr).toLocaleTimeString('en-US', { 
    hour: 'numeric', minute: '2-digit', hour12: true 
  });

  const getVarianceColor = (variance?: number) => {
    if (!variance) return 'text-green-400';
    if (variance > 0) return 'text-yellow-400';
    return 'text-red-400';
  };

  const expenseCategories = [
    { value: 'supplies', label: 'Supplies' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'utilities', label: 'Utilities' },
    { value: 'petty_cash', label: 'Petty Cash' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <POSLayout>
      <div className="min-h-screen bg-primary-darker">
        {/* Header */}
        <div className="bg-primary-dark border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Shift Management</h1>
              <p className="text-sm text-gray-400 mt-1">{selectedBranch?.name} - Terminal {terminalId}</p>
            </div>
            <div className="flex items-center space-x-3">
              {currentShift?.status === 'open' ? (
                <div className="flex items-center space-x-2 px-4 py-2 bg-green-500/10 border border-green-500/30 rounded-xl">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400 font-medium">Shift Active</span>
                </div>
              ) : (
                <button
                  onClick={() => setShowOpenModal(true)}
                  className="px-5 py-2.5 bg-accent-green hover:bg-emerald-500 text-primary-dark font-semibold rounded-xl transition-colors shadow-lg shadow-accent-green/30"
                >
                  Open New Shift
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-700 px-6">
          <div className="flex space-x-1">
            {[
              { id: 'current' as const, label: 'Current Shift' },
              { id: 'history' as const, label: 'Shift History' },
              { id: 'expenses' as const, label: 'Expenses' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 font-medium text-sm transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-accent-green'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-green" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {activeTab === 'current' && (
            <div className="space-y-6">
              {currentShift && currentShift.status === 'open' ? (
                <>
                  {/* Current Shift Stats */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-primary-dark rounded-xl p-5 border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">Opening Cash</span>
                        <svg className="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-2xl font-bold text-white">{format(currentShift.openingCash)}</p>
                    </div>

                    <div className="bg-primary-dark rounded-xl p-5 border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">Total Sales</span>
                        <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <p className="text-2xl font-bold text-white">{format(shiftReport?.totalSales ?? currentShift.totalSales ?? 0)}</p>
                      <p className="text-xs text-gray-500 mt-1">{shiftReport?.salesCount ?? currentShift.salesCount ?? 0} transactions</p>
                    </div>

                    <div className="bg-primary-dark rounded-xl p-5 border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">Expected Cash</span>
                        <svg className="w-5 h-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-2xl font-bold text-white">
                        {format(shiftReport?.expectedCash ?? currentShift.expectedCash ?? currentShift.openingCash)}
                      </p>
                    </div>

                    <div className="bg-primary-dark rounded-xl p-5 border border-gray-700">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">Duration</span>
                        <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <p className="text-2xl font-bold text-white">
                        {Math.floor((new Date().getTime() - new Date(currentShift.openedAt).getTime()) / (1000 * 60 * 60))}h{' '}
                        {Math.floor(((new Date().getTime() - new Date(currentShift.openedAt).getTime()) / (1000 * 60)) % 60)}m
                      </p>
                      <p className="text-xs text-gray-500 mt-1">Started at {formatTime(currentShift.openedAt)}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="bg-primary-dark rounded-xl p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button
                        onClick={() => setShowExpenseModal(true)}
                        className="p-4 bg-primary-darker hover:bg-gray-800 border border-gray-700 hover:border-accent-green/50 rounded-xl transition-all text-left group"
                      >
                        <svg className="w-8 h-8 text-orange-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p className="text-white font-medium group-hover:text-accent-green transition-colors">Log Expense</p>
                        <p className="text-xs text-gray-500 mt-1">Record cash expense</p>
                      </button>

                      <button
                        onClick={() => navigate(`/pos/shift-report/${currentShift._id}`)}
                        className="p-4 bg-primary-darker hover:bg-gray-800 border border-gray-700 hover:border-accent-green/50 rounded-xl transition-all text-left group"
                      >
                        <svg className="w-8 h-8 text-blue-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-white font-medium group-hover:text-accent-green transition-colors">View Report</p>
                        <p className="text-xs text-gray-500 mt-1">Current shift details</p>
                      </button>

                      <button
                        onClick={() => setShowCloseModal(true)}
                        className="p-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 rounded-xl transition-all text-left group"
                      >
                        <svg className="w-8 h-8 text-red-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <p className="text-red-400 font-medium group-hover:text-red-300 transition-colors">Close Shift</p>
                        <p className="text-xs text-gray-500 mt-1">End and reconcile</p>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-primary-dark rounded-xl p-12 border border-gray-700 text-center">
                  <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h3 className="text-xl font-semibold text-white mb-2">No Active Shift</h3>
                  <p className="text-gray-400 mb-6">Open a new shift to start processing sales</p>
                  <button
                    onClick={() => setShowOpenModal(true)}
                    className="px-6 py-3 bg-accent-green hover:bg-emerald-500 text-primary-dark font-semibold rounded-xl transition-colors"
                  >
                    Open New Shift
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-3">
              {shiftHistory && shiftHistory.length > 0 ? (
                shiftHistory.filter((s: Shift) => s.status === 'closed').map((shift: Shift) => (
                  <div
                    key={shift._id}
                    onClick={() => navigate(`/pos/shift-report/${shift._id}`)}
                    className="bg-primary-dark rounded-xl p-5 border border-gray-700 hover:border-accent-green/50 cursor-pointer transition-all group"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-white font-semibold text-lg mb-1">{formatDate(shift.openedAt)}</p>
                        <p className="text-gray-400 text-sm">
                          {formatTime(shift.openedAt)} - {shift.closedAt ? formatTime(shift.closedAt) : 'N/A'}
                        </p>
                        <div className="flex items-center space-x-4 mt-3">
                          <div>
                            <p className="text-xs text-gray-500">Sales</p>
                            <p className="text-white font-medium">{format(shift.totalSales || 0)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500">Transactions</p>
                            <p className="text-white font-medium">{shift.salesCount || 0}</p>
                          </div>
                          {shift.variance !== undefined && (
                            <div>
                              <p className="text-xs text-gray-500">Variance</p>
                              <p className={`font-medium ${getVarianceColor(shift.variance)}`}>
                                {shift.variance > 0 ? '+' : ''}{format(shift.variance)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                      <svg className="w-5 h-5 text-gray-500 group-hover:text-accent-green transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-primary-dark rounded-xl p-12 border border-gray-700 text-center">
                  <p className="text-gray-400">No shift history available</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">
                  {currentShift?.status === 'open' ? "Today's Expenses" : 'Expenses'}
                </h3>
                {currentShift?.status === 'open' && (
                  <button
                    onClick={() => setShowExpenseModal(true)}
                    className="px-4 py-2 bg-accent-green hover:bg-emerald-500 text-primary-dark font-medium rounded-lg transition-colors"
                  >
                    + Add Expense
                  </button>
                )}
              </div>
              
              {expenses && expenses.length > 0 ? (
                expenses.map((expense: Expense) => (
                  <div key={expense._id} className="bg-primary-dark rounded-xl p-4 border border-gray-700">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-white font-medium truncate">{expense.description}</p>
                        <p className="text-gray-400 text-sm mt-1 capitalize">{expense.category.replace('_', ' ')}</p>
                        {expense.notes && (
                          <p className="text-gray-500 text-xs mt-2">{expense.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-red-400 font-bold">{format(expense.amount)}</p>
                        <p className="text-gray-500 text-xs mt-1">{formatTime(expense.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-primary-dark rounded-xl p-12 border border-gray-700 text-center">
                  <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p className="text-gray-400">No expenses recorded today</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Open Shift Modal */}
        {showOpenModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/75" onClick={() => setShowOpenModal(false)} />
            <div className="relative bg-primary-dark rounded-2xl p-6 w-full max-w-md border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-2">Open New Shift</h2>
              <p className="text-gray-400 mb-6">Enter the opening cash amount in the register</p>
              
              <div className="mb-6">
                <label className="block text-white font-medium mb-2">Opening Cash Amount</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-green font-bold text-lg">{symbol}</span>
                  <input
                    type="number"
                    value={openingCash}
                    onChange={(e) => setOpeningCash(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full pl-10 pr-4 py-4 bg-primary-darker border border-gray-600 rounded-xl text-white text-lg focus:outline-none focus:border-accent-green"
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowOpenModal(false)}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOpenShift}
                  disabled={openShiftMutation.isPending}
                  className="flex-1 py-3 bg-accent-green hover:bg-emerald-500 text-primary-dark font-semibold rounded-xl transition-colors disabled:opacity-50"
                >
                  {openShiftMutation.isPending ? 'Opening...' : 'Open Shift'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Close Shift Modal */}
        {showCloseModal && currentShift && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/75" onClick={() => setShowCloseModal(false)} />
            <div className="relative bg-primary-dark rounded-2xl p-6 w-full max-w-md border border-gray-700">
              <h2 className="text-2xl font-bold text-white mb-2">Close Shift</h2>
              <p className="text-gray-400 mb-6">Count the cash in the register and enter the amount</p>
              
              <div className="bg-primary-darker rounded-xl p-4 mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Opening Cash</span>
                  <span className="text-white font-medium">{format(currentShift.openingCash)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Total Sales</span>
                  <span className="text-white font-medium">{format(shiftReport?.totalSales ?? 0)}</span>
                </div>
                {(shiftReport?.salesCount ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Transactions</span>
                    <span className="text-white font-medium">{shiftReport?.salesCount}</span>
                  </div>
                )}
                <div className="flex justify-between text-base pt-2 border-t border-gray-700">
                  <span className="text-white font-medium">Expected Cash</span>
                  <span className="text-accent-green font-bold">{format(shiftReport?.expectedCash ?? currentShift.expectedCash ?? currentShift.openingCash)}</span>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-white font-medium mb-2">Actual Closing Cash</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-green font-bold text-lg">{symbol}</span>
                  <input
                    type="number"
                    value={closingCash}
                    onChange={(e) => setClosingCash(e.target.value)}
                    placeholder="0.00"
                    step="0.01"
                    className="w-full pl-10 pr-4 py-4 bg-primary-darker border border-gray-600 rounded-xl text-white text-lg focus:outline-none focus:border-accent-green"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-white font-medium mb-2">Notes (Optional)</label>
                <textarea
                  value={closeNotes}
                  onChange={(e) => setCloseNotes(e.target.value)}
                  placeholder="Any discrepancies or notes..."
                  className="w-full px-4 py-3 bg-primary-darker border border-gray-600 rounded-xl text-white resize-none focus:outline-none focus:border-accent-green"
                  rows={3}
                />
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowCloseModal(false)}
                  className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCloseShift}
                  disabled={closeShiftMutation.isPending || !closingCash.trim()}
                  className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {closeShiftMutation.isPending ? 'Closing...' : 'Close Shift'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Expense Modal */}
        {currentShift && (
          <ExpenseModal
            isOpen={showExpenseModal}
            onClose={() => setShowExpenseModal(false)}
            onSubmit={(data) => createExpenseMutation.mutate(data)}
            isLoading={createExpenseMutation.isPending}
          />
        )}
      </div>
    </POSLayout>
  );
};

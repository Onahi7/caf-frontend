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
import { OpenShiftModal, CloseShiftModal } from '../../components/pos/ShiftModals';
import { Button } from '../../components/ui/Button';
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
    <POSLayout title="Shift Management">
      <div className="min-h-screen bg-slate-950">
        {/* Header */}
        <div className="bg-slate-900/80 border-b border-white/[0.08] px-4 sm:px-6 py-3.5 sm:py-4 backdrop-blur-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Shift Management</h1>
              <p className="text-xs text-slate-400 mt-1">{selectedBranch?.name} · Terminal {terminalId}</p>
            </div>
            <div className="flex items-center space-x-3 shrink-0">
              {currentShift?.status === 'open' ? (
                <div className="flex items-center space-x-2 px-3.5 py-1.5 bg-emerald-500/15 border border-emerald-500/25 rounded-xl shadow-xs">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-emerald-400 font-semibold text-xs">Shift Active</span>
                </div>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => setShowOpenModal(true)}
                  className="shadow-lg shadow-emerald-500/20 w-full sm:w-auto"
                >
                  Open New Shift
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-white/[0.08] px-4 sm:px-6 bg-slate-900/40 overflow-x-auto no-scrollbar">
          <div className="flex space-x-2">
            {[
              { id: 'current' as const, label: 'Current Shift' },
              { id: 'history' as const, label: 'Shift History' },
              { id: 'expenses' as const, label: 'Expenses' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 font-semibold text-xs transition-colors relative cursor-pointer ${
                  activeTab === tab.id
                    ? 'text-emerald-400 font-bold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-500 rounded-full" />
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
                    <div className="bg-slate-900/80 rounded-2xl p-5 border border-white/[0.08] shadow-lg backdrop-blur-md">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-xs font-medium">Opening Cash</span>
                        <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-white tracking-tight tabular-nums font-mono">{format(currentShift.openingCash)}</p>
                    </div>

                    <div className="bg-slate-900/80 rounded-2xl p-5 border border-white/[0.08] shadow-lg backdrop-blur-md">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-xs font-medium">Total Sales</span>
                        <div className="w-8 h-8 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-white tracking-tight tabular-nums font-mono">{format(shiftReport?.totalSales ?? currentShift.totalSales ?? 0)}</p>
                      <p className="text-xs text-slate-500 mt-1">{shiftReport?.salesCount ?? currentShift.salesCount ?? 0} transactions</p>
                    </div>

                    <div className="bg-slate-900/80 rounded-2xl p-5 border border-white/[0.08] shadow-lg backdrop-blur-md">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-xs font-medium">Expected Cash</span>
                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-white tracking-tight tabular-nums font-mono">
                        {format(shiftReport?.expectedCash ?? currentShift.expectedCash ?? currentShift.openingCash)}
                      </p>
                    </div>

                    <div className="bg-slate-900/80 rounded-2xl p-5 border border-white/[0.08] shadow-lg backdrop-blur-md">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-slate-400 text-xs font-medium">Duration</span>
                        <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-white tracking-tight tabular-nums">
                        {Math.floor((new Date().getTime() - new Date(currentShift.openedAt).getTime()) / (1000 * 60 * 60))}h{' '}
                        {Math.floor(((new Date().getTime() - new Date(currentShift.openedAt).getTime()) / (1000 * 60)) % 60)}m
                      </p>
                      <p className="text-xs text-slate-500 mt-1">Started at {formatTime(currentShift.openedAt)}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="bg-slate-900/80 rounded-2xl p-6 border border-white/[0.08] shadow-lg backdrop-blur-md">
                    <h3 className="text-base font-bold text-white tracking-tight mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button
                        onClick={() => setShowExpenseModal(true)}
                        className="p-4 bg-slate-950/60 hover:bg-slate-900 border border-white/[0.06] hover:border-emerald-500/40 rounded-2xl transition-all text-left group cursor-pointer shadow-md"
                      >
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-3">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <p className="text-white font-semibold text-sm group-hover:text-emerald-400 transition-colors">Log Expense</p>
                        <p className="text-xs text-slate-400 mt-1">Record petty cash or supply expense</p>
                      </button>

                      <button
                        onClick={() => navigate(`/pos/shift-report/${currentShift._id}`)}
                        className="p-4 bg-slate-950/60 hover:bg-slate-900 border border-white/[0.06] hover:border-emerald-500/40 rounded-2xl transition-all text-left group cursor-pointer shadow-md"
                      >
                        <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-3">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <p className="text-white font-semibold text-sm group-hover:text-emerald-400 transition-colors">View Report</p>
                        <p className="text-xs text-slate-400 mt-1">Current shift breakdown & reconciliation</p>
                      </button>

                      <button
                        onClick={() => setShowCloseModal(true)}
                        className="p-4 bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/25 hover:border-rose-500/40 rounded-2xl transition-all text-left group cursor-pointer shadow-md"
                      >
                        <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center text-rose-400 mb-3">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                          </svg>
                        </div>
                        <p className="text-rose-400 font-semibold text-sm group-hover:text-rose-300 transition-colors">Close Shift</p>
                        <p className="text-xs text-rose-300/70 mt-1">Reconcile drawer and close terminal</p>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-slate-900/80 rounded-2xl p-12 border border-white/[0.08] text-center shadow-xl">
                  <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center mx-auto mb-4 text-slate-500">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-white mb-1.5">No Active Shift</h3>
                  <p className="text-xs text-slate-400 mb-6 max-w-sm mx-auto">Open a register shift with your starting cash float to start processing sales</p>
                  <Button
                    variant="primary"
                    onClick={() => setShowOpenModal(true)}
                    className="shadow-lg shadow-emerald-500/25"
                  >
                    Open New Shift
                  </Button>
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
                <div className="bg-slate-900/80 rounded-2xl p-12 border border-white/[0.08] text-center shadow-lg">
                  <p className="text-xs text-slate-400">No shift history available</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {currentShift?.status === 'open' ? "Today's Expenses" : 'Expenses'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">Recorded cash expenses during register shifts</p>
                </div>
                {currentShift?.status === 'open' && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => setShowExpenseModal(true)}
                    className="shadow-md shadow-emerald-500/20"
                  >
                    + Add Expense
                  </Button>
                )}
              </div>
              
              {expenses && expenses.length > 0 ? (
                expenses.map((expense: Expense) => (
                  <div key={expense._id} className="bg-slate-900/80 rounded-2xl p-4 border border-white/[0.08] shadow-md backdrop-blur-md">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="text-white font-semibold text-sm truncate">{expense.description}</p>
                        <p className="text-slate-400 text-xs mt-1 capitalize">{expense.category.replace('_', ' ')}</p>
                        {expense.notes && (
                          <p className="text-slate-500 text-xs mt-2 italic">{expense.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-rose-400 font-bold tabular-nums font-mono text-sm">{format(expense.amount)}</p>
                        <p className="text-slate-500 text-xs mt-1">{formatTime(expense.createdAt)}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="bg-slate-900/80 rounded-2xl p-12 border border-white/[0.08] text-center shadow-lg">
                  <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mx-auto mb-3 text-slate-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <p className="text-xs text-slate-400">No expenses recorded today</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Open Shift Modal */}
        <OpenShiftModal
          isOpen={showOpenModal}
          onClose={() => setShowOpenModal(false)}
          onSubmit={(cash) => openShiftMutation.mutate({ openingCash: cash })}
          isLoading={openShiftMutation.isPending}
        />

        {/* Close Shift Modal */}
        {currentShift && (
          <CloseShiftModal
            isOpen={showCloseModal}
            onClose={() => setShowCloseModal(false)}
            onSubmit={(closingAmount, notes) =>
              closeShiftMutation.mutate({
                shiftId: currentShift._id,
                closingCash: closingAmount,
                notes: notes || undefined,
              })
            }
            isLoading={closeShiftMutation.isPending}
            openingCash={currentShift.openingCash}
            totalSales={shiftReport?.totalSales ?? currentShift.totalSales ?? 0}
            totalExpenses={(expenses || []).reduce((sum, exp) => sum + (exp.amount || 0), 0)}
            expectedCash={shiftReport?.expectedCash ?? currentShift.expectedCash ?? currentShift.openingCash}
            salesCount={shiftReport?.salesCount ?? currentShift.salesCount ?? 0}
          />
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

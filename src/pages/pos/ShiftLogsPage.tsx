import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import apiClient from '../../lib/api-client';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAuthStore } from '../../stores/auth-store';
import { useCurrency } from '../../hooks/useCurrency';
import { useAlertReplacement } from '../../hooks/useAlertReplacement';
import { useToast } from '../../hooks/useToast';
import { POSLayout } from '../../components/pos';
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
  totalCashSales?: number;
  totalCardSales?: number;
  salesCount?: number;
}

export const ShiftLogsPage = () => {
  const navigate = useNavigate();
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const user = useAuthStore((state) => state.user);
  const { format, symbol } = useCurrency();
  const { alertInfo, alertError } = useAlertReplacement();
  const { showSuccess, showError } = useToast();
  const [closingCash, setClosingCash] = useState('');
  const queryClient = useQueryClient();

  const terminalId = 'TERMINAL-01';

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
      
      const response = await apiClient.get('/shifts/current', {
        params: { branchId, cashierId, terminalId },
      });
      return (response.data?.data ?? response.data) as Shift;
    },
    enabled: !!getBranchId(selectedBranch) && !!user?.id,
    retry: false,
  });

  const { data: shiftHistory, isLoading: loadingHistory } = useQuery({
    queryKey: queryKeys.shifts.history({ 
      branchId: getBranchId(selectedBranch), 
      cashierId: user?.role === 'cashier' ? user.id : undefined,
      limit: 10 
    }),
    queryFn: async () => {
      const branchId = getBranchId(selectedBranch);
      
      if (!branchId) {
        throw new Error('Branch ID is required');
      }
      
      const params: Record<string, string> = { branchId, limit: '10' };
      // Add cashier filtering for cashier role
      if (user?.role === 'cashier' && user?.id) {
        params.cashierId = user.id;
      }
      
      const response = await apiClient.get('/shifts', { params });
      return (response.data?.data ?? response.data) as Shift[];
    },
    enabled: !!getBranchId(selectedBranch),
    retry: false,
  });

  // Fetch shift report for live totals
  const { data: shiftReport } = useQuery<{
    totalSales: number;
    salesCount: number;
    expectedCash: number;
  }>({
    queryKey: queryKeys.shifts.report(currentShift?._id),
    queryFn: async () => {
      const response = await apiClient.get(`/shifts/${currentShift!._id}/report`);
      return response.data?.data ?? response.data;
    },
    enabled: !!currentShift?._id && currentShift?.status === 'open',
  });
  // Close shift mutation
  const closeShiftMutation = useMutation({
    mutationFn: async (data: { closingCash: number }) => {
      if (!currentShift?._id) throw new Error('No active shift');
      const response = await apiClient.post(
        `/shifts/${currentShift._id}/close`,
        data
      );
      return (response.data?.data ?? response.data) as Shift;
    },
    onSuccess: () => {
      showSuccess('Shift closed successfully');
      setClosingCash('');
      queryClient.invalidateQueries({ queryKey: queryKeys.shifts.all(), exact: false });
    },
    onError: (error: unknown) => {
      showError(error instanceof Error ? error.message : 'Failed to close shift');
    },
  });

  const handleCloseShift = () => {
    const closingAmount = parseFloat(closingCash);
    
    if (!closingAmount || closingAmount < 0) {
      alertError('Please enter a valid closing cash amount');
      return;
    }

    if (!currentShift) {
      alertError('No active shift to close');
      return;
    }

    closeShiftMutation.mutate({ closingCash: closingAmount });
  };

  const getVarianceStatus = (shift: Shift) => {
    if (!shift.variance) return { label: 'Balanced', color: 'text-green-400' };
    if (shift.variance > 0) return { label: `Over: ${format(shift.variance)}`, color: 'text-yellow-400' };
    return { label: `Short: ${format(Math.abs(shift.variance))}`, color: 'text-red-400' };
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  return (
    <POSLayout>
    <div className="min-h-screen bg-primary-darker">
      {/* Header */}
      <div className="flex items-center px-4 py-4 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white">Shift Management</h1>
        <span className="text-gray-400 ml-2">- {selectedBranch?.name}</span>
      </div>

      <div className="p-4 space-y-6">
        {/* Current Shift Card */}
        {currentShift && currentShift.status === 'open' && (
          <div className="bg-primary-dark rounded-2xl p-5 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Current Shift</h2>
              <span className="flex items-center px-3 py-1 bg-green-500/20 rounded-full">
                <span className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
                <span className="text-green-400 text-sm font-medium">Shift In Progress</span>
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-400">Start Time</span>
                <span className="text-white font-medium">{formatTime(currentShift.openedAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Total Sales</span>
                <span className="text-white font-medium">{format(shiftReport?.totalSales ?? currentShift.totalSales ?? 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Expected Cash</span>
                <span className="text-white font-medium">{format(shiftReport?.expectedCash ?? currentShift.expectedCash ?? currentShift.openingCash)}</span>
              </div>
            </div>

            <div className="mt-5">
              <label className="block text-white font-medium mb-2">Declare Cash at Close</label>
              <input
                type="text"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                placeholder={`${symbol} 0.00`}
                className="w-full px-4 py-3 bg-primary-darker border border-gray-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-accent-green"
              />
            </div>

            <button 
              onClick={handleCloseShift}
              disabled={closeShiftMutation.isPending}
              className="w-full mt-4 py-4 bg-accent-green text-primary-dark font-semibold rounded-xl hover:bg-accent-light transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {closeShiftMutation.isPending ? 'Closing Shift...' : 'Close Shift'}
            </button>
          </div>
        )}

        {/* Shift History */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Shift History</h2>
          <div className="space-y-3">
            {loadingHistory ? (
              <div className="text-center py-8 text-gray-400">Loading...</div>
            ) : shiftHistory && shiftHistory.length > 0 ? (
              shiftHistory.filter((s: Shift) => s.status === 'closed').map((shift: Shift) => {
                const status = getVarianceStatus(shift);
                return (
                  <div
                    key={shift._id}
                    className="bg-primary-dark rounded-xl p-4 border border-gray-700 cursor-pointer hover:border-gray-600 transition-colors"
                    onClick={() => navigate(`/pos/shift-report/${shift._id}`)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-white font-semibold">{formatDate(shift.openedAt)}</p>
                        <p className="text-gray-400 text-sm mt-1">
                          Total Sales: <span className="text-white">{format(shift.totalSales || 0)}</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-gray-400 text-sm">
                          {formatTime(shift.openedAt)} - {shift.closedAt ? formatTime(shift.closedAt) : 'N/A'}
                        </p>
                        <p className={`text-sm font-medium mt-1 ${status.color}`}>{status.label}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-400">No shift history</div>
            )}
          </div>
        </div>
      </div>
    </div>
    </POSLayout>
  );
};

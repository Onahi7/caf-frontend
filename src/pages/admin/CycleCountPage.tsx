import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, ClipboardCheck, Plus } from 'lucide-react';
import apiClient from '../../lib/api-client';
import { unwrapResponse } from '../../lib/unwrap-response';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { BranchSelector } from '../../components/BranchSelector';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';

const CycleCountStatus = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  APPROVED: 'approved',
  CANCELLED: 'cancelled',
} as const;
type CycleCountStatus = typeof CycleCountStatus[keyof typeof CycleCountStatus];

interface CycleCountLine {
  productId: { _id: string; name: string; sku: string } | string;
  batchId: string;
  lotNumber: string;
  systemQuantity: number;
  countedQuantity: number | null;
  variance: number | null;
}

interface CycleCount {
  _id: string;
  branchId: string;
  status: CycleCountStatus;
  lines: CycleCountLine[];
  notes?: string;
  createdBy: { _id: string; firstName: string; lastName: string };
  approvedBy?: { _id: string; firstName: string; lastName: string };
  createdAt: string;
  updatedAt: string;
}

const STATUS_BADGE: Record<CycleCountStatus, string> = {
  [CycleCountStatus.DRAFT]: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/20',
  [CycleCountStatus.SUBMITTED]: 'bg-blue-500/15 text-blue-300 border border-blue-500/20',
  [CycleCountStatus.APPROVED]: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20',
  [CycleCountStatus.CANCELLED]: 'bg-slate-700/50 text-slate-300 border border-slate-700',
};

function StatusBadge({ status }: { status: CycleCountStatus }) {
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${STATUS_BADGE[status] || STATUS_BADGE[CycleCountStatus.CANCELLED]}`}>
      {status}
    </span>
  );
}

export function CycleCountPage() {
  const [selectedCount, setSelectedCount] = useState<CycleCount | null>(null);
  const [countedValues, setCountedValues] = useState<Record<string, number>>({});
  const { selectedBranch } = useBranchStore();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const requestConfirmation = useConfirm();

  const branchId = getBranchId(selectedBranch);

  const { data: cycleCounts, isLoading, error } = useQuery({
    queryKey: queryKeys.cycleCounts.list({ branchId }),
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl('/cycle-counts', { branchId }));
      const payload = response.data?.data ?? response.data;
      return (Array.isArray(payload) ? payload : []) as CycleCount[];
    },
    enabled: !!branchId,
  });

  const { data: countDetail, isLoading: detailLoading } = useQuery({
    queryKey: queryKeys.cycleCounts.detail(selectedCount?._id ?? ''),
    queryFn: async () => {
      const response = await apiClient.get(`/cycle-counts/${selectedCount!._id}`);
      return (response.data?.data ?? response.data) as CycleCount;
    },
    enabled: !!selectedCount,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await apiClient.post('/cycle-counts', { branchId });
      return unwrapResponse(response.data, {} as CycleCount);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cycleCounts.lists() });
      showSuccess('Cycle count draft created');
      setSelectedCount(data);
      setCountedValues({});
    },
    onError: (err: any) => {
      showError(err?.response?.data?.message ?? 'Failed to create cycle count');
    },
  });

  const submitMutation = useMutation({
    mutationFn: async ({ id, lines }: { id: string; lines: { batchId: string; countedQuantity: number }[] }) => {
      const response = await apiClient.patch(`/cycle-counts/${id}/submit`, { lines });
      return unwrapResponse(response.data, {} as CycleCount);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cycleCounts.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.cycleCounts.detail(data._id) });
      showSuccess('Cycle count submitted for review');
      setSelectedCount(data);
    },
    onError: (err: any) => {
      showError(err?.response?.data?.message ?? 'Failed to submit cycle count');
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.patch(`/cycle-counts/${id}/approve`);
      return unwrapResponse(response.data, {} as CycleCount);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cycleCounts.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.cycleCounts.detail(data._id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all(), exact: false });
      showSuccess('Cycle count approved - product stock levels adjusted');
      setSelectedCount(data);
    },
    onError: (err: any) => {
      showError(err?.response?.data?.message ?? 'Failed to approve cycle count');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiClient.patch(`/cycle-counts/${id}/cancel`);
      return unwrapResponse(response.data, {} as CycleCount);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cycleCounts.lists() });
      queryClient.invalidateQueries({ queryKey: queryKeys.cycleCounts.detail(data._id) });
      showSuccess('Cycle count cancelled');
      setSelectedCount(data);
    },
    onError: (err: any) => {
      showError(err?.response?.data?.message ?? 'Failed to cancel cycle count');
    },
  });

  function handleSubmitCount() {
    if (!selectedCount) return;
    const lines = (countDetail?.lines ?? []).map((line) => {
      const val = countedValues[line.batchId];
      return {
        batchId: line.batchId,
        countedQuantity: typeof val === 'number' && !isNaN(val) ? val : Number(line.systemQuantity || 0),
      };
    });
    submitMutation.mutate({ id: selectedCount._id, lines });
  }

  async function handleApprove() {
    if (!selectedCount) return;
    const confirmed = await requestConfirmation({
      title: 'Approve Cycle Count?',
      message: 'Approving this count will adjust product stock levels in this branch to match the physical count. This cannot be undone.',
      confirmLabel: 'Approve & Adjust Stock',
      variant: 'warning',
    });
    if (!confirmed) return;
    approveMutation.mutate(selectedCount._id);
  }

  async function handleCancel() {
    if (!selectedCount) return;
    const confirmed = await requestConfirmation({
      title: 'Cancel Cycle Count?',
      message: 'Are you sure you want to cancel this cycle count? All entered counts will be discarded.',
      confirmLabel: 'Cancel Count',
      variant: 'danger',
    });
    if (!confirmed) return;
    cancelMutation.mutate(selectedCount._id);
  }

  const activeDetail = countDetail ?? selectedCount;

  // --- Detail view ----------------------------------------------------------
  if (selectedCount) {
    return (
      <AdminLayout>
        <div className="max-w-5xl mx-auto py-6 px-4">
          <div className="flex items-center gap-3 mb-6">
            <button
              className="inline-flex items-center gap-1.5 text-sm text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
              onClick={() => setSelectedCount(null)}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to list</span>
            </button>
            <h1 className="text-xl font-bold text-white flex items-center gap-3">
              <span>Cycle Count</span>
              {activeDetail?.status && <StatusBadge status={activeDetail.status} />}
            </h1>
          </div>

          {detailLoading && <Loading />}

          {activeDetail && (
            <>
              <div className="mb-6 overflow-x-auto rounded-xl border border-slate-800 bg-slate-900/60">
                <table className="w-full text-sm min-w-[600px]">
                  <thead className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3 text-left">Product</th>
                      <th className="px-4 py-3 text-left">SKU</th>
                      <th className="px-4 py-3 text-right">System Qty</th>
                      <th className="px-4 py-3 text-right">Counted Qty</th>
                      {activeDetail.status !== CycleCountStatus.DRAFT && (
                        <th className="px-4 py-3 text-right">Variance</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {activeDetail.lines.map((line) => {
                      const productName =
                        typeof line.productId === 'object'
                          ? line.productId.name
                          : line.productId;
                      const productSku =
                        typeof line.productId === 'object'
                          ? line.productId.sku
                          : '-';
                      const variance = line.variance;

                      return (
                        <tr key={line.batchId} className="hover:bg-slate-800/40">
                          <td className="px-4 py-3 font-medium text-white">{productName}</td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-400">{productSku}</td>
                          <td className="px-4 py-3 text-right text-slate-300">{line.systemQuantity}</td>
                          <td className="px-4 py-3 text-right">
                            {activeDetail.status === CycleCountStatus.DRAFT ? (
                              <input
                                type="number"
                                min={0}
                                defaultValue={line.systemQuantity}
                                className="w-24 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-right text-sm text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                onChange={(e) => {
                                  const parsed = Math.max(0, parseInt(e.target.value, 10) || 0);
                                  setCountedValues((prev) => ({
                                    ...prev,
                                    [line.batchId]: parsed,
                                  }));
                                }}
                              />
                            ) : (
                              <span className="font-semibold">{line.countedQuantity ?? '-'}</span>
                            )}
                          </td>
                          {activeDetail.status !== CycleCountStatus.DRAFT && (
                            <td
                              className={`px-4 py-3 text-right font-semibold ${
                                variance == null
                                  ? ''
                                  : variance > 0
                                  ? 'text-emerald-400'
                                  : variance < 0
                                  ? 'text-red-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {variance == null
                                ? '-'
                                : variance > 0
                                ? `+${variance}`
                                : variance}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex gap-3 justify-end">
                {activeDetail.status === CycleCountStatus.DRAFT && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={handleCancel}
                      disabled={cancelMutation.isPending}
                    >
                      Cancel Count
                    </Button>
                    <Button
                      onClick={handleSubmitCount}
                      isLoading={submitMutation.isPending}
                    >
                      Submit for Review
                    </Button>
                  </>
                )}
                {activeDetail.status === CycleCountStatus.SUBMITTED && (
                  <>
                    <Button
                      variant="secondary"
                      onClick={handleCancel}
                      disabled={cancelMutation.isPending}
                    >
                      Cancel Count
                    </Button>
                    <Button
                      onClick={handleApprove}
                      isLoading={approveMutation.isPending}
                    >
                      Approve & Apply Adjustments
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </AdminLayout>
    );
  }

  // --- List view ------------------------------------------------------------
  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto py-6 px-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Cycle Counts</h1>
            <p className="text-sm text-slate-400 mt-1">Reconcile physical stock against system inventory</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <BranchSelector />
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !branchId}
              className="inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Start New Count</span>
            </Button>
          </div>
        </div>

        {!branchId ? (
          <div className="max-w-md mx-auto text-center py-16 px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <ClipboardCheck className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Select a Branch</h2>
            <p className="text-sm text-slate-400 mb-6">
              Cycle counts are branch-specific. Choose a branch to review or initiate inventory reconciliation.
            </p>
            <div className="flex justify-center">
              <BranchSelector />
            </div>
          </div>
        ) : (
          <>
            {isLoading && <Loading />}
            {error && <Error message="Failed to load cycle counts" />}

            {cycleCounts && cycleCounts.length === 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 text-slate-400 text-sm text-center py-12">
                No cycle counts recorded for this branch yet. Start a new count to reconcile physical stock.
              </div>
            )}

            {cycleCounts && cycleCounts.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
                <Table
                  columns={[
                    {
                      key: 'createdAt',
                      header: 'Date',
                      render: (row: CycleCount) =>
                        new Date(row.createdAt).toLocaleDateString(),
                    },
                    {
                      key: 'status',
                      header: 'Status',
                      render: (row: CycleCount) => <StatusBadge status={row.status} />,
                    },
                    {
                      key: 'lines',
                      header: 'Items Counted',
                      render: (row: CycleCount) => row.lines.length,
                    },
                    {
                      key: 'createdBy',
                      header: 'Created By',
                      render: (row: CycleCount) =>
                        `${row.createdBy?.firstName || ''} ${row.createdBy?.lastName || ''}`.trim() || 'Staff',
                    },
                    {
                      key: 'actions',
                      header: '',
                      render: (row: CycleCount) =>
                        row.status !== CycleCountStatus.CANCELLED &&
                        row.status !== CycleCountStatus.APPROVED ? (
                          <button
                            className="text-emerald-400 hover:text-emerald-300 font-medium text-sm transition-colors"
                            onClick={() => {
                              setSelectedCount(row);
                              setCountedValues({});
                            }}
                          >
                            {row.status === CycleCountStatus.DRAFT ? 'Enter Counts' : 'Review'}
                          </button>
                        ) : (
                          <button
                            className="text-slate-400 hover:text-slate-200 text-sm transition-colors"
                            onClick={() => {
                              setSelectedCount(row);
                              setCountedValues({});
                            }}
                          >
                            View Details
                          </button>
                        ),
                    },
                  ]}
                  data={cycleCounts}
                />
              </div>
            )}
          </>
        )}
      </div>
    </AdminLayout>
  );
}

export default CycleCountPage;

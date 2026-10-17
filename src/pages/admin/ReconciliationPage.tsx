import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { Textarea } from '../../components/ui/Textarea';
import { AdminStatusBadge } from '../../components/admin';
import { useToast } from '../../hooks/useToast';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { queryKeys } from '../../lib/query-keys';
import apiClient from '../../lib/api-client';
import { buildApiUrl } from '../../lib/api-utils';
import { getErrorMessage } from '../../lib/error-utils';
import { formatStatusLabel, toneForStatus } from '../../lib/admin-tones';
import { CheckCircle, XCircle, Eye } from 'lucide-react';
import { useCurrency } from '../../hooks/useCurrency';

interface Reconciliation {
  _id: string;
  source: string;
  period: string;
  totalSales: number;
  totalExpenses: number;
  expectedCash: number;
  actualCash: number;
  discrepancy: number;
  hasDiscrepancy: boolean;
  status: string;
  items: { description: string; amount: number; reference?: string }[];
  createdBy: { firstName: string; lastName: string };
  reviewedBy?: { firstName: string; lastName: string };
  reviewNotes?: string;
  createdAt: string;
}

export function ReconciliationPage() {
  const [selected, setSelected] = useState<Reconciliation | null>(null);
  const [reviewModal, setReviewModal] = useState<Reconciliation | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const { selectedBranch } = useBranchStore();
  const branchId = getBranchId(selectedBranch);
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const { format: formatMoney } = useCurrency();

  const { data: recons, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.financeManager.reconciliations.list({ branchId }),
    queryFn: async () => {
      const res = await apiClient.get(buildApiUrl('/finance-manager/reconciliations', { branchId }));
      return (res.data?.data ?? res.data) as Reconciliation[];
    },
    enabled: !!branchId,
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes: string }) => {
      await apiClient.patch(`/finance-manager/reconciliations/${id}/review`, { status, reviewNotes: notes });
    },
    onSuccess: () => {
      showSuccess('Reconciliation reviewed');
      queryClient.invalidateQueries({ queryKey: queryKeys.financeManager.reconciliations.all() });
      queryClient.invalidateQueries({ queryKey: queryKeys.financeManager.dashboard(branchId) });
      setReviewModal(null);
      setReviewNotes('');
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to review reconciliation')),
  });

  const handleCloseReview = () => {
    setReviewModal(null);
    setReviewNotes('');
  };

  const columns = [
    { key: 'source', header: 'Source', render: (r: Reconciliation) => (
      <AdminStatusBadge tone={toneForStatus(r.source)}>
        {r.source.toUpperCase()}
      </AdminStatusBadge>
    )},
    { key: 'period', header: 'Period' },
    { key: 'totalSales', header: 'Sales', render: (r: Reconciliation) => formatMoney(r.totalSales) },
    { key: 'totalExpenses', header: 'Expenses', render: (r: Reconciliation) => formatMoney(r.totalExpenses) },
    { key: 'expectedCash', header: 'Expected', render: (r: Reconciliation) => formatMoney(r.expectedCash) },
    { key: 'actualCash', header: 'Actual', render: (r: Reconciliation) => formatMoney(r.actualCash) },
    { key: 'discrepancy', header: 'Discrepancy', render: (r: Reconciliation) => (
      <span className={r.hasDiscrepancy ? 'text-rose-400 font-semibold' : 'text-emerald-400'}>{formatMoney(r.discrepancy)}</span>
    )},
    { key: 'status', header: 'Status', render: (r: Reconciliation) => (
      <AdminStatusBadge tone={toneForStatus(r.status)}>
        {formatStatusLabel(r.status)}
      </AdminStatusBadge>
    )},
    { key: 'actions', header: 'Actions', render: (r: Reconciliation) => r.status === 'pending' ? (
      <Button size="sm" onClick={(e: any) => { e?.stopPropagation(); setReviewModal(r); }}>Review</Button>
    ) : null},
  ];

  return (
    <AdminLayout title="Reconciliations">
      <div className="mb-6">
        <p className="text-slate-400">Review and approve reconciliations from CAF, EMR, and Lab systems</p>
      </div>

      {isLoading ? <Loading variant="centered" text="Loading..." /> : error ? <Error message="Failed to load" onRetry={refetch} /> : (
        <Table
          data={recons || []}
          columns={columns}
          emptyMessage="No reconciliations found"
          onRowClick={(r) => setSelected(r)}
        />
      )}

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Reconciliation Detail" size="lg">
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-slate-400 text-sm">Source</span><p className="text-white font-medium">{selected.source.toUpperCase()}</p></div>
              <div><span className="text-slate-400 text-sm">Period</span><p className="text-white font-medium">{selected.period}</p></div>
              <div><span className="text-slate-400 text-sm">Total Sales</span><p className="text-white font-medium">{formatMoney(selected.totalSales)}</p></div>
              <div><span className="text-slate-400 text-sm">Total Expenses</span><p className="text-white font-medium">{formatMoney(selected.totalExpenses)}</p></div>
              <div><span className="text-slate-400 text-sm">Expected Cash</span><p className="text-white font-medium">{formatMoney(selected.expectedCash)}</p></div>
              <div><span className="text-slate-400 text-sm">Actual Cash</span><p className="text-white font-medium">{formatMoney(selected.actualCash)}</p></div>
              <div><span className="text-slate-400 text-sm">Discrepancy</span><p className={`font-semibold ${selected.hasDiscrepancy ? 'text-rose-400' : 'text-emerald-400'}`}>{formatMoney(selected.discrepancy)}</p></div>
              <div>
                <span className="text-slate-400 text-sm">Status</span>
                <p>
                  <AdminStatusBadge tone={toneForStatus(selected.status)}>
                    {formatStatusLabel(selected.status)}
                  </AdminStatusBadge>
                </p>
              </div>
            </div>
            {selected.items.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-2">Line Items</h4>
                <div className="space-y-1">
                  {selected.items.map((item, i) => (
                    <div key={i} className="flex justify-between bg-white/5 rounded-lg p-2">
                      <span className="text-white text-sm">{item.description}</span>
                      <span className="text-white text-sm">{formatMoney(item.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {selected.reviewedBy && (
              <div><span className="text-slate-400 text-sm">Reviewed by</span><p className="text-white">{selected.reviewedBy.firstName} {selected.reviewedBy.lastName}</p></div>
            )}
            {selected.reviewNotes && (
              <div><span className="text-slate-400 text-sm">Review Notes</span><p className="text-white">{selected.reviewNotes}</p></div>
            )}
          </div>
        )}
      </Modal>

      <Modal isOpen={!!reviewModal} onClose={handleCloseReview} title="Review Reconciliation">
        {reviewModal && (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-white font-medium">{reviewModal.source.toUpperCase()} - {reviewModal.period}</p>
              <p className="text-sm text-slate-400">Expected: {formatMoney(reviewModal.expectedCash)} | Actual: {formatMoney(reviewModal.actualCash)}</p>
              <p className={`text-sm font-semibold ${reviewModal.hasDiscrepancy ? 'text-rose-400' : 'text-emerald-400'}`}>
                Discrepancy: {formatMoney(reviewModal.discrepancy)}
              </p>
            </div>
            <Textarea
              label="Review Notes"
              rows={3}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Add notes for the audit trail (optional)"
            />
            <div className="flex gap-3 justify-end">
              <Button
                variant="danger"
                disabled={reviewMutation.isPending}
                isLoading={reviewMutation.isPending && reviewMutation.variables?.status === 'rejected'}
                onClick={() => reviewMutation.mutate({ id: reviewModal._id, status: 'rejected', notes: reviewNotes })}
              >
                <XCircle className="w-4 h-4 mr-2" />Reject
              </Button>
              <Button
                variant="primary"
                disabled={reviewMutation.isPending}
                isLoading={reviewMutation.isPending && reviewMutation.variables?.status === 'approved'}
                onClick={() => reviewMutation.mutate({ id: reviewModal._id, status: 'approved', notes: reviewNotes })}
              >
                <CheckCircle className="w-4 h-4 mr-2" />Approve
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  );
}

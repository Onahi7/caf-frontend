import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FinanceLayout } from '../../components/FinanceLayout';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../lib/query-keys';
import apiClient from '../../lib/api-client';
import { buildApiUrl } from '../../lib/api-utils';
import { getErrorMessage } from '../../lib/error-utils';
import { CheckCircle, XCircle, Eye, Plus } from 'lucide-react';
import { useCurrency } from '../../hooks/useCurrency';

interface PaymentBreakdown {
  cash: number;
  orangeMoney: number;
  afrimoney: number;
}

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
  expectedPaymentBreakdown?: PaymentBreakdown;
  actualPaymentBreakdown?: PaymentBreakdown;
  paymentDiscrepancy?: PaymentBreakdown;
  status: string;
  items: { description: string; amount: number; reference?: string }[];
  branchId: { _id: string; name: string } | string;
  createdBy: { firstName: string; lastName: string };
  reviewedBy?: { firstName: string; lastName: string };
  reviewNotes?: string;
  createdAt: string;
}

function getBranchName(branchId: Reconciliation['branchId']) {
  if (!branchId) return '-';
  if (typeof branchId === 'string') return branchId.slice(0, 8);
  return branchId.name || '-';
}

const statusBadge = (status: string) => {
  const s: Record<string, string> = {
    pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    approved: 'bg-green-500/10 text-green-400 border-green-500/20',
    rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
  };
  return s[status] || 'bg-gray-500/10 text-slate-400 border-gray-500/20';
};

const sourceBadge = (source: string) => {
  const s: Record<string, string> = {
    caf: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    emr: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    lab: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  };
  return s[source] || 'bg-gray-500/10 text-slate-400 border-gray-500/20';
};

function PaymentBreakdownDisplay({ label, data, format }: { label: string; data?: PaymentBreakdown; format: (amount: number) => string }) {
  if (!data) return null;
  return (
    <div>
      <p className="text-sm font-medium text-white/50 mb-1">{label}</p>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <p className="text-xs text-white/40">Cash</p>
          <p className="text-sm text-white font-medium">{format(data.cash || 0)}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <p className="text-xs text-white/40">Orange Money</p>
          <p className="text-sm text-white font-medium">{format(data.orangeMoney || 0)}</p>
        </div>
        <div className="bg-white/5 rounded-lg p-2 text-center">
          <p className="text-xs text-white/40">Afrimoney</p>
          <p className="text-sm text-white font-medium">{format(data.afrimoney || 0)}</p>
        </div>
      </div>
    </div>
  );
}

function PaymentBreakdownInput({ prefix, form, setForm }: { prefix: string; form: Record<string, string>; setForm: (f: any) => void }) {
  const fields = [
    { key: 'cash', label: 'Cash' },
    { key: 'orangeMoney', label: 'Orange Money' },
    { key: 'afrimoney', label: 'Afrimoney' },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {fields.map(({ key, label }) => (
        <div key={key}>
          <label className="block text-xs font-medium text-white/50 mb-1">{label}</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form[`${prefix}${key}`] || ''}
            onChange={(e) => setForm({ ...form, [`${prefix}${key}`]: e.target.value })}
            placeholder="0"
            className="w-full px-3 py-2 rounded-lg bg-white/5 text-white border border-white/10 text-sm focus:border-emerald-500/50 focus:outline-none"
          />
        </div>
      ))}
    </div>
  );
}

function getPaymentValues(form: Record<string, string>, prefix: string): PaymentBreakdown {
  return {
    cash: Number(form[`${prefix}cash`] || 0),
    orangeMoney: Number(form[`${prefix}orangeMoney`] || 0),
    afrimoney: Number(form[`${prefix}afrimoney`] || 0),
  };
}

export function FinanceReconciliationsPage() {
  const [selected, setSelected] = useState<Reconciliation | null>(null);
  const [reviewModal, setReviewModal] = useState<Reconciliation | null>(null);
  const [reviewForm, setReviewForm] = useState<Record<string, string>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<Record<string, string>>({});
  const [filterStatus, setFilterStatus] = useState<string>('');
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const { format } = useCurrency();

  const { data: recons, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.financeManager.reconciliations.list({ status: filterStatus || undefined }),
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filterStatus) params.status = filterStatus;
      const res = await apiClient.get(buildApiUrl('/finance-manager/reconciliations', params));
      return (res.data?.data ?? res.data) as Reconciliation[];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const payload: Record<string, any> = {
        status,
        reviewNotes: reviewForm.notes || undefined,
      };
      const actualCash = reviewForm.reviewActualCash;
      if (actualCash !== undefined && actualCash !== '') {
        payload.actualCash = Number(actualCash);
      }
      const pm = getPaymentValues(reviewForm, 'review');
      if (pm.cash || pm.orangeMoney || pm.afrimoney) {
        payload.actualPaymentBreakdown = pm;
      }
      await apiClient.patch(`/finance-manager/reconciliations/${id}/review`, payload);
    },
    onSuccess: () => {
      showSuccess('Reconciliation reviewed');
      queryClient.invalidateQueries({ queryKey: queryKeys.financeManager.reconciliations.all() });
      setReviewModal(null);
      setReviewForm({});
    },
    onError: (err: any) => showError(err?.response?.data?.message || 'Review failed'),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const pm = getPaymentValues(createForm, 'create');
      await apiClient.post('/finance-manager/reconciliations', {
        source: createForm.source,
        branchId: createForm.branchId,
        period: createForm.period,
        totalSales: Number(createForm.totalSales || 0),
        totalExpenses: Number(createForm.totalExpenses || 0),
        expectedCash: Number(createForm.expectedCash || 0),
        actualCash: Number(createForm.actualCash || 0),
        notes: createForm.notes || undefined,
        expectedPaymentBreakdown: (pm.cash || pm.orangeMoney || pm.afrimoney) ? pm : undefined,
      });
    },
    onSuccess: () => {
      showSuccess('Reconciliation created');
      queryClient.invalidateQueries({ queryKey: queryKeys.financeManager.reconciliations.all() });
      setIsCreateOpen(false);
      setCreateForm({});
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to create reconciliation')),
  });

  return (
    <FinanceLayout title="Reconciliations">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-slate-400">Review and approve reconciliations from all branches</p>
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />New Reconciliation
        </Button>
      </div>

      <div className="mb-4 flex gap-2">
        {['', 'pending', 'approved', 'rejected'].map((s) => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${filterStatus === s ? 'bg-emerald-500 text-white' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'}`}>
            {s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All'}
          </button>
        ))}
      </div>

      {isLoading ? <Loading variant="centered" text="Loading..." /> : error ? <Error message="Failed to load" onRetry={refetch} /> : (
        <div className="rounded-2xl border border-white/10 bg-slate-900/70 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="text-left text-slate-400 px-4 py-3 font-medium">Branch</th>
                  <th className="text-left text-slate-400 px-4 py-3 font-medium">Source</th>
                  <th className="text-left text-slate-400 px-4 py-3 font-medium">Period</th>
                  <th className="text-right text-slate-400 px-4 py-3 font-medium">Sales</th>
                  <th className="text-right text-slate-400 px-4 py-3 font-medium">Expenses</th>
                  <th className="text-right text-slate-400 px-4 py-3 font-medium">Expected</th>
                  <th className="text-right text-slate-400 px-4 py-3 font-medium">Actual</th>
                  <th className="text-right text-slate-400 px-4 py-3 font-medium">Variance</th>
                  <th className="text-left text-slate-400 px-4 py-3 font-medium">Status</th>
                  <th className="text-left text-slate-400 px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(recons || []).length === 0 ? (
                  <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-400">No reconciliations found</td></tr>
                ) : (
                  (recons || []).map((r) => (
                    <tr key={r._id} className="border-b border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setSelected(r)}>
                      <td className="px-4 py-3 text-white">{getBranchName(r.branchId)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${sourceBadge(r.source)}`}>{r.source.toUpperCase()}</span>
                      </td>
                      <td className="px-4 py-3 text-white">{r.period}</td>
                      <td className="px-4 py-3 text-right text-white">{format(r.totalSales)}</td>
                      <td className="px-4 py-3 text-right text-white">{format(r.totalExpenses)}</td>
                      <td className="px-4 py-3 text-right text-white">{format(r.expectedCash)}</td>
                      <td className="px-4 py-3 text-right text-white">{format(r.actualCash)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={r.hasDiscrepancy ? 'text-red-400 font-semibold' : 'text-green-400'}>{format(r.discrepancy)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusBadge(r.status)}`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        {r.status === 'pending' ? (
                          <Button size="sm" onClick={(e: any) => {
                            e?.stopPropagation();
                            setReviewForm({ notes: '' });
                            setReviewModal(r);
                          }}>
                            <Eye className="w-3 h-3 mr-1" />Review
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title="Reconciliation Detail" size="lg">
        {selected ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><span className="text-slate-400 text-sm">Branch</span><p className="text-white font-medium">{getBranchName(selected.branchId)}</p></div>
              <div><span className="text-slate-400 text-sm">Source</span><p className="text-white font-medium">{selected.source.toUpperCase()}</p></div>
              <div><span className="text-slate-400 text-sm">Period</span><p className="text-white font-medium">{selected.period}</p></div>
              <div><span className="text-slate-400 text-sm">Status</span><p><span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusBadge(selected.status)}`}>{selected.status}</span></p></div>
              <div><span className="text-slate-400 text-sm">Total Sales</span><p className="text-white font-medium">{format(selected.totalSales)}</p></div>
              <div><span className="text-slate-400 text-sm">Total Expenses</span><p className="text-white font-medium">{format(selected.totalExpenses)}</p></div>
              <div><span className="text-slate-400 text-sm">Expected Cash</span><p className="text-white font-medium">{format(selected.expectedCash)}</p></div>
              <div><span className="text-slate-400 text-sm">Actual Cash</span><p className="text-white font-medium">{format(selected.actualCash)}</p></div>
              <div className="sm:col-span-2">
                <span className="text-slate-400 text-sm">Discrepancy</span>
                <p className={`text-lg font-semibold ${selected.hasDiscrepancy ? 'text-red-400' : 'text-green-400'}`}>{format(selected.discrepancy)}</p>
              </div>
            </div>

            <PaymentBreakdownDisplay label="Expected Payment Breakdown" data={selected.expectedPaymentBreakdown} format={format} />
            <PaymentBreakdownDisplay label="Actual Payment Breakdown" data={selected.actualPaymentBreakdown} format={format} />

            {selected.paymentDiscrepancy && (selected.paymentDiscrepancy.cash || selected.paymentDiscrepancy.orangeMoney || selected.paymentDiscrepancy.afrimoney) && (
              <div>
                <p className="text-sm font-medium text-white/50 mb-1">Payment Method Discrepancy</p>
                <div className="grid grid-cols-3 gap-2">
                  {(['cash', 'orangeMoney', 'afrimoney'] as const).map((key) => {
                    const val = selected.paymentDiscrepancy![key] || 0;
                    return (
                      <div key={key} className="bg-white/5 rounded-lg p-2 text-center">
                        <p className="text-xs text-white/40">{key === 'orangeMoney' ? 'Orange Money' : key === 'afrimoney' ? 'Afrimoney' : 'Cash'}</p>
                        <p className={`text-sm font-medium ${Math.abs(val) > 0.01 ? 'text-amber-400' : 'text-green-400'}`}>{format(val)}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selected.items.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-slate-400 mb-2">Line Items</h4>
                <div className="space-y-1">
                  {selected.items.map((item, i) => (
                    <div key={i} className="flex justify-between bg-white/5 rounded-lg p-2">
                      <span className="text-white text-sm">{item.description}</span>
                      <span className="text-white text-sm">{format(item.amount)}</span>
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
        ) : null}
      </Modal>

      {/* Review Modal */}
      <Modal isOpen={!!reviewModal} onClose={() => setReviewModal(null)} title="Review Reconciliation" size="lg">
        {reviewModal ? (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-slate-400">Branch:</span> <span className="text-white ml-1">{getBranchName(reviewModal.branchId)}</span></div>
                <div><span className="text-slate-400">Source:</span> <span className="text-white ml-1">{reviewModal.source.toUpperCase()}</span></div>
                <div><span className="text-slate-400">Period:</span> <span className="text-white ml-1">{reviewModal.period}</span></div>
                <div><span className="text-slate-400">Expected:</span> <span className="text-white ml-1">{format(reviewModal.expectedCash)}</span></div>
              </div>
              {reviewModal.expectedPaymentBreakdown && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <p className="text-xs text-white/40 mb-1">Expected breakdown:</p>
                  <div className="flex gap-3 text-xs">
                    <span className="text-white/60">Cash: {format(reviewModal.expectedPaymentBreakdown.cash)}</span>
                    <span className="text-white/60">OM: {format(reviewModal.expectedPaymentBreakdown.orangeMoney)}</span>
                    <span className="text-white/60">Afrimoney: {format(reviewModal.expectedPaymentBreakdown.afrimoney)}</span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-1">Actual Cash Counted (total)</label>
              <input type="number" step="0.01" min="0" value={reviewForm.reviewActualCash || reviewModal.actualCash}
                onChange={(e) => setReviewForm({ ...reviewForm, reviewActualCash: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10 focus:border-emerald-500/50 focus:outline-none" />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Payment Method Breakdown (what you actually received)</label>
              <PaymentBreakdownInput prefix="review" form={reviewForm} setForm={setReviewForm} />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-1">Review Notes</label>
              <textarea value={reviewForm.notes || ''} onChange={(e) => setReviewForm({ ...reviewForm, notes: e.target.value })} rows={3}
                placeholder="Optional notes about the review..."
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10 focus:border-emerald-500/50 focus:outline-none" />
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="danger" onClick={() => reviewMutation.mutate({ id: reviewModal._id, status: 'rejected' })}
                isLoading={reviewMutation.isPending}>
                <XCircle className="w-4 h-4 mr-2" />Reject
              </Button>
              <Button variant="primary" onClick={() => reviewMutation.mutate({ id: reviewModal._id, status: 'approved' })}
                isLoading={reviewMutation.isPending}>
                <CheckCircle className="w-4 h-4 mr-2" />Approve
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Create Modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New Reconciliation" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1">Source</label>
              <select value={createForm.source || 'caf'} onChange={(e) => setCreateForm({ ...createForm, source: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10">
                <option value="caf">CAF</option>
                <option value="emr">EMR</option>
                <option value="lab">Lab</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">Branch ID</label>
              <input value={createForm.branchId || ''} onChange={(e) => setCreateForm({ ...createForm, branchId: e.target.value })}
                placeholder="Branch ID" className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">Period (YYYY-MM)</label>
              <input value={createForm.period || ''} onChange={(e) => setCreateForm({ ...createForm, period: e.target.value })} placeholder="2026-06"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">Total Sales</label>
              <input type="number" step="0.01" min="0" value={createForm.totalSales || ''} onChange={(e) => setCreateForm({ ...createForm, totalSales: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">Total Expenses</label>
              <input type="number" step="0.01" min="0" value={createForm.totalExpenses || ''} onChange={(e) => setCreateForm({ ...createForm, totalExpenses: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">Expected Cash (Sales - Expenses)</label>
            <input type="number" step="0.01" value={createForm.expectedCash || ''} onChange={(e) => setCreateForm({ ...createForm, expectedCash: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">Actual Cash Counted</label>
            <input type="number" step="0.01" min="0" value={createForm.actualCash || ''} onChange={(e) => setCreateForm({ ...createForm, actualCash: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Expected Payment Breakdown (optional)</label>
            <PaymentBreakdownInput prefix="create" form={createForm} setForm={setCreateForm} />
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-1">Notes (optional)</label>
            <textarea value={createForm.notes || ''} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} rows={2}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} isLoading={createMutation.isPending}
              disabled={!createForm.period || !createForm.branchId || !createForm.actualCash}>
              <Plus className="w-4 h-4 mr-2" />Create
            </Button>
          </div>
        </div>
      </Modal>
    </FinanceLayout>
  );
}

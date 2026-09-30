import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FinanceLayout } from '../../components/FinanceLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { useToast } from '../../hooks/useToast';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAuthStore } from '../../stores/auth-store';
import apiClient from '../../lib/api-client';
import { buildApiUrl } from '../../lib/api-utils';
import { getErrorMessage } from '../../lib/error-utils';
import { Plus, DollarSign, TrendingDown, Percent, Lock, Ban } from 'lucide-react';
import { useCurrency } from '../../hooks/useCurrency';

interface Loan {
  _id: string;
  referenceNumber: string;
  direction: 'received' | 'given';
  counterpartyName: string;
  principalAmount: number;
  outstandingPrincipal: number;
  interestRatePercent: number;
  totalInterestAccrued: number;
  status: 'active' | 'fully_repaid' | 'written_off' | 'cancelled';
  startDate: string;
  endDate?: string;
  termMonths: number;
  createdBy: { firstName: string; lastName: string };
}

interface LoanStats {
  totalActive: number;
  totalReceived: number;
  totalGiven: number;
  totalOutstanding: number;
  totalAccruedInterest: number;
  byStatus: { status: string; count: number; outstanding: number }[];
}

const statusBadge = (status: string) => {
  const s: Record<string, string> = {
    active: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    fully_repaid: 'bg-green-500/10 text-green-400 border-green-500/20',
    written_off: 'bg-red-500/10 text-red-400 border-red-500/20',
    cancelled: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  };
  return s[status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20';
};

export function FinanceLoansPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [repayModal, setRepayModal] = useState<Loan | null>(null);
  const [repayAmount, setRepayAmount] = useState('');
  const [accrueModal, setAccrueModal] = useState<Loan | null>(null);
  const [accrueMonths, setAccrueMonths] = useState('1');
  const [cancelModal, setCancelModal] = useState<Loan | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [form, setForm] = useState({
    referenceNumber: `LN-${Date.now().toString().slice(-6)}`,
    direction: 'received',
    counterpartyName: '',
    counterpartyContact: '',
    principalAmount: '',
    interestRatePercent: '',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: '',
    termMonths: '12',
    purpose: '',
  });
  const { selectedBranch } = useBranchStore();
  const user = useAuthStore((state) => state.user);
  const branchId = getBranchId(selectedBranch);
  const effectiveBranchId = user?.role === 'super_admin' ? undefined : branchId;
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const { format } = useCurrency();

  const { data: loans, isLoading, error, refetch } = useQuery({
    queryKey: ['finance', 'loans', effectiveBranchId],
    queryFn: async () => {
      const res = await apiClient.get(buildApiUrl('/finance-manager/loans', { branchId: effectiveBranchId }));
      return (res.data?.data ?? res.data) as Loan[];
    },
    enabled: user?.role === 'super_admin' || !!effectiveBranchId,
  });

  const { data: stats } = useQuery({
    queryKey: ['finance', 'loans-stats', effectiveBranchId],
    queryFn: async () => {
      const res = await apiClient.get(buildApiUrl('/finance-manager/loans/stats/summary', { branchId: effectiveBranchId }));
      return (res.data?.data ?? res.data) as LoanStats;
    },
    enabled: user?.role === 'super_admin' || !!effectiveBranchId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/finance-manager/loans', {
        ...form,
        branchId,
        principalAmount: Number(form.principalAmount),
        interestRatePercent: Number(form.interestRatePercent),
        termMonths: Number(form.termMonths),
        endDate: form.endDate || undefined,
      });
    },
    onSuccess: () => {
      showSuccess('Loan created');
      queryClient.invalidateQueries({ queryKey: ['finance', 'loans'] });
      setIsCreateOpen(false);
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to create loan')),
  });

  const repayMutation = useMutation({
    mutationFn: async () => {
      if (!repayModal) return;
      await apiClient.patch(`/finance-manager/loans/${repayModal._id}/repay`, {
        amount: Number(repayAmount),
        paymentDate: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      showSuccess('Repayment recorded');
      queryClient.invalidateQueries({ queryKey: ['finance', 'loans'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'loans-stats'] });
      setRepayModal(null);
      setRepayAmount('');
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to record repayment')),
  });

  const accrueMutation = useMutation({
    mutationFn: async () => {
      if (!accrueModal) return;
      await apiClient.patch(`/finance-manager/loans/${accrueModal._id}/accrue`, {
        months: Number(accrueMonths) || 1,
      });
    },
    onSuccess: () => {
      showSuccess(`Interest accrued for ${accrueMonths} month(s)`);
      queryClient.invalidateQueries({ queryKey: ['finance', 'loans'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'loans-stats'] });
      setAccrueModal(null);
      setAccrueMonths('1');
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to accrue interest')),
  });

  const closeMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/finance-manager/loans/${id}/close`);
    },
    onSuccess: () => {
      showSuccess('Loan closed');
      queryClient.invalidateQueries({ queryKey: ['finance', 'loans'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'loans-stats'] });
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to close loan')),
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!cancelModal) return;
      await apiClient.patch(`/finance-manager/loans/${cancelModal._id}/cancel`, {
        reason: cancelReason || 'No reason provided',
      });
    },
    onSuccess: () => {
      showSuccess('Loan cancelled');
      queryClient.invalidateQueries({ queryKey: ['finance', 'loans'] });
      queryClient.invalidateQueries({ queryKey: ['finance', 'loans-stats'] });
      setCancelModal(null);
      setCancelReason('');
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to cancel loan')),
  });

  const columns = [
    { key: 'referenceNumber', header: 'Reference', render: (l: Loan) => <span className="font-mono text-white">{l.referenceNumber}</span> },
    { key: 'direction', header: 'Type', render: (l: Loan) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${
        l.direction === 'received' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      }`}>{l.direction === 'received' ? 'Received' : 'Given'}</span>
    )},
    { key: 'counterpartyName', header: 'Counterparty' },
    { key: 'principalAmount', header: 'Principal', render: (l: Loan) => format(l.principalAmount) },
    { key: 'outstandingPrincipal', header: 'Outstanding', render: (l: Loan) => (
      <span className="font-semibold text-amber-400">{format(l.outstandingPrincipal)}</span>
    )},
    { key: 'interestRatePercent', header: 'Rate', render: (l: Loan) => `${l.interestRatePercent}%` },
    { key: 'status', header: 'Status', render: (l: Loan) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${statusBadge(l.status)}`}>{l.status.replace('_', ' ')}</span>
    )},
    { key: 'actions', header: '', render: (l: Loan) => l.status === 'active' ? (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={() => { setRepayModal(l); setRepayAmount(String(l.outstandingPrincipal)); }}>
          <DollarSign className="w-3 h-3 mr-1" />Repay
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setAccrueModal(l)}>
          <Percent className="w-3 h-3 mr-1" />Accrue
        </Button>
        {l.outstandingPrincipal <= 0.01 && (
          <Button size="sm" variant="ghost" onClick={() => closeMutation.mutate(l._id)}>
            <Lock className="w-3 h-3 mr-1" />Close
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => { setCancelModal(l); setCancelReason(''); }}>
          <Ban className="w-3 h-3 mr-1" />Cancel
        </Button>
      </div>
    ) : null },
  ];

  return (
    <FinanceLayout title="Loans">
      {stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">
            <p className="text-xs text-blue-300">Active Loans</p>
            <p className="text-2xl font-bold text-white">{stats.totalActive}</p>
          </div>
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
            <p className="text-xs text-green-300">Total Received</p>
            <p
              className="text-lg sm:text-2xl font-bold text-white tabular-nums break-words leading-tight"
              title={format(stats.totalReceived)}
            >
              {format(stats.totalReceived)}
            </p>
          </div>
          <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
            <p className="text-xs text-purple-300">Total Given</p>
            <p
              className="text-lg sm:text-2xl font-bold text-white tabular-nums break-words leading-tight"
              title={format(stats.totalGiven)}
            >
              {format(stats.totalGiven)}
            </p>
          </div>
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
            <p className="text-xs text-amber-300">Outstanding</p>
            <p
              className="text-lg sm:text-2xl font-bold text-white tabular-nums break-words leading-tight"
              title={format(stats.totalOutstanding)}
            >
              {format(stats.totalOutstanding)}
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-primary-dark/70 p-4">
            <p className="text-xs text-gray-400">Accrued Interest</p>
            <p
              className="text-lg sm:text-2xl font-bold text-white tabular-nums break-words leading-tight"
              title={format(stats.totalAccruedInterest)}
            >
              {format(stats.totalAccruedInterest)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mb-4 flex justify-end">
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />New Loan
        </Button>
      </div>

      {isLoading ? <Loading variant="centered" /> : error ? <Error message="Failed to load loans" onRetry={refetch} /> : (
        <Table data={loans || []} columns={columns} emptyMessage="No loans recorded" />
      )}

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="New Loan" size="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1">Reference #</label>
              <input value={form.referenceNumber} onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">Direction</label>
              <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10">
                <option value="received">Received (we borrowed)</option>
                <option value="given">Given (we lent)</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1">Counterparty</label>
              <input value={form.counterpartyName} onChange={(e) => setForm({ ...form, counterpartyName: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" placeholder="Bank or person name" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">Contact</label>
              <input value={form.counterpartyContact} onChange={(e) => setForm({ ...form, counterpartyContact: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" placeholder="Phone, email, account #" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1">Principal</label>
              <input type="number" value={form.principalAmount} onChange={(e) => setForm({ ...form, principalAmount: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">Interest Rate (%)</label>
              <input type="number" step="0.1" value={form.interestRatePercent} onChange={(e) => setForm({ ...form, interestRatePercent: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" placeholder="0" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">Term (months)</label>
              <input type="number" value={form.termMonths} onChange={(e) => setForm({ ...form, termMonths: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" placeholder="12" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1">Start Date</label>
              <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">End Date</label>
              <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-1">Purpose</label>
            <textarea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} rows={2}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" placeholder="What is the loan for?" />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} isLoading={createMutation.isPending}>Create Loan</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={!!repayModal} onClose={() => setRepayModal(null)} title="Record Loan Repayment">
        {repayModal ? (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-white font-medium">{repayModal.referenceNumber} - {repayModal.counterpartyName}</p>
              <p className="text-sm text-gray-400">Outstanding: {format(repayModal.outstandingPrincipal)} | Rate: {repayModal.interestRatePercent}%</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">Amount</label>
              <input type="number" value={repayAmount} onChange={(e) => setRepayAmount(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setRepayModal(null)}>Cancel</Button>
              <Button onClick={() => repayMutation.mutate()} isLoading={repayMutation.isPending}>
                <TrendingDown className="w-4 h-4 mr-2" />Record Repayment
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal isOpen={!!accrueModal} onClose={() => setAccrueModal(null)} title="Accrue Interest">
        {accrueModal ? (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-white font-medium">{accrueModal.referenceNumber} - {accrueModal.counterpartyName}</p>
              <p className="text-sm text-gray-400">
                Outstanding: {format(accrueModal.outstandingPrincipal)} | Rate: {accrueModal.interestRatePercent}%
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">Months to accrue</label>
              <input type="number" min="1" value={accrueMonths} onChange={(e) => setAccrueMonths(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
              <p className="mt-2 text-xs text-gray-400">
                Estimated interest: {format((accrueModal.outstandingPrincipal * (accrueModal.interestRatePercent / 100) / 12) * (Number(accrueMonths) || 0))}
              </p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setAccrueModal(null)}>Cancel</Button>
              <Button onClick={() => accrueMutation.mutate()} isLoading={accrueMutation.isPending}>
                <Percent className="w-4 h-4 mr-2" />Accrue
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal isOpen={!!cancelModal} onClose={() => setCancelModal(null)} title="Cancel Loan">
        {cancelModal ? (
          <div className="space-y-4">
            <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-200">
              <Ban className="inline h-4 w-4 mr-2" />
              This will mark the loan as cancelled. Only allowed if no repayments have been made.
            </div>
            <div className="bg-white/5 rounded-xl p-4">
              <p className="text-white font-medium">{cancelModal.referenceNumber} - {cancelModal.counterpartyName}</p>
              <p className="text-sm text-gray-400">Principal: {format(cancelModal.principalAmount)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">Reason</label>
              <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} rows={2}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setCancelModal(null)}>Back</Button>
              <Button onClick={() => cancelMutation.mutate()} isLoading={cancelMutation.isPending}>
                <Ban className="w-4 h-4 mr-2" />Cancel Loan
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </FinanceLayout>
  );
}

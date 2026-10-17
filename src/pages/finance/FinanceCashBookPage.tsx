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
import { queryKeys } from '../../lib/query-keys';
import apiClient from '../../lib/api-client';
import { buildApiUrl } from '../../lib/api-utils';
import { getErrorMessage } from '../../lib/error-utils';
import { Plus, TrendingUp, TrendingDown, DollarSign, ArrowRightLeft } from 'lucide-react';
import { useCurrency } from '../../hooks/useCurrency';
import { useConfirm } from '../../hooks/useConfirm';
import { formatDate } from '../../lib/date-format';

interface CashEntry {
  _id: string;
  type: string;
  category: string;
  amount: number;
  description: string;
  notes?: string;
  receiptNumber?: string;
  entryDate: string;
  recordedBy: { firstName: string; lastName: string };
}

interface CashSummary {
  totalIncome: number;
  totalExpense: number;
  totalTransfer: number;
  totalLoan: number;
  totalSalary: number;
  netCash: number;
  byCategory: { category: string; total: number; count: number }[];
}

const typeBadge = (type: string) => {
  const s: Record<string, string> = {
    income: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    expense: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    transfer: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    loan: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    salary: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    other: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  };
  return s[type] || s.other;
};

const amountStyleForType = (type: string): { className: string; sign: string } => {
  switch (type) {
    case 'income':
      return { className: 'text-emerald-400', sign: '+' };
    case 'expense':
      return { className: 'text-rose-400', sign: '-' };
    case 'transfer':
      return { className: 'text-blue-400', sign: '' };
    case 'loan':
      return { className: 'text-amber-400', sign: '' };
    case 'salary':
      return { className: 'text-purple-400', sign: '' };
    default:
      return { className: 'text-slate-300', sign: '' };
  }
};

const CATEGORIES = ['sales', 'services', 'supplies', 'maintenance', 'utilities', 'rent', 'salaries', 'transport', 'marketing', 'insurance', 'tax', 'petty_cash', 'other'];
const TYPES = ['income', 'expense', 'transfer', 'loan', 'salary', 'other'];

const EMPTY_FORM = { type: 'expense', category: 'supplies', amount: '', description: '', notes: '', receiptNumber: '', entryDate: '' };

export function FinanceCashBookPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const { selectedBranch } = useBranchStore();
  const branchId = getBranchId(selectedBranch);
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const { format } = useCurrency();
  const requestConfirmation = useConfirm();

  const handleCloseCreate = () => {
    setIsCreateOpen(false);
    setForm({ ...EMPTY_FORM });
  };

  const { data: entries, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.financeManager.cashEntries.list({ branchId, startDate, endDate, page: 1, limit: 200 }),
    queryFn: async () => {
      const res = await apiClient.get(buildApiUrl('/finance-manager/cash-entries', { branchId, startDate, endDate, limit: '200' }));
      return (res.data?.data ?? res.data) as CashEntry[];
    },
    enabled: !!branchId,
  });

  const { data: summary } = useQuery({
    queryKey: queryKeys.financeManager.cashEntries.summary(branchId, startDate, endDate),
    queryFn: async () => {
      const res = await apiClient.get(buildApiUrl('/finance-manager/cash-entries/stats/summary', { branchId, startDate, endDate }));
      return (res.data?.data ?? res.data) as CashSummary;
    },
    enabled: !!branchId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/finance-manager/cash-entries', { ...form, branchId, amount: Number(form.amount), entryDate: form.entryDate || undefined });
    },
    onSuccess: () => {
      showSuccess('Cash entry recorded');
      queryClient.invalidateQueries({ queryKey: queryKeys.financeManager.cashEntries.all() });
      handleCloseCreate();
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to create cash entry')),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { await apiClient.patch(`/finance-manager/cash-entries/${id}/delete`); },
    onSuccess: () => {
      showSuccess('Entry deleted');
      queryClient.invalidateQueries({ queryKey: queryKeys.financeManager.cashEntries.all() });
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to delete entry')),
  });

  const handleDelete = async (entry: CashEntry) => {
    const confirmed = await requestConfirmation({
      title: 'Delete this cash entry?',
      message: `The ${entry.type} of ${format(entry.amount)} — "${entry.description}" will be removed from the cash book. This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    deleteMutation.mutate(entry._id);
  };

  const columns = [
    { key: 'type', header: 'Type', render: (e: CashEntry) => (
      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${typeBadge(e.type)}`}>{e.type}</span>
    )},
    { key: 'category', header: 'Category', render: (e: CashEntry) => <span className="text-slate-300 text-sm">{e.category.replace('_', ' ')}</span> },
    { key: 'description', header: 'Description' },
    { key: 'amount', header: 'Amount', render: (e: CashEntry) => {
      const style = amountStyleForType(e.type);
      return (
        <span className={`font-semibold ${style.className}`}>
          {style.sign}{format(e.amount)}
        </span>
      );
    }},
    { key: 'entryDate', header: 'Date', render: (e: CashEntry) => formatDate(e.entryDate) },
    { key: 'recordedBy', header: 'Recorded By', render: (e: CashEntry) => e.recordedBy ? `${e.recordedBy.firstName} ${e.recordedBy.lastName}` : '-' },
    { key: 'actions', header: '', render: (e: CashEntry) => (
      <Button
        size="sm"
        variant="ghost"
        className="text-rose-400"
        onClick={() => void handleDelete(e)}
        isLoading={deleteMutation.isPending && deleteMutation.variables === e._id}
      >
        Delete
      </Button>
    )},
  ];

  return (
    <FinanceLayout title="Cash Book">
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/5 text-white border border-white/10 text-sm" />
          <span className="text-slate-400">to</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-2 rounded-xl bg-white/5 text-white border border-white/10 text-sm" />
        </div>
        <Button onClick={() => setIsCreateOpen(true)}><Plus className="w-4 h-4 mr-2" />Record Entry</Button>
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {[
            { label: 'Income', value: summary.totalIncome, icon: <TrendingUp className="w-4 h-4 text-emerald-400" />, color: 'bg-emerald-500/10 border-emerald-500/20' },
            { label: 'Expenses', value: summary.totalExpense, icon: <TrendingDown className="w-4 h-4 text-rose-400" />, color: 'bg-rose-500/10 border-rose-500/20' },
            { label: 'Transfers', value: summary.totalTransfer, icon: <ArrowRightLeft className="w-4 h-4 text-blue-400" />, color: 'bg-blue-500/10 border-blue-500/20' },
            { label: 'Loans', value: summary.totalLoan, icon: <DollarSign className="w-4 h-4 text-amber-400" />, color: 'bg-amber-500/10 border-amber-500/20' },
            { label: 'Salaries', value: summary.totalSalary, icon: <DollarSign className="w-4 h-4 text-purple-400" />, color: 'bg-purple-500/10 border-purple-500/20' },
            { label: 'Net Cash', value: summary.netCash, icon: <DollarSign className="w-4 h-4 text-cyan-400" />, color: 'bg-cyan-500/10 border-cyan-500/20' },
          ].map((c) => (
            <div key={c.label} className={`rounded-xl border p-3 ${c.color}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-slate-400">{c.label}</span>
                {c.icon}
              </div>
              <p className="text-lg font-bold text-white">{format(c.value)}</p>
            </div>
          ))}
        </div>
      )}

      {isLoading ? <Loading variant="centered" text="Loading..." /> : error ? <Error message="Failed to load" onRetry={refetch} /> : (
        <Table
          data={entries || []}
          columns={columns}
          emptyMessage="No cash entries found"
        />
      )}

      <Modal isOpen={isCreateOpen} onClose={handleCloseCreate} title="Record Cash Entry">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1">Type</label>
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10">
                {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-1">Amount</label>
            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" placeholder="0.00" />
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-1">Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" placeholder="What was this for?" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white mb-1">Receipt #</label>
              <input value={form.receiptNumber} onChange={(e) => setForm({ ...form, receiptNumber: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
            </div>
            <div>
              <label className="block text-sm font-medium text-white mb-1">Date</label>
              <input type="date" value={form.entryDate} onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
              className="w-full px-4 py-2.5 rounded-xl bg-white/5 text-white border border-white/10" />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={handleCloseCreate}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} isLoading={createMutation.isPending}>Record</Button>
          </div>
        </div>
      </Modal>
    </FinanceLayout>
  );
}

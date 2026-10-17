import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { AdminStatusBadge } from '../../components/admin';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { queryKeys } from '../../lib/query-keys';
import apiClient from '../../lib/api-client';
import { buildApiUrl } from '../../lib/api-utils';
import { getErrorMessage } from '../../lib/error-utils';
import { formatStatusLabel, toneForStatus } from '../../lib/admin-tones';
import { formatDate } from '../../lib/date-format';
import { Plus, TrendingUp, TrendingDown, DollarSign, ArrowRightLeft } from 'lucide-react';
import { useCurrency } from '../../hooks/useCurrency';

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

const CATEGORIES = ['sales', 'services', 'supplies', 'maintenance', 'utilities', 'rent', 'salaries', 'transport', 'marketing', 'insurance', 'tax', 'petty_cash', 'other'];
const TYPES = ['income', 'expense', 'transfer', 'loan', 'salary', 'other'];

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

export function CashManagementPage() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [form, setForm] = useState({ type: 'expense', category: 'supplies', amount: '', description: '', notes: '', receiptNumber: '', entryDate: '' });
  const { selectedBranch } = useBranchStore();
  const branchId = getBranchId(selectedBranch);
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const requestConfirmation = useConfirm();
  const { format: formatMoney } = useCurrency();

  const emptyForm = { type: 'expense', category: 'supplies', amount: '', description: '', notes: '', receiptNumber: '', entryDate: '' };
  const canSubmit = Number(form.amount) > 0 && form.description.trim().length > 0;

  const handleCloseCreate = () => {
    setIsCreateOpen(false);
    setForm(emptyForm);
  };

  const { data: entries, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.financeManager.cashEntries.list({ branchId, startDate: startDate || undefined, endDate: endDate || undefined }),
    queryFn: async () => {
      const res = await apiClient.get(buildApiUrl('/finance-manager/cash-entries', { branchId, startDate: startDate || undefined, endDate: endDate || undefined }));
      return (res.data?.data ?? res.data) as CashEntry[];
    },
    enabled: !!branchId,
  });

  const { data: summary } = useQuery({
    queryKey: queryKeys.financeManager.cashEntries.summary(branchId, startDate, endDate),
    queryFn: async () => {
      const res = await apiClient.get(buildApiUrl('/finance-manager/cash-entries/stats/summary', { branchId, startDate: startDate || undefined, endDate: endDate || undefined }));
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
      setIsCreateOpen(false);
      setForm(emptyForm);
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
      message: `${formatStatusLabel(entry.type)} of ${formatMoney(entry.amount)} — "${entry.description}" will be removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
    });
    if (!confirmed) return;
    deleteMutation.mutate(entry._id);
  };

  const columns = [
    { key: 'type', header: 'Type', render: (e: CashEntry) => (
      <AdminStatusBadge tone={toneForStatus(e.type)}>
        {formatStatusLabel(e.type)}
      </AdminStatusBadge>
    )},
    { key: 'category', header: 'Category', render: (e: CashEntry) => <span className="text-slate-300 text-sm">{e.category.replace('_', ' ')}</span> },
    { key: 'description', header: 'Description' },
    { key: 'amount', header: 'Amount', render: (e: CashEntry) => {
      const style = amountStyleForType(e.type);
      return (
        <span className={`font-semibold ${style.className}`}>
          {style.sign}{formatMoney(e.amount)}
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
    <AdminLayout title="Cash Management">
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
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          {[
            { label: 'Income', value: summary.totalIncome, icon: <TrendingUp className="w-4 h-4 text-green-400" />, color: 'bg-green-500/10 border-green-500/20' },
            { label: 'Expenses', value: summary.totalExpense, icon: <TrendingDown className="w-4 h-4 text-red-400" />, color: 'bg-red-500/10 border-red-500/20' },
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
              <p className="text-lg font-bold text-white">{formatMoney(c.value)}</p>
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
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
            >
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Select
              label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {CATEGORIES.map((c) => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </Select>
          </div>
          <Input
            label="Amount"
            type="number"
            min="0"
            step="0.01"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
            placeholder="0.00"
          />
          <Input
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="What was this for?"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Receipt #"
              value={form.receiptNumber}
              onChange={(e) => setForm({ ...form, receiptNumber: e.target.value })}
            />
            <Input
              label="Date"
              type="date"
              value={form.entryDate}
              onChange={(e) => setForm({ ...form, entryDate: e.target.value })}
            />
          </div>
          <Textarea
            label="Notes"
            rows={2}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          {!canSubmit && (
            <p className="text-xs text-slate-500">
              Enter an amount greater than zero and a description to record this entry.
            </p>
          )}
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={handleCloseCreate}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} isLoading={createMutation.isPending} disabled={!canSubmit}>Record</Button>
          </div>
        </div>
      </Modal>
    </AdminLayout>
  );
}

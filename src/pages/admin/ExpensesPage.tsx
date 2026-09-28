import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Plus, Receipt, Trash2 } from 'lucide-react';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Loading } from '../../components/ui/Loading';
import { Error as ErrorDisplay } from '../../components/ui/Error';
import { BranchSelector } from '../../components/BranchSelector';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAuthStore } from '../../stores/auth-store';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { getErrorMessage } from '../../lib/error-utils';
import { useToast } from '../../hooks/useToast';
import { useCurrency } from '../../hooks/useCurrency';
import { useConfirm } from '../../hooks/useConfirm';
import { unwrapArray } from '../../lib/unwrap-response';

const CATEGORIES = [
  { value: 'supplies', label: 'Supplies' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'petty_cash', label: 'Petty Cash' },
  { value: 'rent', label: 'Rent' },
  { value: 'salaries', label: 'Salaries' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_BADGE: Record<string, string> = {
  supplies: 'bg-blue-500/15 text-blue-300 border border-blue-500/20',
  maintenance: 'bg-orange-500/15 text-orange-300 border border-orange-500/20',
  utilities: 'bg-yellow-500/15 text-yellow-200 border border-yellow-500/20',
  petty_cash: 'bg-purple-500/15 text-purple-300 border border-purple-500/20',
  rent: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/20',
  salaries: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20',
  other: 'bg-slate-700/50 text-slate-300 border border-slate-700',
};

interface Expense {
  _id: string;
  branchId: string;
  shiftId: { _id: string; startTime: string } | string;
  recordedBy: { _id: string; firstName: string; lastName: string } | string;
  amount: number;
  category: string;
  description: string;
  notes?: string;
  receiptNumber?: string;
  createdAt: string;
}

interface ByCategoryItem {
  category: string;
  total: number;
  count: number;
}

interface ExpenseFormData {
  shiftId: string;
  amount: number;
  category: string;
  description: string;
  notes?: string;
  receiptNumber?: string;
}

export function ExpensesPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { selectedBranch } = useBranchStore();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const { format } = useCurrency();
  const requestConfirmation = useConfirm();

  const branchId = getBranchId(selectedBranch);

  const { data: currentShift } = useQuery({
    queryKey: queryKeys.shifts.current({ branchId, cashierId: user?.id }),
    queryFn: async () => {
      if (!branchId || !user?.id) return null;
      try {
        const res = await apiClient.get('/shifts/current', { params: { branchId, cashierId: user.id } });
        return res.data?.data ?? res.data;
      } catch {
        return null;
      }
    },
    enabled: !!branchId && !!user?.id,
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ExpenseFormData>();

  const { data: expenses, isLoading, error } = useQuery({
    queryKey: [...queryKeys.expenses.all(), 'branch', branchId],
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl(`/expenses/branch/${branchId}`));
      return unwrapArray<Expense>(response.data);
    },
    enabled: !!branchId,
  });

  const { data: byCategory } = useQuery({
    queryKey: [...queryKeys.expenses.all(), 'by-category', branchId],
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl(`/expenses/branch/${branchId}/by-category`));
      return unwrapArray<ByCategoryItem>(response.data);
    },
    enabled: !!branchId,
  });

  const createMutation = useMutation({
    mutationFn: async (data: ExpenseFormData) => {
      const shiftId = data.shiftId || currentShift?._id;
      if (!shiftId) {
        throw new Error('An active shift is required to record a register expense.');
      }
      const response = await apiClient.post('/expenses', {
        ...data,
        amount: Number(data.amount),
        shiftId,
        branchId,
        recordedBy: user?.id,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all() });
      showSuccess('Expense recorded');
      setIsModalOpen(false);
      reset();
    },
    onError: (err: unknown) => {
      showError(getErrorMessage(err, 'Failed to record expense'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/expenses/${id}/soft-delete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all() });
      showSuccess('Expense deleted');
    },
    onError: (err: any) => {
      showError(err?.response?.data?.message ?? 'Failed to delete expense');
    },
  });

  const handleDeleteExpense = async (expense: Expense) => {
    const confirmed = await requestConfirmation({
      title: 'Delete Expense?',
      message: `Are you sure you want to delete the expense "${expense.description}" (${format(expense.amount)})?`,
      confirmLabel: 'Delete Expense',
      variant: 'danger',
    });
    if (!confirmed) return;
    deleteMutation.mutate(expense._id);
  };

  const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0;

  return (
    <AdminLayout title="Expenses">
      <div className="max-w-6xl mx-auto py-6 px-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Expenses</h1>
            <p className="text-sm text-slate-400 mt-1">Track store operations, petty cash, and overhead costs</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <BranchSelector />
            <Button
              onClick={() => setIsModalOpen(true)}
              disabled={!branchId}
              className="inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>Record Expense</span>
            </Button>
          </div>
        </div>

        {!branchId ? (
          <div className="max-w-md mx-auto text-center py-16 px-4">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Receipt className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Select a Branch</h2>
            <p className="text-sm text-slate-400 mb-6">
              Expenses are recorded per branch. Choose a branch to review and record overhead expenditures.
            </p>
            <div className="flex justify-center">
              <BranchSelector />
            </div>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            {byCategory && byCategory.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <div className="col-span-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4 md:col-span-1">
                  <p className="text-xs text-slate-400 uppercase font-semibold mb-1">Total</p>
                  <p className="text-2xl font-bold text-white">{format(totalExpenses)}</p>
                  <p className="text-xs text-slate-400 mt-1">{expenses?.length ?? 0} entries</p>
                </div>
                {byCategory.map((item) => (
                  <div key={item.category} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                    <p className="text-xs text-slate-400 uppercase font-semibold mb-1">{item.category.replace('_', ' ')}</p>
                    <p className="text-xl font-bold text-white">{format(item.total)}</p>
                    <p className="text-xs text-slate-400 mt-1">{item.count} entries</p>
                  </div>
                ))}
              </div>
            )}

            {isLoading && <Loading />}
            {error && <ErrorDisplay message="Failed to load expenses" />}

            {expenses && expenses.length === 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 text-slate-400 text-sm text-center py-12">
                No expenses recorded for this branch yet.
              </div>
            )}

            {expenses && expenses.length > 0 && (
              <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
                <Table
                  columns={[
                    {
                      key: 'createdAt',
                      header: 'Date',
                      render: (row: Expense) => new Date(row.createdAt).toLocaleDateString(),
                    },
                    {
                      key: 'category',
                      header: 'Category',
                      render: (row: Expense) => (
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${CATEGORY_BADGE[row.category] ?? CATEGORY_BADGE.other}`}>
                          {row.category.replace('_', ' ')}
                        </span>
                      ),
                    },
                    {
                      key: 'description',
                      header: 'Description',
                      render: (row: Expense) => (
                        <div>
                          <p className="font-medium text-slate-200">{row.description}</p>
                          {row.receiptNumber && (
                            <p className="text-xs text-slate-400">Receipt: {row.receiptNumber}</p>
                          )}
                        </div>
                      ),
                    },
                    {
                      key: 'recordedBy',
                      header: 'Recorded By',
                      render: (row: Expense) =>
                        typeof row.recordedBy === 'object'
                          ? `${row.recordedBy.firstName || ''} ${row.recordedBy.lastName || ''}`.trim() || 'Staff'
                          : '-',
                    },
                    {
                      key: 'amount',
                      header: 'Amount',
                      render: (row: Expense) => (
                        <span className="font-semibold text-white">{format(row.amount)}</span>
                      ),
                    },
                    {
                      key: 'actions',
                      header: '',
                      render: (row: Expense) => (
                        <button
                          onClick={() => handleDeleteExpense(row)}
                          disabled={deleteMutation.isPending}
                          className="inline-flex items-center gap-1 text-red-400 hover:text-red-300 text-sm transition-colors"
                          aria-label={`Delete ${row.description}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      ),
                    },
                  ]}
                  data={expenses}
                />
              </div>
            )}
          </>
        )}

        <Modal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); reset(); }}
          title="Record Expense"
        >
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            {currentShift?._id ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs text-emerald-300">
                <span className="font-medium">Active Register Shift Linked</span>
                <span className="font-mono text-[11px] opacity-75">{currentShift._id.slice(-8)}</span>
              </div>
            ) : (
              <Input
                label="Shift ID"
                {...register('shiftId', { required: 'Shift ID is required when no register shift is open' })}
                error={errors.shiftId?.message}
                placeholder="MongoDB ID of the shift"
              />
            )}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-1.5">Expense Category</label>
              <select
                {...register('category', { required: 'Category is required' })}
                className="w-full rounded-xl border border-white/10 bg-slate-900/90 px-3.5 py-2.5 text-xs text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
              >
                <option value="">Select category...</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {errors.category && <p className="text-rose-400 text-xs mt-1 font-medium">{errors.category.message}</p>}
            </div>
            <Input
              label="Amount"
              type="number"
              step="0.01"
              min="0.01"
              {...register('amount', { required: 'Amount is required', valueAsNumber: true, min: { value: 0.01, message: 'Must be > 0' } })}
              error={errors.amount?.message}
            />
            <Input
              label="Description"
              {...register('description', { required: 'Description is required' })}
              error={errors.description?.message}
            />
            <Input
              label="Receipt Number (optional)"
              {...register('receiptNumber')}
            />
            <Input
              label="Notes (optional)"
              {...register('notes')}
            />
            <div className="flex gap-3 justify-end pt-4 border-t border-white/[0.08]">
              <Button variant="secondary" type="button" onClick={() => { setIsModalOpen(false); reset(); }}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                isLoading={createMutation.isPending}
              >
                Record Expense
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
}

export default ExpensesPage;

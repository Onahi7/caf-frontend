import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { useToast } from '../../hooks/useToast';
import { useCurrency } from '../../hooks/useCurrency';
import { unwrapArray } from '../../lib/unwrap-response';

const CATEGORIES = [
  { value: 'supplies', label: 'Supplies' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'petty_cash', label: 'Petty Cash' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_BADGE: Record<string, string> = {
  supplies: 'bg-blue-500/15 text-blue-300 border border-blue-500/20',
  maintenance: 'bg-orange-500/15 text-orange-300 border border-orange-500/20',
  utilities: 'bg-yellow-500/15 text-yellow-200 border border-yellow-500/20',
  petty_cash: 'bg-purple-500/15 text-purple-300 border border-purple-500/20',
  other: 'bg-white/10 text-gray-300 border border-white/10',
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
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useToast();
  const { format } = useCurrency();

  const branchId = getBranchId(selectedBranch);

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
      const response = await apiClient.post('/expenses', {
        ...data,
        branchId,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.expenses.all() });
      showSuccess('Expense recorded');
      setIsModalOpen(false);
      reset();
    },
    onError: (err: any) => {
      showError(err?.response?.data?.message ?? 'Failed to record expense');
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

  const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) ?? 0;

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto py-6 px-4">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-white">Expenses</h1>
          <Button onClick={() => setIsModalOpen(true)} disabled={!selectedBranch}>
            + Record Expense
          </Button>
        </div>

        {!selectedBranch && (
          <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-200 mb-4">
            Select a branch to view expenses.
          </div>
        )}

        {/* Summary cards */}
        {byCategory && byCategory.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="col-span-2 rounded-xl border border-white/10 bg-white/5 p-4 md:col-span-1">
              <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Total</p>
              <p className="text-2xl font-bold text-white">{format(totalExpenses)}</p>
              <p className="text-xs text-gray-400 mt-1">{expenses?.length ?? 0} entries</p>
            </div>
            {byCategory.map((item) => (
              <div key={item.category} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">{item.category.replace('_', ' ')}</p>
                <p className="text-xl font-bold text-white">{format(item.total)}</p>
                <p className="text-xs text-gray-400 mt-1">{item.count} entries</p>
              </div>
            ))}
          </div>
        )}

        {isLoading && <Loading />}
        {error && <Error message="Failed to load expenses" />}

        {expenses && expenses.length === 0 && (
          <div className="text-gray-400 text-sm text-center py-12">
            No expenses recorded for this branch.
          </div>
        )}

        {expenses && expenses.length > 0 && (
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
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize ${CATEGORY_BADGE[row.category] ?? CATEGORY_BADGE.other}`}>
                      {row.category.replace('_', ' ')}
                    </span>
                  ),
                },
                {
                  key: 'description',
                  header: 'Description',
                  render: (row: Expense) => (
                    <div>
                      <p className="font-medium text-gray-200">{row.description}</p>
                      {row.receiptNumber && (
                        <p className="text-xs text-gray-400">Receipt: {row.receiptNumber}</p>
                      )}
                    </div>
                  ),
                },
                {
                  key: 'recordedBy',
                  header: 'Recorded By',
                  render: (row: Expense) =>
                    typeof row.recordedBy === 'object'
                      ? `${row.recordedBy.firstName} ${row.recordedBy.lastName}`
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
                      onClick={() => deleteMutation.mutate(row._id)}
                      disabled={deleteMutation.isPending}
                      className="text-red-500 hover:text-red-700 text-sm"
                    >
                      Delete
                    </button>
                  ),
                },
              ]}
              data={expenses}
            />
        )}

        <Modal
          isOpen={isModalOpen}
          onClose={() => { setIsModalOpen(false); reset(); }}
          title="Record Expense"
        >
          <form onSubmit={handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
            <Input
              label="Shift ID"
              {...register('shiftId', { required: 'Shift ID is required' })}
              error={errors.shiftId?.message}
              placeholder="MongoDB ID of the current shift"
            />
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Category</label>
              <select
                {...register('category', { required: 'Category is required' })}
                className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:border-accent-green/50 focus:outline-none focus:ring-2 focus:ring-accent-green/20"
              >
                <option value="">Select category...</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category.message}</p>}
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
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="secondary" type="button" onClick={() => { setIsModalOpen(false); reset(); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                Record Expense
              </Button>
            </div>
          </form>
        </Modal>
      </div>
    </AdminLayout>
  );
}

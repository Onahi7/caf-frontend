import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FinanceLayout } from '../../components/FinanceLayout';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { Button } from '../../components/ui/Button';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useToast } from '../../hooks/useToast';
import { getErrorMessage } from '../../lib/error-utils';
import {
  recurringInvoicesApi,
  type RecurringInvoice,
  type RecurringCadence,
  type RecurringItem,
} from '../../lib/recurring-invoices-api';
import { useCurrency } from '../../hooks/useCurrency';
import { useConfirm } from '../../hooks/useConfirm';

const CADENCE_LABELS: Record<RecurringCadence, string> = {
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
};

function fmtDate(iso?: string) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString();
}

function addDays(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

interface FormState {
  customerId: string;
  customerName: string;
  description: string;
  cadence: RecurringCadence;
  nextRunAt: string;
  total: number;
  discount: number;
  items: RecurringItem[];
  maxRuns: number;
  endDate: string;
}

const EMPTY_FORM: FormState = {
  customerId: '',
  customerName: '',
  description: '',
  cadence: 'monthly',
  nextRunAt: addDays(30),
  total: 0,
  discount: 0,
  items: [],
  maxRuns: 0,
  endDate: '',
};

export function RecurringInvoicesPage() {
  const { selectedBranch } = useBranchStore();
  const branchId = getBranchId(selectedBranch);
  const { showSuccess, showError } = useToast();
  const queryClient = useQueryClient();
  const { format: fmtMoney } = useCurrency();
  const requestConfirmation = useConfirm();
  const [editing, setEditing] = useState<RecurringInvoice | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  const { data: templates, isLoading, error } = useQuery({
    queryKey: ['recurring-invoices', branchId],
    queryFn: () => recurringInvoicesApi.list({ branchId: branchId ?? undefined }),
    enabled: !!branchId,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      recurringInvoicesApi.create({
        branchId: branchId!,
        customerId: form.customerId,
        customerName: form.customerName || undefined,
        description: form.description || `Recurring invoice for ${form.customerName || 'customer'}`,
        items: form.items.length > 0
          ? form.items
          : [{ productName: form.description || 'Recurring charge', quantity: 1, unitPrice: form.total, subtotal: form.total }],
        total: form.total,
        discount: form.discount,
        cadence: form.cadence,
        nextRunAt: new Date(form.nextRunAt).toISOString(),
        maxRuns: form.maxRuns,
        endDate: form.endDate || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] });
      showSuccess('Recurring invoice created');
      setShowForm(false);
      setForm(EMPTY_FORM);
    },
    onError: (err: unknown) => showError(getErrorMessage(err, 'Failed to create')),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      recurringInvoicesApi.update(id, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => recurringInvoicesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] });
      showSuccess('Removed');
    },
  });

  const runNowMutation = useMutation({
    mutationFn: (id: string) => recurringInvoicesApi.runNow(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['recurring-invoices'] });
      if (result.shouldDeactivate) {
        showSuccess(`Run #${result.runCount} completed - schedule reached max runs and was deactivated.`);
      } else {
        showSuccess(`Run #${result.runCount} completed. Next run: ${fmtDate(result.nextRunAt)}`);
      }
    },
  });

  if (isLoading) {
    return (
      <FinanceLayout title="Recurring Invoices">
        <Loading variant="centered" text="Loading recurring invoices..." />
      </FinanceLayout>
    );
  }

  if (error) {
    return (
      <FinanceLayout title="Recurring Invoices">
        <Error message="Failed to load recurring invoices" />
      </FinanceLayout>
    );
  }

  const renderForm = () => (
    <div className="bg-primary-dark border border-gray-700 rounded-2xl p-5 mb-6">
      <h3 className="text-lg font-bold text-white mb-4">
        {editing ? 'Edit' : 'New'} Recurring Invoice
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-400">Customer ID</label>
          <input
            type="text"
            value={form.customerId}
            onChange={(e) => setForm({ ...form, customerId: e.target.value })}
            placeholder="Customer ObjectId"
            className="w-full mt-1 px-3 py-2 bg-primary-darker border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent-green"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400">Customer Name</label>
          <input
            type="text"
            value={form.customerName}
            onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            placeholder="e.g. John Doe"
            className="w-full mt-1 px-3 py-2 bg-primary-darker border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent-green"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-gray-400">Description</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="e.g. Monthly blood pressure medication"
            className="w-full mt-1 px-3 py-2 bg-primary-darker border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent-green"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400">Cadence</label>
          <select
            value={form.cadence}
            onChange={(e) => setForm({ ...form, cadence: e.target.value as RecurringCadence })}
            className="w-full mt-1 px-3 py-2 bg-primary-darker border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent-green"
          >
            {(Object.keys(CADENCE_LABELS) as RecurringCadence[]).map((c) => (
              <option key={c} value={c}>
                {CADENCE_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-400">Next Run</label>
          <input
            type="date"
            value={form.nextRunAt}
            onChange={(e) => setForm({ ...form, nextRunAt: e.target.value })}
            className="w-full mt-1 px-3 py-2 bg-primary-darker border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent-green"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400">Total Amount</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.total}
            onChange={(e) => setForm({ ...form, total: Number(e.target.value) })}
            className="w-full mt-1 px-3 py-2 bg-primary-darker border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent-green"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400">Max Runs (0 = unlimited)</label>
          <input
            type="number"
            min="0"
            value={form.maxRuns}
            onChange={(e) => setForm({ ...form, maxRuns: Number(e.target.value) })}
            className="w-full mt-1 px-3 py-2 bg-primary-darker border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent-green"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400">End Date (optional)</label>
          <input
            type="date"
            value={form.endDate}
            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
            className="w-full mt-1 px-3 py-2 bg-primary-darker border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-accent-green"
          />
        </div>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={() => {
            setShowForm(false);
            setEditing(null);
            setForm(EMPTY_FORM);
          }}
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={() => createMutation.mutate()}
          disabled={!form.customerId || !form.total || createMutation.isPending}
          isLoading={createMutation.isPending}
        >
          {editing ? 'Update' : 'Create'}
        </Button>
      </div>
    </div>
  );

  return (
    <FinanceLayout title="Recurring Invoices">
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-gray-400 text-sm">
            Schedule credit-sale templates to bill customers automatically (e.g. monthly refills).
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            setEditing(null);
            setForm(EMPTY_FORM);
            setShowForm((s) => !s);
          }}
        >
          {showForm ? 'Cancel' : '+ New Recurring Invoice'}
        </Button>
      </div>

      {showForm && renderForm()}

      <div className="bg-primary-dark border border-gray-700 rounded-2xl overflow-hidden">
        {!templates || templates.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-sm">No recurring invoices yet</p>
            <p className="text-xs mt-1">Create one to bill customers automatically.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wider border-b border-gray-800">
                  <th className="px-3 py-3 sm:px-6 sm:py-3">Customer / Description</th>
                  <th className="px-3 py-3 sm:px-6 sm:py-3">Cadence</th>
                  <th className="px-3 py-3 sm:px-6 sm:py-3">Total</th>
                  <th className="px-3 py-3 sm:px-6 sm:py-3">Next Run</th>
                  <th className="px-3 py-3 sm:px-6 sm:py-3">Runs</th>
                  <th className="px-3 py-3 sm:px-6 sm:py-3">Status</th>
                  <th className="px-3 py-3 sm:px-6 sm:py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {templates.map((t) => {
                  const days = daysUntil(t.nextRunAt);
                  return (
                    <tr key={t._id} className="hover:bg-primary-darker transition-colors">
                      <td className="px-3 py-3 sm:px-6 sm:py-3">
                        <p className="text-white font-semibold whitespace-normal break-words">
                          {t.customerName || '-'}
                        </p>
                        <p className="text-xs text-gray-400 whitespace-normal break-words">{t.description}</p>
                      </td>
                      <td className="px-3 py-3 sm:px-6 sm:py-3 text-gray-300">
                        {CADENCE_LABELS[t.cadence]}
                      </td>
                      <td className="px-3 py-3 sm:px-6 sm:py-3 text-white font-semibold">
                        {fmtMoney(t.total)}
                      </td>
                      <td className="px-3 py-3 sm:px-6 sm:py-3 text-gray-300">
                        <p>{fmtDate(t.nextRunAt)}</p>
                        <p className={`text-xs ${days < 0 ? 'text-red-400' : days <= 3 ? 'text-yellow-400' : 'text-gray-500'}`}>
                          {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'today' : `in ${days}d`}
                        </p>
                      </td>
                      <td className="px-3 py-3 sm:px-6 sm:py-3 text-gray-300">
                        {t.runCount}{t.maxRuns > 0 ? ` / ${t.maxRuns}` : ''}
                      </td>
                      <td className="px-3 py-3 sm:px-6 sm:py-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-semibold rounded-full ${
                            t.active
                              ? 'bg-green-500/20 text-green-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {t.active ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="px-3 py-3 sm:px-6 sm:py-3 text-right space-x-1 whitespace-nowrap">
                        <button
                          onClick={() => runNowMutation.mutate(t._id)}
                          disabled={runNowMutation.isPending || !t.active}
                          className="px-2 py-1 text-xs bg-accent-green/20 text-accent-green rounded hover:bg-accent-green/30 disabled:opacity-50"
                          title="Materialize this invoice now"
                        >
                          Run now
                        </button>
                        <button
                          onClick={() => toggleMutation.mutate({ id: t._id, active: !t.active })}
                          className="px-2 py-1 text-xs bg-white/5 text-gray-300 rounded hover:bg-white/10"
                        >
                          {t.active ? 'Pause' : 'Resume'}
                        </button>
                        <button
                          onClick={async () => {
                            const confirmed = await requestConfirmation({
                              title: 'Delete recurring invoice?',
                              message: `"${t.description}" and its future schedule will be permanently removed.`,
                              confirmLabel: 'Delete invoice',
                              variant: 'danger',
                            });
                            if (confirmed) removeMutation.mutate(t._id);
                          }}
                          className="px-2 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </FinanceLayout>
  );
}

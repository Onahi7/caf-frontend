import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, ReceiptText, Wallet, AlertTriangle } from 'lucide-react';
import { FinanceLayout } from '../../components/FinanceLayout';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Loading } from '../../components/ui/Loading';
import { Error as ErrorDisplay } from '../../components/ui/Error';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useCurrency } from '../../hooks/useCurrency';
import { buildApiUrl } from '../../lib/api-utils';
import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../lib/query-keys';
import { getErrorMessage } from '../../lib/error-utils';
import apiClient from '../../lib/api-client';

interface CreditSale {
  _id: string;
  receiptNumber: string;
  customerName?: string;
  customerPhone?: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid' | 'overdue';
  dueDate?: string;
  createdAt: string;
  payments?: {
    paymentReceiptNumber?: string;
    amount: number;
    paymentMethod: string;
    receivedAt: string;
    balanceAfterPayment?: number;
  }[];
}

const paymentMethodOptions = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'africell_money', label: 'Africell Money' },
  { value: 'qmoney', label: 'QMoney' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

type StatusFilter = 'open' | 'overdue' | 'paid' | 'all';

export function FinanceReceivablesPage() {
  const queryClient = useQueryClient();
  const { format } = useCurrency();
  const { showSuccess, showError } = useToast();
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const branchId = getBranchId(selectedBranch);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('open');
  const [selectedSale, setSelectedSale] = useState<CreditSale | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const params = useMemo(() => {
    const base: Record<string, string> = {
      branchId: branchId || '',
      saleType: 'credit',
      limit: '500',
    };
    if (statusFilter === 'paid') base.paymentStatus = 'paid';
    return base;
  }, [branchId, statusFilter]);

  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.sales.credit(params), 'finance-receivables', statusFilter],
    queryFn: async () => {
      const response = await apiClient.get('/sales', { params });
      const sales = (response.data?.data || []) as CreditSale[];
      const now = new Date();
      if (statusFilter === 'open') {
        return sales.filter((s) => s.paymentStatus === 'unpaid' || s.paymentStatus === 'partial');
      }
      if (statusFilter === 'overdue') {
        return sales.filter((s) => s.paymentStatus !== 'paid' && s.dueDate && new Date(s.dueDate) < now);
      }
      return sales;
    },
    enabled: !!branchId,
  });

  const { data: aging } = useQuery({
    queryKey: ['finance', 'receivables-aging', branchId],
    queryFn: async () => {
      const res = await apiClient.get(
        buildApiUrl('/finance-manager/receivables/aging', { branchId }),
      );
      return (res.data?.data ?? res.data) as {
        asOf: string;
        buckets: { bucket: string; label: string; count: number; totalOutstanding: number }[];
        totalOutstanding: number;
        totalOverdue: number;
      };
    },
    enabled: !!branchId,
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSale) throw new Error('No sale selected');
      const amount = Number(paymentAmount);
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('Enter a valid payment amount');
      const response = await apiClient.post(`/sales/${selectedSale._id}/payments`, {
        amount,
        paymentMethod,
        paymentReference: paymentReference || undefined,
        notes: paymentNotes || undefined,
      });
      return response.data;
    },
    onSuccess: () => {
      showSuccess('Payment recorded successfully');
      setSelectedSale(null);
      setPaymentAmount('');
      setPaymentReference('');
      setPaymentNotes('');
      queryClient.invalidateQueries({ queryKey: queryKeys.sales.all(), exact: false });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all(), exact: false });
    },
    onError: (error) => {
      showError(getErrorMessage(error, 'Failed to record payment'));
    },
  });

  const sales = data || [];
  const now = new Date();
  const parsedPaymentAmount = Number(paymentAmount);
  const paymentWouldOverpay = selectedSale
    ? Number.isFinite(parsedPaymentAmount) && parsedPaymentAmount > selectedSale.balanceDue
    : false;
  const remainingAfterPayment = selectedSale && Number.isFinite(parsedPaymentAmount)
    ? Math.max(0, selectedSale.balanceDue - parsedPaymentAmount)
    : selectedSale?.balanceDue ?? 0;
  const outstandingBalance = sales
    .filter((s) => s.paymentStatus !== 'paid')
    .reduce((sum, s) => sum + (s.balanceDue || 0), 0);
  const overdueSales = sales.filter((s) => s.paymentStatus !== 'paid' && s.dueDate && new Date(s.dueDate) < now);
  const overdueAmount = overdueSales.reduce((sum, s) => sum + (s.balanceDue || 0), 0);

  return (
    <FinanceLayout title="Receivables">
      <div className="mb-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-white/10 bg-primary-dark/70 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Open credit sales</p>
          <p className="mt-2 text-2xl font-bold text-white">
            {sales.filter((s) => s.paymentStatus !== 'paid').length}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-primary-dark/70 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Outstanding balance</p>
          <p
            className="mt-2 text-xl sm:text-2xl font-bold text-amber-300 tabular-nums break-words leading-tight"
            title={format(outstandingBalance)}
          >
            {format(outstandingBalance)}
          </p>
        </div>
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-xs uppercase tracking-wide text-amber-300 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Overdue
          </p>
          <p className="mt-2 text-xl sm:text-2xl font-bold text-amber-300">{overdueSales.length}</p>
          <p
            className="text-xs text-amber-200 tabular-nums break-words"
            title={format(overdueAmount)}
          >
            {format(overdueAmount)}
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-primary-dark/70 p-4">
          <p className="text-xs uppercase tracking-wide text-gray-400">Fully paid</p>
          <p className="mt-2 text-2xl font-bold text-emerald-300">
            {sales.filter((s) => s.paymentStatus === 'paid').length}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {[
          { key: 'open', label: 'Open balances' },
          { key: 'overdue', label: 'Overdue' },
          { key: 'paid', label: 'Paid' },
          { key: 'all', label: 'All' },
        ].map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setStatusFilter(opt.key as StatusFilter)}
            className={`rounded-xl border px-4 py-2 text-sm transition-colors ${
              statusFilter === opt.key
                ? 'border-accent-green bg-accent-green/15 text-accent-green'
                : 'border-white/10 bg-primary-dark/60 text-gray-300 hover:border-white/20 hover:text-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {aging ? (
        <div className="mb-6 rounded-2xl border border-white/10 bg-primary-dark/70 p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Aging buckets</h3>
            <span className="text-xs text-gray-500">
              As of {new Date(aging.asOf).toLocaleDateString()}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {aging.buckets.map((b) => {
              const tone =
                b.bucket === '90_plus'
                  ? 'border-rose-500/30 bg-rose-500/10'
                  : b.bucket === '61_90'
                    ? 'border-orange-500/30 bg-orange-500/10'
                    : b.bucket === '31_60'
                      ? 'border-amber-500/30 bg-amber-500/10'
                      : 'border-emerald-500/30 bg-emerald-500/10';
              return (
                <div key={b.bucket} className={`rounded-xl border p-3 ${tone}`}>
                  <p className="text-xs text-gray-300">{b.label}</p>
                  <p className="mt-1 text-lg font-bold text-white">{format(b.totalOutstanding)}</p>
                  <p className="text-xs text-gray-400">{b.count} invoice{b.count === 1 ? '' : 's'}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <Loading />
      ) : error ? (
        <ErrorDisplay message="Failed to load receivables" />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {sales.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-primary-dark/50 p-8 text-center text-gray-400 xl:col-span-2">
              No receivables match this filter.
            </div>
          ) : (
            sales.map((sale) => {
              const isOverdue = sale.dueDate && new Date(sale.dueDate) < now && sale.paymentStatus !== 'paid';
              const statusTone = isOverdue
                ? 'text-rose-300 border-rose-500/30 bg-rose-500/10'
                : sale.paymentStatus === 'paid'
                  ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                  : sale.paymentStatus === 'partial'
                    ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
                    : 'text-rose-300 border-rose-500/30 bg-rose-500/10';
              return (
                <div key={sale._id} className="rounded-2xl border border-white/10 bg-primary-dark/70 p-5">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold text-white">
                          {sale.customerName || 'Walk-in credit customer'}
                        </h2>
                        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusTone}`}>
                          {isOverdue ? 'overdue' : sale.paymentStatus}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-gray-400">{sale.receiptNumber}</p>
                      {sale.customerPhone ? <p className="mt-1 text-sm text-gray-500">{sale.customerPhone}</p> : null}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm w-full sm:max-w-[260px]">
                      <div className="rounded-xl bg-white/5 p-3">
                        <p className="text-gray-400">Total</p>
                        <p className="mt-1 font-semibold text-white">{format(sale.total)}</p>
                      </div>
                      <div className="rounded-xl bg-white/5 p-3">
                        <p className="text-gray-400">Balance</p>
                        <p className="mt-1 font-semibold text-amber-300">{format(sale.balanceDue)}</p>
                      </div>
                      <div className="rounded-xl bg-white/5 p-3">
                        <p className="text-gray-400">Paid</p>
                        <p className="mt-1 font-semibold text-emerald-300">{format(sale.amountPaid)}</p>
                      </div>
                      <div className="rounded-xl bg-white/5 p-3">
                        <p className="text-gray-400">Due</p>
                        <p className="mt-1 font-semibold text-white">
                          {sale.dueDate ? new Date(sale.dueDate).toLocaleDateString() : '-'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
                    <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                      <span className="inline-flex items-center gap-2">
                        <ReceiptText className="h-4 w-4" />
                        {new Date(sale.createdAt).toLocaleDateString()}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Wallet className="h-4 w-4" />
                        {sale.payments?.length || 0} payment(s)
                      </span>
                    </div>
                    {sale.paymentStatus !== 'paid' ? (
                      <Button
                        onClick={() => {
                          setSelectedSale(sale);
                          setPaymentAmount(String(sale.balanceDue));
                          setPaymentMethod('cash');
                          setPaymentReference('');
                          setPaymentNotes('');
                        }}
                      >
                        Record Payment
                      </Button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      <Modal isOpen={!!selectedSale} onClose={() => setSelectedSale(null)} title="Receive Credit Payment" size="md">
        {selectedSale ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-primary-darker/70 p-4">
              <p className="text-sm text-gray-400">{selectedSale.receiptNumber}</p>
              <h3 className="mt-1 text-lg font-semibold text-white">
                {selectedSale.customerName || 'Credit customer'}
              </h3>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-gray-400">Outstanding</p>
                  <p className="mt-1 font-semibold text-amber-300">{format(selectedSale.balanceDue)}</p>
                </div>
                <div className="rounded-xl bg-white/5 p-3">
                  <p className="text-gray-400">Already paid</p>
                  <p className="mt-1 font-semibold text-emerald-300">{format(selectedSale.amountPaid)}</p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm text-gray-300">Amount received</span>
                <input
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  type="number"
                  min="0"
                  max={selectedSale.balanceDue}
                  step="0.01"
                  className="w-full rounded-xl border border-white/10 bg-primary-darker px-4 py-3 text-white outline-none focus:border-accent-green"
                />
                {paymentWouldOverpay ? (
                  <p className="text-xs text-rose-300">Payment cannot exceed the outstanding balance.</p>
                ) : null}
              </label>
              <label className="space-y-2">
                <span className="text-sm text-gray-300">Payment method</span>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-primary-darker px-4 py-3 text-white outline-none focus:border-accent-green"
                >
                  {paymentMethodOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm text-gray-300">Reference</span>
                <input
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-primary-darker px-4 py-3 text-white outline-none focus:border-accent-green"
                />
              </label>
              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm text-gray-300">Notes</span>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-primary-darker px-4 py-3 text-white outline-none focus:border-accent-green"
                />
              </label>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Remaining after payment</span>
                <span className="font-semibold text-white">{format(remainingAfterPayment)}</span>
              </div>
            </div>

            {selectedSale.payments?.length ? (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-white">Payment history</h4>
                <div className="max-h-44 space-y-2 overflow-y-auto pr-1">
                  {selectedSale.payments.map((payment, index) => (
                    <div key={`${payment.receivedAt}-${index}`} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-white">{format(payment.amount)}</span>
                        <span className="text-xs text-gray-400">{new Date(payment.receivedAt).toLocaleString()}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                        <span className="capitalize">{payment.paymentMethod.replace(/_/g, ' ')}</span>
                        {payment.paymentReceiptNumber ? <span>{payment.paymentReceiptNumber}</span> : null}
                        {payment.balanceAfterPayment !== undefined ? <span>Balance: {format(payment.balanceAfterPayment)}</span> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={() => setSelectedSale(null)}>Cancel</Button>
              <Button
                onClick={() => recordPaymentMutation.mutate()}
                isLoading={recordPaymentMutation.isPending}
                disabled={
                  !Number.isFinite(parsedPaymentAmount) ||
                  parsedPaymentAmount <= 0 ||
                  paymentWouldOverpay
                }
              >
                <span className="inline-flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Save Payment
                </span>
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </FinanceLayout>
  );
}

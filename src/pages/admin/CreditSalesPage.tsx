import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCard, ReceiptText, Wallet } from 'lucide-react';
import { AdminLayout } from '../../components/AdminLayout';
import { POSLayout } from '../../components/pos';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Loading } from '../../components/ui/Loading';
import { Error as ErrorDisplay } from '../../components/ui/Error';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAuthStore } from '../../stores/auth-store';
import { useCurrency } from '../../hooks/useCurrency';
import { useToast } from '../../hooks/useToast';
import { queryKeys } from '../../lib/query-keys';
import { getErrorMessage } from '../../lib/error-utils';
import apiClient from '../../lib/api-client';

type CreditPaymentStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';

interface SalePayment {
  paymentReceiptNumber?: string;
  amount: number;
  paymentMethod: string;
  paymentReference?: string;
  receivedAt: string;
  notes?: string;
  balanceAfterPayment?: number;
}

interface CreditSale {
  _id: string;
  receiptNumber: string;
  customerName?: string;
  customerPhone?: string;
  total: number;
  amountPaid: number;
  balanceDue: number;
  paymentStatus: CreditPaymentStatus;
  dueDate?: string;
  createdAt: string;
  payments?: SalePayment[];
}

const paymentMethodOptions = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'orange_money', label: 'Orange Money' },
  { value: 'africell_money', label: 'Africell Money' },
  { value: 'qmoney', label: 'QMoney' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
];

export function CreditSalesPage() {
  const queryClient = useQueryClient();
  const { format } = useCurrency();
  const { showSuccess, showError } = useToast();
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const branchId = getBranchId(selectedBranch);
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  const isPos = location.pathname.startsWith('/pos') || user?.role === 'cashier';
  const [statusFilter, setStatusFilter] = useState<'open' | 'paid' | 'all'>('open');
  const [selectedSale, setSelectedSale] = useState<CreditSale | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');

  const params = useMemo(() => {
    const base: Record<string, string> = {
      branchId: branchId || '',
      saleType: 'credit',
      limit: '200',
    };

    if (statusFilter === 'paid') {
      base.paymentStatus = 'paid';
    }

    if (user?.role === 'cashier' && user?.id) {
      base.cashierId = user.id;
    }

    return base;
  }, [branchId, statusFilter, user?.role, user?.id]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.sales.credit(params),
    queryFn: async () => {
      const response = await apiClient.get('/sales', { params });
      const sales = (response.data?.data || []) as CreditSale[];

      if (statusFilter === 'open') {
        return sales.filter((sale) => sale.paymentStatus === 'unpaid' || sale.paymentStatus === 'partial' || sale.paymentStatus === 'overdue');
      }

      return sales;
    },
    enabled: !!branchId,
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSale) {
        throw new Error('No sale selected');
      }

      const amount = Number(paymentAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Enter a valid payment amount');
      }

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
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all(), exact: false });
      queryClient.invalidateQueries({ queryKey: queryKeys.finance.all(), exact: false });
    },
    onError: (error) => {
      showError(getErrorMessage(error, 'Failed to record payment'));
    },
  });

  const sales = data || [];
  const parsedPaymentAmount = Number(paymentAmount);
  const paymentWouldOverpay = selectedSale
    ? Number.isFinite(parsedPaymentAmount) && parsedPaymentAmount > selectedSale.balanceDue
    : false;
  const remainingAfterPayment = selectedSale && Number.isFinite(parsedPaymentAmount)
    ? Math.max(0, selectedSale.balanceDue - parsedPaymentAmount)
    : selectedSale?.balanceDue ?? 0;
  const outstandingBalance = sales
    .filter((sale) => sale.paymentStatus !== 'paid')
    .reduce((sum, sale) => sum + (sale.balanceDue || 0), 0);

  const pageContent = (
    <>
      <div className="mx-auto max-w-7xl p-4 md:p-6 space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-white">Credit Sales</h1>
            <p className="mt-2 text-sm text-gray-400">
              Track outstanding balances, record customer payments, and keep branch receivables tidy.
            </p>
            {user?.role === 'cashier' && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm text-blue-300">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                Showing only credit sales you created
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 w-full lg:max-w-[520px]">
            <div className="rounded-2xl border border-white/10 bg-primary-dark/70 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-400">Open credit sales</p>
              <p className="mt-2 text-2xl font-bold text-white">
                {sales.filter((sale) => sale.paymentStatus !== 'paid').length}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-primary-dark/70 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-400">Outstanding balance</p>
              <p className="mt-2 text-2xl font-bold text-amber-300">{format(outstandingBalance)}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-primary-dark/70 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-400">Fully paid</p>
              <p className="mt-2 text-2xl font-bold text-emerald-300">
                {sales.filter((sale) => sale.paymentStatus === 'paid').length}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { key: 'open', label: 'Open balances' },
            { key: 'paid', label: 'Paid credit sales' },
            { key: 'all', label: 'All credit sales' },
          ].map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setStatusFilter(option.key as typeof statusFilter)}
              className={`rounded-xl border px-4 py-2 text-sm transition-colors ${
                statusFilter === option.key
                  ? 'border-accent-green bg-accent-green/15 text-accent-green'
                  : 'border-white/10 bg-primary-dark/60 text-gray-300 hover:border-white/20 hover:text-white'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <Loading />
        ) : error ? (
          <ErrorDisplay message="Failed to load credit sales" />
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {sales.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-primary-dark/50 p-8 text-center text-gray-400 xl:col-span-2">
                No credit sales match this filter yet.
              </div>
            ) : (
              sales.map((sale) => {
                const statusTone =
                  sale.paymentStatus === 'paid'
                    ? 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10'
                    : sale.paymentStatus === 'partial'
                      ? 'text-amber-300 border-amber-500/30 bg-amber-500/10'
                      : 'text-rose-300 border-rose-500/30 bg-rose-500/10';

                return (
                  <div
                    key={sale._id}
                    className="rounded-2xl border border-white/10 bg-primary-dark/70 p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-lg font-semibold text-white">
                            {sale.customerName || 'Walk-in credit customer'}
                          </h2>
                          <span className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${statusTone}`}>
                            {sale.paymentStatus}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-400">{sale.receiptNumber}</p>
                        {sale.customerPhone ? (
                          <p className="mt-1 text-sm text-gray-500">{sale.customerPhone}</p>
                        ) : null}
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
                          <p className="text-gray-400">Due date</p>
                          <p className="mt-1 font-semibold text-white">
                            {sale.dueDate ? new Date(sale.dueDate).toLocaleDateString() : 'Not set'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 border-t border-white/5 pt-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                        <span className="inline-flex items-center gap-2">
                          <ReceiptText className="h-4 w-4" />
                          Created {new Date(sale.createdAt).toLocaleString()}
                        </span>
                        <span className="inline-flex items-center gap-2">
                          <Wallet className="h-4 w-4" />
                          {sale.payments?.length || 0} payment entries
                        </span>
                      </div>

                      {sale.paymentStatus !== 'paid' ? (
                        <Button
                          type="button"
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
      </div>

      <Modal
        isOpen={!!selectedSale}
        onClose={() => setSelectedSale(null)}
        title="Receive Credit Payment"
        size="md"
      >
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
                  onChange={(event) => setPaymentAmount(event.target.value)}
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
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-primary-darker px-4 py-3 text-white outline-none focus:border-accent-green"
                >
                  {paymentMethodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm text-gray-300">Reference</span>
                <input
                  value={paymentReference}
                  onChange={(event) => setPaymentReference(event.target.value)}
                  type="text"
                  className="w-full rounded-xl border border-white/10 bg-primary-darker px-4 py-3 text-white outline-none focus:border-accent-green"
                />
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm text-gray-300">Notes</span>
                <textarea
                  value={paymentNotes}
                  onChange={(event) => setPaymentNotes(event.target.value)}
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
              <Button type="button" variant="secondary" onClick={() => setSelectedSale(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => recordPaymentMutation.mutate()}
                isLoading={recordPaymentMutation.isPending}
                disabled={
                  !Number.isFinite(parsedPaymentAmount) ||
                  parsedPaymentAmount <= 0 ||
                  paymentWouldOverpay
                }
              >
                <span className="inline-flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Save Payment
                </span>
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );

  return isPos ? (
    <POSLayout title="Credit Sales">{pageContent}</POSLayout>
  ) : (
    <AdminLayout title="Credit Sales">{pageContent}</AdminLayout>
  );
}

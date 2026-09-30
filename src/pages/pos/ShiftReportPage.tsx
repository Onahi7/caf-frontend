import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api-client';
import { useCurrency } from '../../hooks/useCurrency';
import { useToast } from '../../hooks/useToast';
import { getPaymentMethodLabel } from '../../config/payment-methods';
import { queryKeys } from '../../lib/query-keys';

interface PaymentMethodTotal {
  paymentMethod: string;
  total: number;
}

interface ShiftReport {
  _id: string;
  cashierName: string;
  branchName: string;
  openedAt: string;
  closedAt: string;
  totalSales: number;
  netSales: number;
  totalCashSales: number;
  totalCardSales: number;
  totalMobileSales: number;
  paymentMethodTotals?: PaymentMethodTotal[];
  openingCash: number;
  expectedCash: number;
  closingCash: number;
  variance: number;
  salesCount: number;
  voidsCount: number;
  refundsCount: number;
  shift?: {
    _id: string;
    openedAt?: string;
    closedAt?: string;
    openingCash?: number;
    closingCash?: number;
    expectedCash?: number;
    variance?: number;
    cashierId?: string | { firstName?: string; lastName?: string; username?: string };
    branchId?: string | { name?: string };
  };
}

export const ShiftReportPage = () => {
  const { shiftId } = useParams();
  const navigate = useNavigate();
  const { format } = useCurrency();
  const { showInfo } = useToast();

  const { data: report, isLoading } = useQuery({
    queryKey: queryKeys.shifts.report(shiftId),
    queryFn: async () => {
      const response = await apiClient.get(`/shifts/${shiftId}/report`);
      const raw = response.data?.data ?? response.data;
      const shift = raw.shift ?? {};
      const cashier = shift.cashierId;
      const branch = shift.branchId;
      const cashierName =
        raw.cashierName ||
        (typeof cashier === 'object'
          ? [cashier.firstName, cashier.lastName].filter(Boolean).join(' ') || cashier.username
          : undefined) ||
        'Cashier';
      const branchName =
        raw.branchName ||
        (typeof branch === 'object' ? branch.name : undefined) ||
        'Outlet';

      return {
        ...raw,
        _id: raw._id || shift._id || shiftId,
        cashierName,
        branchName,
        openedAt: raw.openedAt || shift.openedAt,
        closedAt: raw.closedAt || shift.closedAt,
        netSales: raw.netSales ?? raw.totalSales ?? 0,
        totalCashSales: raw.totalCashSales ?? 0,
        totalCardSales: raw.totalCardSales ?? 0,
        totalMobileSales: raw.totalMobileSales ?? 0,
        openingCash: raw.openingCash ?? shift.openingCash ?? 0,
        expectedCash: raw.expectedCash ?? shift.expectedCash ?? 0,
        closingCash: raw.closingCash ?? shift.closingCash ?? 0,
        variance: raw.variance ?? shift.variance ?? 0,
        salesCount: raw.salesCount ?? 0,
        voidsCount: raw.voidsCount ?? 0,
        refundsCount: raw.refundsCount ?? 0,
      } as ShiftReport;
    },
    enabled: !!shiftId,
  });

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return 'N/A';

    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleShare = () => {
    if (!report) return;

    const text = `Shift Report Summary\n\nCashier: ${report.cashierName}\nOutlet: ${report.branchName}\nShift: ${formatDateTime(report.openedAt)} - ${formatDateTime(report.closedAt)}\n\nTotal Sales: ${format(report.totalSales)}\nNet Sales: ${format(report.netSales)}\nSales Count: ${report.salesCount}\n\nCash Reconciliation:\nExpected: ${format(report.expectedCash)}\nActual: ${format(report.closingCash)}\nVariance: ${format(report.variance)}`;

    if (navigator.share) {
      navigator
        .share({
          title: 'Shift Report',
          text,
        })
        .catch(() => {});
      return;
    }

    // Fallback: copy to clipboard
    navigator.clipboard
      ?.writeText(text)
      .then(() => {
        showInfo('Copied', 'Report copied to clipboard');
      })
      .catch(() => {});
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-primary-darker flex items-center justify-center">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-primary-darker flex items-center justify-center">
        <div className="text-gray-400">Shift not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-primary-darker flex flex-col pt-safe-top">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-gray-800">
        <button onClick={() => navigate(-1)} className="text-white min-w-11 min-h-11 flex items-center justify-center -ml-2 rounded-lg hover:bg-white/5">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-white">Shift Report Summary</h1>
        <button onClick={handleShare} className="text-white">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
        </button>
      </div>

      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* Cashier & Shift Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-400 text-sm">Cashier</p>
            <p className="text-white font-semibold">{report.cashierName}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Shift Start</p>
            <p className="text-white font-semibold">{formatDateTime(report.openedAt)}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Outlet</p>
            <p className="text-white font-semibold">{report.branchName}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Shift End</p>
            <p className="text-white font-semibold">{formatDateTime(report.closedAt)}</p>
          </div>
        </div>

        {/* Sales Summary Cards */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-primary-dark rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Total Sales</p>
            <p
              className="text-lg sm:text-2xl font-bold text-white mt-1 tabular-nums break-words leading-tight"
              title={format(report.totalSales)}
            >
              {format(report.totalSales)}
            </p>
          </div>
          <div className="bg-primary-dark rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-sm">Net Sales</p>
            <p
              className="text-lg sm:text-2xl font-bold text-white mt-1 tabular-nums break-words leading-tight"
              title={format(report.netSales)}
            >
              {format(report.netSales)}
            </p>
          </div>
        </div>

        {/* Payment Breakdown */}
        <div className="bg-primary-dark rounded-xl p-4 border border-gray-700">
          <h3 className="text-white font-semibold mb-4">Payment Breakdown</h3>
          <div className="space-y-3">
            {report.paymentMethodTotals ? (
              // New format with all payment methods
              report.paymentMethodTotals.map((pm) => (
                <div key={pm.paymentMethod} className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-accent-green/20 rounded-lg flex items-center justify-center mr-3">
                      <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <span className="text-white">{getPaymentMethodLabel(pm.paymentMethod)}</span>
                  </div>
                  <span className={`font-semibold ${pm.total > 0 ? 'text-white' : 'text-gray-500'}`}>
                    {format(pm.total)}
                  </span>
                </div>
              ))
            ) : (
              // Fallback to old format
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-accent-green/20 rounded-lg flex items-center justify-center mr-3">
                      <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <span className="text-white">Total Cash Sales</span>
                  </div>
                  <span className="text-white font-semibold">{format(report.totalCashSales)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-accent-green/20 rounded-lg flex items-center justify-center mr-3">
                      <svg className="w-4 h-4 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <span className="text-white">Total Card Sales</span>
                  </div>
                  <span className="text-white font-semibold">{format(report.totalCardSales)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Cash Reconciliation */}
        <div className="bg-primary-dark rounded-xl p-4 border border-gray-700">
          <h3 className="text-white font-semibold mb-4">Cash Reconciliation</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Expected in Drawer</span>
              <span className="text-white font-semibold">{format(report.expectedCash)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Actual Cash Counted</span>
              <span className="text-white font-semibold">{format(report.closingCash)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-700">
              <span className={report.variance === 0 ? 'text-accent-green' : report.variance > 0 ? 'text-yellow-400' : 'text-red-400'}>
                Difference
              </span>
              <span className={`font-semibold ${report.variance === 0 ? 'text-accent-green' : report.variance > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                {format(report.variance)}
              </span>
            </div>
          </div>
        </div>

        {/* View All Transactions */}
        <button
          onClick={() => navigate('/pos/transactions')}
          className="w-full bg-primary-dark rounded-xl p-4 border border-gray-700 flex items-center justify-between"
        >
          <div className="flex items-center">
            <div className="w-10 h-10 bg-accent-green/20 rounded-lg flex items-center justify-center mr-3">
              <svg className="w-5 h-5 text-accent-green" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <p className="text-white font-semibold">View All Transactions</p>
              <p className="text-gray-400 text-sm">
                Sales: {report.salesCount}, Voids: {report.voidsCount}, Refunds: {report.refundsCount}
              </p>
            </div>
          </div>
          <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Confirm Button */}
      <div className="p-4 border-t border-gray-800">
        <button
          onClick={() => navigate('/pos')}
          className="w-full py-4 bg-accent-green text-primary-dark font-semibold rounded-xl hover:bg-accent-light transition-colors"
        >
          Confirm & End Shift
        </button>
      </div>
    </div>
  );
};

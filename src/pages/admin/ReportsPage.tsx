import { useState, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '../../components/AdminLayout';
import { POSLayout } from '../../components/pos';
import { useAuthStore } from '../../stores/auth-store';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useCurrency } from '../../hooks/useCurrency';
import apiClient from '../../lib/api-client';
import { queryKeys } from '../../lib/query-keys';
import {
  TrendingUp,
  Package,
  AlertTriangle,
  Users,
  ShoppingCart,
  ArrowLeftRight,
  FileText,
  DollarSign,
  Receipt,
  BarChart3,
  Clock,
  Activity,
  ShieldCheck,
  RefreshCw,
  Printer,
  Wallet,
  Smartphone,
  CreditCard,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

interface POSSaleItem {
  productId?: string | { _id?: string; name?: string };
  productName?: string;
  quantity: number;
  unitPrice: number;
  subtotal?: number;
  packSize?: { name: string };
}

interface POSSalePayment {
  paymentMethod?: string;
  amount?: number;
}

interface POSSaleRecord {
  _id: string;
  receiptNumber?: string;
  total: number;
  subtotal?: number;
  discount?: number;
  paymentMethod?: string;
  payments?: POSSalePayment[];
  customerName?: string;
  createdAt: string;
  items?: POSSaleItem[];
}

interface ShiftData {
  _id: string;
  status: 'open' | 'closed';
  openedAt: string;
  openingCash: number;
  expectedCash?: number;
  totalSales?: number;
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash',
  orange_money: 'Orange Money',
  africell_money: 'Africell Money',
  qmoney: 'QMoney',
  card: 'Debit Card',
  bank_transfer: 'Bank Transfer',
  credit: 'Credit Sale',
  insurance: 'Insurance',
  split: 'Split Tender',
};

export function ReportsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const branchId = getBranchId(selectedBranch) || user?.branchId;
  const { format } = useCurrency();

  const isPosContext = location.pathname.startsWith('/pos') || user?.role === 'cashier';
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Fetch active shift for POS Counter Summary
  const { data: currentShift } = useQuery({
    queryKey: queryKeys.shifts.current({ branchId, cashierId: user?.id }),
    queryFn: async () => {
      if (!branchId || !user?.id) return null;
      const res = await apiClient.get('/shifts/current', {
        params: { branchId, cashierId: user.id },
      });
      return (res.data?.data ?? res.data) as ShiftData | null;
    },
    enabled: isPosContext && !!branchId && !!user?.id,
    retry: false,
  });

  // Fetch shift expenses if shift is open
  const { data: shiftExpenses = [] } = useQuery({
    queryKey: queryKeys.expenses.shift(currentShift?._id),
    queryFn: async () => {
      if (!currentShift?._id) return [];
      const res = await apiClient.get(`/expenses/shift/${currentShift._id}`);
      const payload = res.data?.data ?? res.data;
      return Array.isArray(payload) ? payload : [];
    },
    enabled: isPosContext && !!currentShift?._id && currentShift?.status === 'open',
    retry: false,
  });

  // Fetch sales for the selected date in POS context
  const {
    data: posSales = [],
    isLoading: loadingSales,
    refetch: refetchSales,
    isFetching: fetchingSales,
  } = useQuery({
    queryKey: ['pos-daily-summary-sales', branchId, selectedDate],
    queryFn: async () => {
      if (!branchId) return [] as POSSaleRecord[];
      const start = new Date(`${selectedDate}T00:00:00`);
      const end = new Date(`${selectedDate}T23:59:59.999`);
      const res = await apiClient.get('/sales', {
        params: {
          branchId,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
          limit: 500,
        },
      });
      const payload = res.data?.data ?? res.data;
      return (Array.isArray(payload) ? payload : []) as POSSaleRecord[];
    },
    enabled: isPosContext && !!branchId,
  });

  const posSummary = useMemo(() => {
    let totalRevenue = 0;
    let cashTotal = 0;
    let digitalTotal = 0;
    let creditTotal = 0;
    let creditCount = 0;

    const methodMap: Record<string, { amount: number; count: number }> = {};
    const productMap: Record<string, { name: string; qty: number; revenue: number }> = {};

    for (const sale of posSales) {
      const saleTotal = Number(sale.total) || 0;
      totalRevenue += saleTotal;

      if (sale.payments && sale.payments.length > 0 && sale.paymentMethod === 'split') {
        for (const p of sale.payments) {
          const m = p.paymentMethod || 'cash';
          const amt = Number(p.amount) || 0;
          if (!methodMap[m]) methodMap[m] = { amount: 0, count: 0 };
          methodMap[m].amount += amt;
          methodMap[m].count += 1;
          if (m === 'cash') cashTotal += amt;
          else if (m === 'credit') creditTotal += amt;
          else digitalTotal += amt;
        }
      } else {
        const m = sale.paymentMethod || 'cash';
        if (!methodMap[m]) methodMap[m] = { amount: 0, count: 0 };
        methodMap[m].amount += saleTotal;
        methodMap[m].count += 1;
        if (m === 'cash') cashTotal += saleTotal;
        else if (m === 'credit') {
          creditTotal += saleTotal;
          creditCount += 1;
        } else {
          digitalTotal += saleTotal;
        }
      }

      for (const item of sale.items || []) {
        const rawName =
          item.productName?.trim() ||
          (typeof item.productId === 'object' ? item.productId?.name : '') ||
          'Product';
        const displayName = item.packSize?.name ? `${rawName} (${item.packSize.name})` : rawName;
        const qty = Number(item.quantity) || 0;
        const lineRev = Number(item.subtotal) || qty * (Number(item.unitPrice) || 0);
        if (!productMap[displayName]) {
          productMap[displayName] = { name: displayName, qty: 0, revenue: 0 };
        }
        productMap[displayName].qty += qty;
        productMap[displayName].revenue += lineRev;
      }
    }

    const totalExpenses = shiftExpenses.reduce(
      (sum: number, exp: { amount?: number }) => sum + (Number(exp.amount) || 0),
      0,
    );
    const openingCash = Number(currentShift?.openingCash) || 0;
    const expectedDrawerCash = Math.max(0, openingCash + cashTotal - totalExpenses);

    const methodsList = Object.entries(methodMap)
      .map(([key, val]) => ({
        key,
        label: PAYMENT_LABELS[key] || key.replace('_', ' '),
        amount: val.amount,
        count: val.count,
        share: totalRevenue > 0 ? Math.round((val.amount / totalRevenue) * 100) : 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const topProducts = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    return {
      totalRevenue,
      receiptCount: posSales.length,
      cashTotal,
      digitalTotal,
      creditTotal,
      creditCount,
      openingCash,
      totalExpenses,
      expectedDrawerCash,
      methodsList,
      topProducts,
    };
  }, [posSales, shiftExpenses, currentShift]);

  const getReportUrl = (path: string) => {
    if (isPosContext && path.startsWith('/admin/reports/')) {
      return path.replace('/admin/reports/', '/pos/reports/');
    }
    return path;
  };

  // Dedicated POS Counter Summary View (Simple, fast, cashier-focused)
  if (isPosContext) {
    const todayIso = new Date().toISOString().slice(0, 10);
    const yesterdayIso = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const canViewAdmin =
      user?.role === 'super_admin' || user?.role === 'branch_manager' || user?.role === 'auditor';

    return (
      <POSLayout title="Daily Counter Summary">
        <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 border border-white/[0.08] rounded-2xl p-4 sm:p-5">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                  Counter Daily Summary
                </h1>
                {currentShift?.status === 'open' ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Shift Open
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-800 text-slate-400 border border-white/10">
                    No Active Shift
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {selectedBranch?.name || 'Pharmacy Counter'} · Quick cash, mobile money, and dispensed drugs summary
              </p>
            </div>

            {/* Date Quick Select + Refresh */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSelectedDate(todayIso)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  selectedDate === todayIso
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => setSelectedDate(yesterdayIso)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                  selectedDate === yesterdayIso
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                    : 'bg-slate-950 border-white/10 text-slate-400 hover:text-white'
                }`}
              >
                Yesterday
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-medium focus:outline-none focus:border-emerald-500"
              />
              <button
                type="button"
                onClick={() => refetchSales()}
                disabled={fetchingSales}
                className="p-2 rounded-xl bg-slate-950 hover:bg-white/5 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Refresh summary"
              >
                <RefreshCw className={`w-4 h-4 ${fetchingSales ? 'animate-spin text-emerald-400' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-white/5 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Print</span>
              </button>
            </div>
          </div>

          {/* 4 Key Counter Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Total Sales */}
            <div className="bg-slate-900/90 border border-white/[0.08] rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Counter Sales</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                  <Receipt className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-black text-white font-mono mt-2 tabular-nums">
                {loadingSales ? '…' : format(posSummary.totalRevenue)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {posSummary.receiptCount} receipt{posSummary.receiptCount === 1 ? '' : 's'} issued
              </p>
            </div>

            {/* Expected Cash in Drawer */}
            <div className="bg-slate-900/90 border border-emerald-500/25 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-emerald-300">Expected Drawer Cash</span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-black text-emerald-400 font-mono mt-2 tabular-nums">
                {loadingSales ? '…' : format(posSummary.expectedDrawerCash)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 truncate">
                Cash sales {format(posSummary.cashTotal)} + Float {format(posSummary.openingCash)}
                {posSummary.totalExpenses > 0 ? ` − Exp ${format(posSummary.totalExpenses)}` : ''}
              </p>
            </div>

            {/* Mobile Money & Card */}
            <div className="bg-slate-900/90 border border-white/[0.08] rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Mobile Money & Card</span>
                <div className="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center text-blue-400">
                  <Smartphone className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-black text-white font-mono mt-2 tabular-nums">
                {loadingSales ? '…' : format(posSummary.digitalTotal)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                Orange, Africell, QMoney, Card & Transfer
              </p>
            </div>

            {/* Credit Sales */}
            <div className="bg-slate-900/90 border border-white/[0.08] rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Credit Sales</span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center text-amber-400">
                  <CreditCard className="w-4 h-4" />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-black text-amber-300 font-mono mt-2 tabular-nums">
                {loadingSales ? '…' : format(posSummary.creditTotal)}
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                {posSummary.creditCount} credit transaction{posSummary.creditCount === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          {/* 2-Column Breakdown: Payment Methods & Top Dispensed Drugs */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Left: Payment Methods Breakdown */}
            <div className="lg:col-span-5 bg-slate-900/80 border border-white/[0.08] rounded-2xl p-4 sm:p-5 flex flex-col justify-between">
              <div>
                <h2 className="text-sm font-bold text-white mb-1">Collections by Payment Method</h2>
                <p className="text-xs text-slate-400 mb-4">Use this to verify your cash till and mobile money phones</p>

                {posSummary.methodsList.length === 0 ? (
                  <div className="py-10 text-center text-xs text-slate-500">
                    No sales recorded for {selectedDate}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {posSummary.methodsList.map((m) => (
                      <div key={m.key} className="p-3 rounded-xl bg-slate-950/70 border border-white/[0.06]">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-semibold text-slate-200 capitalize">{m.label}</span>
                          <span className="font-bold font-mono text-emerald-400">{format(m.amount)}</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.max(4, m.share)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1">
                          <span>{m.count} sale{m.count === 1 ? '' : 's'}</span>
                          <span>{m.share}% of day</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-white/[0.08] flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/pos/shifts')}
                  className="flex-1 py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Shift Reconciliations</span>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/pos/transactions')}
                  className="flex-1 py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Receipt className="w-3.5 h-3.5 text-emerald-400" />
                  <span>All Receipts</span>
                </button>
              </div>
            </div>

            {/* Right: Top Dispensed Drugs Today */}
            <div className="lg:col-span-7 bg-slate-900/80 border border-white/[0.08] rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-sm font-bold text-white">Drugs Dispensed ({selectedDate})</h2>
                  <p className="text-xs text-slate-400">Fastest moving items at the counter</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-white/[0.05] text-slate-300 text-xs font-semibold">
                  {posSummary.topProducts.length} items
                </span>
              </div>

              {posSummary.topProducts.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-500">
                  No items dispensed on this date yet
                </div>
              ) : (
                <div className="space-y-2">
                  {posSummary.topProducts.map((prod, idx) => (
                    <div
                      key={prod.name}
                      className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-white/[0.06]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-xs font-bold flex items-center justify-center shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{prod.name}</p>
                          <p className="text-[11px] text-slate-400">{prod.qty} dispensed</p>
                        </div>
                      </div>
                      <span className="text-xs font-bold font-mono text-emerald-400 shrink-0 ml-2">
                        {format(prod.revenue)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Counter Receipts */}
          {posSales.length > 0 && (
            <div className="bg-slate-900/80 border border-white/[0.08] rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-white">Recent Counter Receipts</h2>
                <Link
                  to="/pos/transactions"
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1"
                >
                  <span>View all</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {posSales.slice(0, 6).map((sale) => (
                  <button
                    key={sale._id}
                    type="button"
                    onClick={() => navigate(`/pos/receipt/${sale._id}`, { state: { sale } })}
                    className="p-3 rounded-xl bg-slate-950/70 hover:bg-slate-950 border border-white/[0.06] hover:border-emerald-500/40 text-left transition-all flex items-center justify-between gap-2 cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="text-xs font-bold text-white font-mono truncate">
                          #{sale.receiptNumber || sale._id.slice(-6)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {sale.customerName || 'Walk-in'} ·{' '}
                        {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold font-mono text-emerald-400">{format(sale.total)}</p>
                      <p className="text-[10px] text-slate-400 uppercase">{(sale.paymentMethod || 'cash').replace('_', ' ')}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Subtle Link for Managers/Admins who want Back-Office Reports */}
          {canViewAdmin && (
            <div className="flex items-center justify-between bg-slate-900/50 border border-white/[0.06] rounded-xl px-4 py-3 text-xs">
              <span className="text-slate-400">Need back-office financial, P&L, or procurement reports?</span>
              <Link
                to="/admin/reports"
                className="text-emerald-400 hover:text-emerald-300 font-semibold inline-flex items-center gap-1"
              >
                <span>Open Admin Analytics</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>
      </POSLayout>
    );
  }

  const reportModules = [
    {
      title: 'Sales Reports',
      description: 'Daily, weekly, and monthly sales analysis',
      icon: DollarSign,
      path: '/admin/reports/sales',
      color: 'bg-emerald-500/15 text-emerald-300',
      stats: 'Revenue & Profit',
      roles: ['super_admin', 'branch_manager', 'auditor', 'cashier'],
    },
    {
      title: 'Inventory Reports',
      description: 'Stock levels and movement tracking',
      icon: Package,
      path: '/admin/reports/inventory',
      color: 'bg-blue-500/15 text-blue-300',
      stats: 'Stock Analysis',
      roles: ['super_admin', 'branch_manager', 'auditor'],
    },
    {
      title: 'Expiry Reports',
      description: 'Expiring and expired product monitoring',
      icon: AlertTriangle,
      path: '/admin/reports/expiry',
      color: 'bg-rose-500/15 text-rose-300',
      stats: 'Expiry Tracking',
      roles: ['super_admin', 'branch_manager', 'auditor'],
    },
    {
      title: 'Customer Reports',
      description: 'Customer purchase patterns and loyalty',
      icon: Users,
      path: '/admin/reports/customers',
      color: 'bg-purple-500/15 text-purple-300',
      stats: 'Customer Insights',
      roles: ['super_admin', 'branch_manager', 'auditor', 'cashier'],
    },
    {
      title: 'Purchase Reports',
      description: 'Supplier orders and purchase analysis',
      icon: ShoppingCart,
      path: '/admin/reports/purchases',
      color: 'bg-indigo-500/15 text-indigo-300',
      stats: 'Procurement Insights',
      roles: ['super_admin', 'branch_manager', 'auditor'],
    },
    {
      title: 'Transfer Reports',
      description: 'Inter-branch transfer history and status',
      icon: ArrowLeftRight,
      path: '/admin/reports/transfers',
      color: 'bg-teal-500/15 text-teal-300',
      stats: 'Branch Transfers',
      roles: ['super_admin', 'branch_manager', 'auditor'],
    },
    {
      title: 'Audit Trail',
      description: 'System activities and changes log',
      icon: FileText,
      path: '/admin/audit/trail',
      color: 'bg-slate-500/15 text-slate-300',
      stats: 'Security & Compliance',
      roles: ['super_admin', 'auditor'],
    },
    {
      title: 'User Activity',
      description: 'User actions and access logs',
      icon: TrendingUp,
      path: '/admin/audit/user-activity',
      color: 'bg-indigo-500/15 text-indigo-300',
      stats: 'Activity Monitoring',
      roles: ['super_admin', 'branch_manager', 'auditor'],
    },
    {
      title: 'Profit & Loss',
      description: 'Revenue, costs, and profit margins',
      icon: BarChart3,
      path: '/admin/reports/profit-loss',
      color: 'bg-emerald-500/15 text-emerald-300',
      stats: 'P&L Statement',
      roles: ['super_admin', 'branch_manager', 'auditor', 'finance_manager'],
    },
    {
      title: 'Expense Report',
      description: 'Expense breakdown by category and period',
      icon: Receipt,
      path: '/admin/reports/expenses',
      color: 'bg-rose-500/15 text-rose-300',
      stats: 'Cost Analysis',
      roles: ['super_admin', 'branch_manager', 'auditor', 'finance_manager'],
    },
    {
      title: 'Dead Stock',
      description: 'Slow-moving and unsold inventory',
      icon: Clock,
      path: '/admin/reports/dead-stock',
      color: 'bg-amber-500/15 text-amber-300',
      stats: 'Inventory Efficiency',
      roles: ['super_admin', 'branch_manager', 'auditor'],
    },
    {
      title: 'Shift Reports',
      description: 'Cashier shift logs and cash reconciliations',
      icon: Clock,
      path: '/pos/shifts',
      color: 'bg-amber-500/15 text-amber-300',
      stats: 'Register Audits',
      roles: ['super_admin', 'branch_manager', 'cashier', 'auditor'],
    },
    {
      title: 'Stock Movements',
      description: 'Inbound and outbound stock history',
      icon: Activity,
      path: '/admin/reports/stock-movements',
      color: 'bg-cyan-500/15 text-cyan-300',
      stats: 'Movement Tracking',
      roles: ['super_admin', 'branch_manager', 'auditor'],
    },
    {
      title: 'Reconciliation',
      description: 'Financial reconciliation and variance tracking',
      icon: ShieldCheck,
      path: '/finance/reconciliations',
      color: 'bg-amber-500/15 text-amber-300',
      stats: 'Variance Tracking',
      roles: ['super_admin', 'branch_manager', 'finance_manager', 'auditor'],
    },
  ];

  const visibleReportModules = reportModules.filter((module) =>
    module.roles.includes(user?.role || ''),
  );

  return (
    <AdminLayout title="Reports">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Reports & Analytics</h1>
          <p className="mt-1.5 text-sm text-slate-400">
            Access comprehensive reports and analytics for business operations
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {visibleReportModules.map((module) => {
            const Icon = module.icon;
            return (
              <Link
                key={module.path}
                to={getReportUrl(module.path)}
                className="block group"
              >
                <div className="bg-slate-900/80 rounded-2xl shadow-xl border border-white/10 p-5 hover:border-emerald-500/50 hover:bg-slate-900 transition-all backdrop-blur-md group-hover:scale-[1.01]">
                  <div className="flex flex-col space-y-3.5">
                    <div className="flex items-start justify-between">
                      <div className={`${module.color} rounded-xl p-3 group-hover:scale-110 transition-transform shadow-md`}>
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white group-hover:text-emerald-400 transition-colors">
                        {module.title}
                      </h3>
                      <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                        {module.description}
                      </p>
                      <p className="mt-2 text-[11px] text-emerald-400/90 font-medium">
                        {module.stats}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </AdminLayout>
  );
}

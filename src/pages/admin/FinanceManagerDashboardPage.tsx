import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AdminLayout } from '../../components/AdminLayout';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAuthStore } from '../../stores/auth-store';
import { queryKeys } from '../../lib/query-keys';
import apiClient from '../../lib/api-client';
import { buildApiUrl } from '../../lib/api-utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
  CreditCard, Users, ShoppingCart, Package, Wallet, ArrowRightLeft,
  BarChart3, Activity, ChevronDown, ChevronRight,
} from 'lucide-react';
import type { UnifiedDashboard } from '../../types/finance';
import { useCurrency } from '../../hooks/useCurrency';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];
const paymentLabels: Record<string, string> = {
  cash: 'Cash', card: 'Card', credit: 'Credit', orange_money: 'Orange Money',
  africell_money: 'Africell Money', qmoney: 'QMoney', bank_transfer: 'Bank Transfer',
  mobile: 'Mobile', insurance: 'Insurance', split: 'Split',
};

type Tab = 'overview' | 'reconciliation' | 'profitloss' | 'branches';

function VarianceBar({ expected, actual, label, format }: { expected: number; actual: number; label: string; format: (amount: number) => string }) {
  const variance = expected - actual;
  const pct = expected > 0 ? Math.min((actual / expected) * 100, 120) : 0;
  const color = Math.abs(variance) < 1 ? 'bg-green-500' : variance > 0 ? 'bg-red-500' : 'bg-amber-500';
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-gray-300">{format(actual)} / {format(expected)}</span>
      </div>
      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <div className="flex justify-end mt-0.5">
        <span className={`text-xs font-medium ${Math.abs(variance) < 1 ? 'text-green-400' : variance > 0 ? 'text-red-400' : 'text-amber-400'}`}>
          {Math.abs(variance) < 1 ? 'Balanced' : variance > 0 ? `Short ${format(variance)}` : `Surplus ${format(Math.abs(variance))}`}
        </span>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">{label}</span>
        {icon}
      </div>
      <p
        className="text-base sm:text-lg lg:text-xl font-bold text-white break-words tabular-nums leading-tight"
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function CollapsibleSection({ title, icon, children, defaultOpen = true }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-6 bg-white/5 rounded-xl border border-white/10 overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition">
        <span className="flex items-center gap-2 text-lg font-semibold text-white">{icon}{title}</span>
        {open ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

export function FinanceManagerDashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const { selectedBranch } = useBranchStore();
  const user = useAuthStore((state) => state.user);
  const branchId = getBranchId(selectedBranch);
  const effectiveBranchId = user?.role === 'super_admin' ? undefined : branchId;
  const { format } = useCurrency();

  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.financeManager.dashboard(effectiveBranchId), startDate, endDate],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (effectiveBranchId) params.branchId = effectiveBranchId;
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const res = await apiClient.get(buildApiUrl('/finance-manager/unified-dashboard', params));
      return (res.data?.data ?? res.data) as UnifiedDashboard;
    },
    enabled: user?.role === 'super_admin' || !!effectiveBranchId,
  });

  if (isLoading) return <AdminLayout title="Finance Dashboard"><Loading variant="centered" text="Loading financial data..." /></AdminLayout>;
  if (error) return <AdminLayout title="Finance Dashboard"><Error message="Failed to load financial data" /></AdminLayout>;

  const d = data!;
  const pl = d.profitLoss;
  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'reconciliation', label: 'Reconciliation' },
    { key: 'profitloss', label: 'P&L' },
    { key: 'branches', label: 'Branches' },
  ];

  const sourceRevenueData = [
    { name: 'CAF', value: d.externalServices.caf.revenue },
    { name: 'EMR', value: d.externalServices.emr.revenue },
    { name: 'LAB', value: d.externalServices.lab.revenue },
  ].filter((d) => d.value > 0);

  const expensePieData = d.expenses.byCategory.map((c) => ({ name: c.category.replace('_', ' '), value: c.total }));

  const branchBarData = d.byBranch.map((b) => ({ name: b.branchName.slice(0, 12), Revenue: b.revenue, Expenses: b.expenses, Profit: b.profit }));

  return (
    <AdminLayout title="Finance Dashboard">
      {/* Top Bar: Date Filter + Tabs */}
      <div className="mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === t.key ? 'bg-accent-green text-white' : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10'}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 text-white border border-white/10 text-sm" />
          <span className="text-gray-500 text-sm">to</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 text-white border border-white/10 text-sm" />
        </div>
      </div>

      {/* === TAB: OVERVIEW === */}
      {activeTab === 'overview' && (
        <>
          {/* Source Revenue Chart + P&L Mini */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <CollapsibleSection title="Revenue by Source" icon={<BarChart3 className="w-5 h-5 text-accent-green" />}>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={sourceRevenueData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                      {sourceRevenueData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => format(Number(v))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-3 gap-3 mt-4">
                {[
                  { label: 'CAF', val: d.externalServices.caf.revenue, color: 'text-blue-400' },
                  { label: 'EMR', val: d.externalServices.emr.revenue, color: 'text-purple-400' },
                  { label: 'LAB', val: d.externalServices.lab.revenue, color: 'text-cyan-400' },
                ].map((s) => (
                  <div key={s.label} className="text-center">
                    <p className={`text-lg font-bold ${s.color}`}>{format(s.val)}</p>
                    <p className="text-xs text-gray-400">{s.label}</p>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Quick P&L" icon={<DollarSign className="w-5 h-5 text-cyan-400" />}>
              <div className="space-y-3">
                {[
                  { label: 'Gross Revenue', value: pl.grossRevenue, color: 'text-green-400' },
                  { label: 'Cost of Goods', value: pl.costOfGoods, color: 'text-red-400' },
                  { label: 'Gross Profit', value: pl.grossProfit, color: 'text-blue-400' },
                  { label: 'Operating Expenses', value: pl.operatingExpenses, color: 'text-orange-400' },
                ].map((item) => (
                  <div key={item.label} className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-sm text-gray-400">{item.label}</span>
                    <span className={`text-sm font-semibold ${item.color}`}>{format(item.value)}</span>
                  </div>
                ))}
                <div className="flex justify-between items-center py-3 bg-white/5 rounded-lg px-3">
                  <span className="text-white font-semibold">Net Profit</span>
                  <span className={`text-xl font-bold ${pl.netProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{format(pl.netProfit)}</span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-400">Margin</span>
                  <span className="text-sm font-semibold text-purple-400">{pl.margin}%</span>
                </div>
              </div>
            </CollapsibleSection>
          </div>

          {/* Top Stats Row */}
          <CollapsibleSection title="Key Metrics" icon={<Activity className="w-5 h-5 text-amber-400" />}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard label="Net Revenue" value={format(d.revenue.netRevenue)} icon={<TrendingUp className="w-4 h-4 text-green-400" />} color="bg-green-500/10 border-green-500/20" />
              <StatCard label="Total Expenses" value={format(d.expenses.totalExpenses)} icon={<TrendingDown className="w-4 h-4 text-red-400" />} color="bg-red-500/10 border-red-500/20" />
              <StatCard label="Cash Variance" value={format(d.cashPosition.totalVariance)} icon={<AlertTriangle className="w-4 h-4 text-amber-400" />} color={d.cashPosition.totalVariance === 0 ? 'bg-green-500/10 border-green-500/20' : 'bg-amber-500/10 border-amber-500/20'} />
              <StatCard label="Credit Outstanding" value={format(d.creditOutstanding.totalBalanceDue)} icon={<CreditCard className="w-4 h-4 text-orange-400" />} color="bg-orange-500/10 border-orange-500/20" />
              <StatCard label="Transactions" value={d.revenue.salesCount.toLocaleString()} icon={<ShoppingCart className="w-4 h-4 text-blue-400" />} color="bg-blue-500/10 border-blue-500/20" />
              <StatCard label="Open Shifts" value={String(d.cashPosition.openShifts)} icon={<Wallet className="w-4 h-4 text-cyan-400" />} color="bg-cyan-500/10 border-cyan-500/20" />
            </div>
          </CollapsibleSection>

          {/* Payment Methods + Credit + Marketer */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <CollapsibleSection title="Payment Methods" icon={<ArrowRightLeft className="w-5 h-5 text-cyan-400" />}>
              {d.byPaymentMethod.length === 0 ? (
                <p className="text-gray-400 text-sm">No data</p>
              ) : (
                <div className="space-y-2">
                  {d.byPaymentMethod.map((pm) => (
                    <div key={pm.method} className="flex items-center justify-between bg-white/5 rounded-lg p-2">
                      <span className="text-sm text-gray-300">{paymentLabels[pm.method] || pm.method}</span>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-white">{format(pm.total)}</span>
                        <span className="text-xs text-gray-500 ml-2">{pm.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleSection>

            <CollapsibleSection title="Credit Outstanding" icon={<CreditCard className="w-5 h-5 text-amber-400" />}>
              <div className="space-y-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Total Credit Sales</p>
                  <p className="text-lg font-bold text-white">{format(d.creditOutstanding.totalCreditSales)}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Balance Due</p>
                  <p className="text-lg font-bold text-amber-400">{format(d.creditOutstanding.totalBalanceDue)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-gray-400">Overdue</p>
                    <p className="text-lg font-bold text-red-400">{d.creditOutstanding.overdueCount}</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3">
                    <p className="text-xs text-gray-400">Overdue Amt</p>
                    <p className="text-lg font-bold text-red-400">{format(d.creditOutstanding.overdueAmount)}</p>
                  </div>
                </div>
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Marketer Activity" icon={<Users className="w-5 h-5 text-purple-400" />}>
              <div className="space-y-3">
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Assigned Value</p>
                  <p className="text-lg font-bold text-white">{format(d.marketer.totalAssignedValue)}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Sold Value</p>
                  <p className="text-lg font-bold text-green-400">{format(d.marketer.totalSoldValue)}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3">
                  <p className="text-xs text-gray-400">Outstanding</p>
                  <p className="text-lg font-bold text-amber-400">{format(d.marketer.totalOutstanding)}</p>
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Units: {d.marketer.unitsSold}/{d.marketer.unitsAssigned} sold</span>
                  <span>{d.marketer.unitsRemaining} remaining</span>
                </div>
              </div>
            </CollapsibleSection>
          </div>
        </>
      )}

      {/* === TAB: RECONCILIATION === */}
      {activeTab === 'reconciliation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {[
              { label: 'CAF (Pharmacy)', source: d.externalServices.caf, accent: 'text-blue-400', border: 'border-blue-500/30' },
              { label: 'EMR (Medical)', source: d.externalServices.emr, accent: 'text-purple-400', border: 'border-purple-500/30' },
              { label: 'LAB (Laboratory)', source: d.externalServices.lab, accent: 'text-cyan-400', border: 'border-cyan-500/30' },
            ].map((s) => {
              const r = s.source.reconciliation;
              const hasRecon = r && r.submitted;
              return (
                <div key={s.label} className={`rounded-xl border p-5 ${s.border} bg-white/5`}>
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-base font-semibold ${s.accent}`}>{s.label}</span>
                    {hasRecon ? (
                      <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                        r.status === 'approved' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        r.status === 'rejected' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                        r.status === 'balanced' ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>{r.status}</span>
                    ) : (
                      <span className="px-3 py-1 rounded-full text-xs font-medium border bg-gray-500/10 text-gray-400 border-gray-500/20">not submitted</span>
                    )}
                  </div>

                  {!hasRecon ? (
                    <p className="text-sm text-gray-500 italic">No reconciliation submitted today</p>
                  ) : (
                    <div className="space-y-4">
                      <VarianceBar expected={r.netExpected.cash} actual={r.actual.cash} label="Cash" format={format} />
                      <VarianceBar expected={r.netExpected.orangeMoney} actual={r.actual.orangeMoney} label="Orange Money" format={format} />
                      <VarianceBar expected={r.netExpected.afrimoney} actual={r.actual.afrimoney} label="Africell Money" format={format} />

                      <div className="border-t border-white/10 pt-3 mt-3">
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Income</span>
                          <span className="text-green-400">{format(r.income.total)}</span>
                        </div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Expenditures</span>
                          <span className="text-red-400">{format(r.expenditures.total)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-semibold border-t border-white/10 pt-2 mt-2">
                          <span className="text-gray-400">Net Expected</span>
                          <span className="text-white">{format(r.netExpected.total)}</span>
                        </div>
                        <div className="flex justify-between text-base font-bold mt-2">
                          <span className="text-gray-400">Total Variance</span>
                          <span className={r.variance.total === 0 ? 'text-green-400' : 'text-red-400'}>
                            {r.variance.total === 0 ? 'Balanced' : r.variance.total > 0 ? `Short ${format(r.variance.total)}` : `Surplus ${format(Math.abs(r.variance.total))}`}
                          </span>
                        </div>
                      </div>

                      {r.submittedBy && <p className="text-xs text-gray-500 mt-2">Submitted by {r.submittedBy}</p>}
                      {r.notes && <p className="text-xs text-gray-500 italic">"{r.notes}"</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* === TAB: P&L === */}
      {activeTab === 'profitloss' && (
        <div className="space-y-6">
          <CollapsibleSection title="Profit & Loss Statement" icon={<BarChart3 className="w-5 h-5 text-accent-green" />}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard label="Gross Revenue" value={format(pl.grossRevenue)} icon={<TrendingUp className="w-4 h-4 text-green-400" />} color="bg-green-500/10 border-green-500/20" />
              <StatCard label="Cost of Goods" value={format(pl.costOfGoods)} icon={<Package className="w-4 h-4 text-red-400" />} color="bg-red-500/10 border-red-500/20" />
              <StatCard label="Gross Profit" value={format(pl.grossProfit)} icon={<DollarSign className="w-4 h-4 text-blue-400" />} color="bg-blue-500/10 border-blue-500/20" />
              <StatCard label="Op. Expenses" value={format(pl.operatingExpenses)} icon={<TrendingDown className="w-4 h-4 text-orange-400" />} color="bg-orange-500/10 border-orange-500/20" />
              <StatCard label="Net Profit" value={format(pl.netProfit)} icon={<Wallet className="w-4 h-4 text-cyan-400" />} color={pl.netProfit >= 0 ? 'bg-cyan-500/10 border-cyan-500/20' : 'bg-red-500/10 border-red-500/20'} />
              <StatCard label="Margin" value={`${pl.margin}%`} icon={<Activity className="w-4 h-4 text-purple-400" />} color="bg-purple-500/10 border-purple-500/20" />
            </div>
          </CollapsibleSection>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CollapsibleSection title="Expenses by Category" icon={<TrendingDown className="w-5 h-5 text-red-400" />}>
              {expensePieData.length === 0 ? (
                <p className="text-gray-400 text-sm">No expenses</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={expensePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                        {expensePieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => format(Number(v))} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="mt-3 space-y-1">
                {d.expenses.byCategory.map((c) => (
                  <div key={c.category} className="flex justify-between text-sm py-1">
                    <span className="text-gray-400 capitalize">{c.category.replace('_', ' ')}</span>
                    <span className="text-red-400">{format(c.total)}</span>
                  </div>
                ))}
              </div>
            </CollapsibleSection>

            <CollapsibleSection title="Purchases" icon={<Package className="w-5 h-5 text-blue-400" />}>
              <div className="space-y-3">
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                  <span className="text-xs text-gray-400">Total PO Value</span>
                  <p className="text-xl font-bold text-white mt-1">{format(d.purchases.totalPurchaseValue)}</p>
                </div>
                <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                  <span className="text-xs text-gray-400">Received Value</span>
                  <p className="text-xl font-bold text-white mt-1">{format(d.purchases.receivedValue)}</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4">
                  <span className="text-xs text-gray-400">Pending Delivery</span>
                  <p className="text-xl font-bold text-white mt-1">{format(d.purchases.pendingValue)}</p>
                </div>
              </div>
            </CollapsibleSection>
          </div>
        </div>
      )}

      {/* === TAB: BRANCHES === */}
      {activeTab === 'branches' && (
        <div className="space-y-6">
          {branchBarData.length > 0 && (
            <CollapsibleSection title="Revenue vs Expenses by Branch" icon={<BarChart3 className="w-5 h-5 text-blue-400" />}>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={branchBarData}>
                    <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                    <Tooltip formatter={(v: any) => format(Number(v))} contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                    <Legend />
                    <Bar dataKey="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="Profit" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CollapsibleSection>
          )}

          <CollapsibleSection title="Branch Performance Table" icon={<ShoppingCart className="w-5 h-5 text-green-400" />}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-gray-400 px-4 py-3 font-medium">Branch</th>
                    <th className="text-right text-gray-400 px-4 py-3 font-medium">Revenue</th>
                    <th className="text-right text-gray-400 px-4 py-3 font-medium">Expenses</th>
                    <th className="text-right text-gray-400 px-4 py-3 font-medium">Profit</th>
                    <th className="text-right text-gray-400 px-4 py-3 font-medium">Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {d.byBranch.map((b) => (
                    <tr key={b.branchId} className="border-b border-white/5 hover:bg-white/5">
                      <td className="px-4 py-3 text-white font-medium">{b.branchName}</td>
                      <td className="px-4 py-3 text-right text-green-400">{format(b.revenue)}</td>
                      <td className="px-4 py-3 text-right text-red-400">{format(b.expenses)}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${b.profit >= 0 ? 'text-cyan-400' : 'text-red-400'}`}>{format(b.profit)}</td>
                      <td className="px-4 py-3 text-right text-gray-300">{b.salesCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        </div>
      )}
    </AdminLayout>
  );
}

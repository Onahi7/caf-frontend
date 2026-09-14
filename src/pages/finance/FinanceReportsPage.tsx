import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FinanceLayout } from '../../components/FinanceLayout';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAuthStore } from '../../stores/auth-store';
import { queryKeys } from '../../lib/query-keys';
import apiClient from '../../lib/api-client';
import { buildApiUrl } from '../../lib/api-utils';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  DollarSign, TrendingUp, TrendingDown, AlertTriangle, CreditCard, ShoppingCart, Wallet, Activity, BarChart3, Package,
} from 'lucide-react';
import type { UnifiedDashboard } from '../../types/finance';
import { useCurrency } from '../../hooks/useCurrency';

const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#14b8a6'];
const paymentLabels: Record<string, string> = {
  cash: 'Cash', card: 'Card', credit: 'Credit', orange_money: 'Orange Money',
  africell_money: 'Africell Money', qmoney: 'QMoney', bank_transfer: 'Bank Transfer',
  mobile: 'Mobile', insurance: 'Insurance', split: 'Split',
};

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  return (
    <div className={`rounded-xl border p-4 ${color}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-gray-400">{label}</span>
        {icon}
      </div>
      <p className="text-xl font-bold text-white">{value}</p>
    </div>
  );
}

export function FinanceReportsPage() {
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const { selectedBranch } = useBranchStore();
  const user = useAuthStore((state) => state.user);
  const branchId = getBranchId(selectedBranch);
  const effectiveBranchId = user?.role === 'super_admin' ? undefined : branchId;
  const { format } = useCurrency();

  const { data, isLoading, error } = useQuery({
    queryKey: [...queryKeys.financeManager.dashboard(effectiveBranchId), startDate, endDate],
    queryFn: async () => {
      const params: Record<string, string> = { startDate, endDate };
      if (effectiveBranchId) params.branchId = effectiveBranchId;
      const res = await apiClient.get(buildApiUrl('/finance-manager/unified-dashboard', params));
      return (res.data?.data ?? res.data) as UnifiedDashboard;
    },
    enabled: user?.role === 'super_admin' || !!effectiveBranchId,
  });

  if (isLoading) {
    return <FinanceLayout title="Finance Reports"><Loading variant="centered" text="Loading..." /></FinanceLayout>;
  }
  if (error || !data) {
    return <FinanceLayout title="Finance Reports"><Error message="Failed to load" /></FinanceLayout>;
  }

  const d = data;
  const pl = d.profitLoss;
  const sourceRevenueData = [
    { name: 'CAF', value: d.externalServices.caf.revenue },
    { name: 'EMR', value: d.externalServices.emr.revenue },
    { name: 'LAB', value: d.externalServices.lab.revenue },
  ].filter((x) => x.value > 0);
  const expensePieData = d.expenses.byCategory.map((c) => ({ name: c.category.replace('_', ' '), value: c.total }));
  const branchBarData = d.byBranch.map((b) => ({ name: b.branchName.slice(0, 12), Revenue: b.revenue, Expenses: b.expenses, Profit: b.profit }));

  return (
    <FinanceLayout title="Finance Reports">
      <div className="mb-6 flex items-center justify-end gap-2">
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-white/5 text-white border border-white/10 text-sm" />
        <span className="text-gray-500 text-sm">to</span>
        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-white/5 text-white border border-white/10 text-sm" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard label="Net Revenue" value={format(d.revenue.netRevenue)} icon={<TrendingUp className="w-4 h-4 text-green-400" />} color="bg-green-500/10 border-green-500/20" />
        <StatCard label="Total Expenses" value={format(d.expenses.totalExpenses)} icon={<TrendingDown className="w-4 h-4 text-red-400" />} color="bg-red-500/10 border-red-500/20" />
        <StatCard label="Cash Variance" value={format(d.cashPosition.totalVariance)} icon={<AlertTriangle className="w-4 h-4 text-amber-400" />} color={d.cashPosition.totalVariance === 0 ? 'bg-green-500/10 border-green-500/20' : 'bg-amber-500/10 border-amber-500/20'} />
        <StatCard label="Credit Outstanding" value={format(d.creditOutstanding.totalBalanceDue)} icon={<CreditCard className="w-4 h-4 text-orange-400" />} color="bg-orange-500/10 border-orange-500/20" />
        <StatCard label="Transactions" value={d.revenue.salesCount.toLocaleString()} icon={<ShoppingCart className="w-4 h-4 text-blue-400" />} color="bg-blue-500/10 border-blue-500/20" />
        <StatCard label="Open Shifts" value={String(d.cashPosition.openShifts)} icon={<Wallet className="w-4 h-4 text-cyan-400" />} color="bg-cyan-500/10 border-cyan-500/20" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white/5 rounded-xl border border-white/10 p-5">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent-green" /> Revenue by Source
          </h3>
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
        </div>

        <div className="bg-white/5 rounded-xl border border-white/10 p-5">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-cyan-400" /> Quick P&L
          </h3>
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white/5 rounded-xl border border-white/10 p-5">
          <h3 className="text-lg font-semibold text-white mb-3">Expenses by Category</h3>
          {expensePieData.length === 0 ? (
            <p className="text-gray-400 text-sm">No expenses</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={expensePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                    {expensePieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => format(Number(v))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white/5 rounded-xl border border-white/10 p-5">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Activity className="w-5 h-5 text-amber-400" /> Marketer Activity
          </h3>
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
          </div>
        </div>
      </div>

      {branchBarData.length > 0 ? (
        <div className="bg-white/5 rounded-xl border border-white/10 p-5">
          <h3 className="text-lg font-semibold text-white mb-3">Revenue vs Expenses by Branch</h3>
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
        </div>
      ) : null}

      <div className="bg-white/5 rounded-xl border border-white/10 p-5 mt-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400" /> Reconciliation Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { key: 'caf', label: 'CAF', data: d.externalServices.caf.reconciliation },
            { key: 'emr', label: 'EMR', data: d.externalServices.emr.reconciliation },
            { key: 'lab', label: 'LAB', data: d.externalServices.lab.reconciliation },
          ].map((source) => (
            <div key={source.key} className="bg-white/5 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-white">{source.label}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  source.data?.status === 'balanced' ? 'bg-green-500/20 text-green-400' :
                  source.data?.status === 'variance' ? 'bg-red-500/20 text-red-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {source.data?.status || 'Not Submitted'}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Net Expected</span>
                  <span className="text-white">{format(source.data?.netExpected?.total || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Actual</span>
                  <span className="text-white">{format(source.data?.actual?.total || 0)}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-2">
                  <span className="text-gray-400">Variance</span>
                  <span className={source.data?.variance?.total === 0 ? 'text-green-400' : 'text-red-400 font-semibold'}>
                    {format(source.data?.variance?.total || 0)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </FinanceLayout>
  );
}

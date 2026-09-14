import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { Select } from '../../components/ui/Select';
import { useCurrency } from '../../hooks/useCurrency';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAuthStore } from '../../stores/auth-store';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { SaveReportButton } from '../../components/finance/SaveReportButton';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

interface Branch {
  _id: string;
  name: string;
}

interface ProfitLossData {
  revenue: { totalSales: number; totalCollected: number; totalDiscount: number; transactionCount: number };
  cogs: { totalCOGS: number; itemsSold: number };
  grossProfit: number;
  grossProfitMargin: number;
  expenses: { totalExpenses: number; byCategory: Record<string, number>; expenseCount: number };
  operatingProfit: number;
  operatingProfitMargin: number;
  currencyCode: string;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

export function ProfitLossReportPage() {
  const { format } = useCurrency();
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const selectedBranchId = getBranchId(selectedBranch);
  const [filterBranchId, setFilterBranchId] = useState('');
  const effectiveBranchId = isSuperAdmin ? filterBranchId : selectedBranchId;
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.reports.profitLoss({ branchId: effectiveBranchId, from, to }),
    queryFn: async () => {
      const response = await apiClient.get(
        buildApiUrl('/reports/profit-loss', {
          branchId: effectiveBranchId || undefined,
          from,
          to,
        }),
      );
      return response.data as ProfitLossData;
    },
    enabled: isSuperAdmin || !!selectedBranchId,
  });

  const { data: branches } = useQuery({
    queryKey: queryKeys.branches.list(),
    queryFn: async () => {
      const response = await apiClient.get('/branches');
      return (Array.isArray(response.data) ? response.data : response.data?.data || []) as Branch[];
    },
    enabled: isSuperAdmin,
  });

  const handleExport = async () => {
    try {
      const response = await apiClient.get(
        buildApiUrl('/reports/profit-loss/export', {
          branchId: effectiveBranchId || undefined,
          from,
          to,
        }),
        { responseType: 'blob' },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `profit-loss-report-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const expenseChartData = data?.expenses?.byCategory
    ? Object.entries(data.expenses.byCategory).map(([name, value]) => ({ name, value }))
    : [];

  const marginChartData = data
    ? [
        { name: 'Revenue', value: data.revenue.totalSales, fill: '#22c55e' },
        { name: 'COGS', value: data.cogs.totalCOGS, fill: '#f97316' },
        { name: 'Gross Profit', value: Math.max(0, data.grossProfit), fill: '#3b82f6' },
        { name: 'Expenses', value: data.expenses.totalExpenses, fill: '#ef4444' },
        { name: 'Operating Profit', value: Math.max(0, data.operatingProfit), fill: '#8b5cf6' },
      ]
    : [];

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto py-6 px-4">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-white">Profit & Loss Report</h1>
          <div className="flex items-center gap-2">
            <SaveReportButton
              reportKey="profit-loss"
              route="/admin/reports/profit-loss"
              params={{ branchId: filterBranchId || undefined, from, to }}
              defaultName="Profit & Loss Report"
            />
            <Button variant="secondary" onClick={handleExport} disabled={!data}>
              Export CSV
            </Button>
          </div>
        </div>

        <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5 p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            {isSuperAdmin && (
              <div className="flex-1">
                <Select label="Branch" value={filterBranchId} onChange={(e) => setFilterBranchId(e.target.value)}>
                  <option value="">All Branches</option>
                  {branches?.map((b) => (
                    <option key={b._id} value={b._id}>{b.name}</option>
                  ))}
                </Select>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">From</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="bg-white/5 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">To</label>
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="bg-white/5 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <Button variant="primary" onClick={() => refetch()}>Apply</Button>
          </div>
        </div>

        {isLoading && <Loading />}
        {error && <Error message="Failed to load P&L report" onRetry={() => refetch()} />}

        {data && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-green-500/10 p-4 rounded-xl border border-green-500/20">
                <p className="text-sm text-green-200">Revenue</p>
                <p className="text-2xl font-bold text-green-400">{format(data.revenue.totalSales)}</p>
                <p className="text-xs text-gray-400">{data.revenue.transactionCount} transactions</p>
              </div>
              <div className="bg-orange-500/10 p-4 rounded-xl border border-orange-500/20">
                <p className="text-sm text-orange-200">COGS</p>
                <p className="text-2xl font-bold text-orange-400">{format(data.cogs.totalCOGS)}</p>
                <p className="text-xs text-gray-400">{data.cogs.itemsSold} items sold</p>
              </div>
              <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
                <p className="text-sm text-blue-200">Gross Profit</p>
                <p className="text-2xl font-bold text-blue-400">{format(data.grossProfit)}</p>
                <p className="text-xs text-gray-400">{data.grossProfitMargin.toFixed(1)}% margin</p>
              </div>
              <div className="bg-purple-500/10 p-4 rounded-xl border border-purple-500/20">
                <p className="text-sm text-purple-200">Operating Profit</p>
                <p className="text-2xl font-bold text-purple-400">{format(data.operatingProfit)}</p>
                <p className="text-xs text-gray-400">{data.operatingProfitMargin.toFixed(1)}% margin</p>
              </div>
            </div>

            {/* P&L Table */}
            <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Profit & Loss Statement</h2>
              <div className="space-y-2">
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-gray-300 font-medium">Revenue</span>
                  <span className="text-green-400 font-semibold">{format(data.revenue.totalSales)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/10 pl-4">
                  <span className="text-gray-400">Collected</span>
                  <span className="text-gray-300">{format(data.revenue.totalCollected)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/10 pl-4">
                  <span className="text-gray-400">Discounts</span>
                  <span className="text-red-400">-{format(data.revenue.totalDiscount)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-gray-300 font-medium">Cost of Goods Sold</span>
                  <span className="text-orange-400 font-semibold">{format(data.cogs.totalCOGS)}</span>
                </div>
                <div className="flex justify-between py-3 border-b border-white/20 bg-blue-500/5 px-2 rounded">
                  <span className="text-blue-300 font-bold">Gross Profit</span>
                  <span className="text-blue-400 font-bold">{format(data.grossProfit)} ({data.grossProfitMargin.toFixed(1)}%)</span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-gray-300 font-medium">Operating Expenses</span>
                  <span className="text-red-400 font-semibold">{format(data.expenses.totalExpenses)}</span>
                </div>
                {expenseChartData.map((cat) => (
                  <div key={cat.name} className="flex justify-between py-1 border-b border-white/5 pl-4">
                    <span className="text-gray-400 text-sm capitalize">{cat.name.replace(/_/g, ' ').toLowerCase()}</span>
                    <span className="text-gray-400 text-sm">{format(cat.value)}</span>
                  </div>
                ))}
                <div className="flex justify-between py-3 bg-purple-500/5 px-2 rounded mt-2">
                  <span className="text-purple-300 font-bold">Operating Profit</span>
                  <span className="text-purple-400 font-bold">{format(data.operatingProfit)} ({data.operatingProfitMargin.toFixed(1)}%)</span>
                </div>
              </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5 p-6">
                <h2 className="text-lg font-semibold text-white mb-4">Revenue vs Costs</h2>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={marginChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" stroke="#9ca3af" tick={{ fontSize: 12 }} />
                    <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                      labelStyle={{ color: '#f3f4f6' }}
                      formatter={(value: any) => [format(Number(value) || 0), '']}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {marginChartData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {expenseChartData.length > 0 && (
                <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5 p-6">
                  <h2 className="text-lg font-semibold text-white mb-4">Expenses by Category</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={expenseChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }: any) => `${(name || '').replace(/_/g, ' ').toLowerCase()} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                        outerRadius={100}
                        dataKey="value"
                      >
                        {expenseChartData.map((_, index) => (
                          <Cell key={index} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                        formatter={(value: any) => [format(Number(value) || 0), 'Amount']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

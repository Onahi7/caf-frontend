import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api-client';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
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
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

interface Branch {
  _id: string;
  name: string;
}

interface ExpenseByCategory {
  category: string;
  total: number;
  count: number;
  percentage: number;
}

interface ExpenseByPeriod {
  period: string;
  total: number;
  count: number;
}

interface TopExpense {
  description: string;
  amount: number;
  category: string;
  date: string;
}

interface ExpenseReportData {
  summary: { totalExpenses: number; totalCount: number; averageExpense: number };
  byCategory: ExpenseByCategory[];
  byPeriod: ExpenseByPeriod[];
  topExpenses: TopExpense[];
  currencyCode: string;
}

const GROUP_OPTIONS = [
  { label: 'By Category', value: 'category' },
  { label: 'By Day', value: 'day' },
  { label: 'By Week', value: 'week' },
  { label: 'By Month', value: 'month' },
];

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];

export function ExpenseReportPage() {
  const { format } = useCurrency();
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const selectedBranchId = getBranchId(selectedBranch);
  const [filterBranchId, setFilterBranchId] = useState('');
  const effectiveBranchId = isSuperAdmin ? filterBranchId : selectedBranchId;
  const [groupBy, setGroupBy] = useState('category');
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3);
    return d.toISOString().split('T')[0];
  });
  const [to, setTo] = useState(() => new Date().toISOString().split('T')[0]);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.reports.expenses({ branchId: effectiveBranchId, from, to, groupBy }),
    queryFn: async () => {
      const response = await apiClient.get(
        buildApiUrl('/reports/expenses', {
          branchId: effectiveBranchId || undefined,
          from,
          to,
          groupBy,
        }),
      );
      return response.data as ExpenseReportData;
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
        buildApiUrl('/reports/expenses/export', {
          branchId: effectiveBranchId || undefined,
          from,
          to,
          groupBy,
        }),
        { responseType: 'blob' },
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `expense-report-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const categoryColumns = [
    {
      key: 'category',
      header: 'Category',
      render: (item: ExpenseByCategory) => (
        <span className="text-white capitalize">{item.category.replace(/_/g, ' ').toLowerCase()}</span>
      ),
    },
    { key: 'count', header: 'Count' },
    {
      key: 'total',
      header: 'Total',
      render: (item: ExpenseByCategory) => <span className="text-red-400 font-semibold">{format(item.total)}</span>,
    },
    {
      key: 'percentage',
      header: '%',
      render: (item: ExpenseByCategory) => <span className="text-gray-400">{item.percentage.toFixed(1)}%</span>,
    },
  ];

  const periodColumns = [
    { key: 'period', header: 'Period' },
    { key: 'count', header: 'Count' },
    {
      key: 'total',
      header: 'Total',
      render: (item: ExpenseByPeriod) => <span className="text-red-400 font-semibold">{format(item.total)}</span>,
    },
  ];

  const topColumns = [
    { key: 'description', header: 'Description' },
    {
      key: 'category',
      header: 'Category',
      render: (item: TopExpense) => (
        <span className="capitalize">{item.category.replace(/_/g, ' ').toLowerCase()}</span>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      render: (item: TopExpense) => new Date(item.date).toLocaleDateString(),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (item: TopExpense) => <span className="text-red-400 font-semibold">{format(item.amount)}</span>,
    },
  ];

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto py-6 px-4">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold text-white">Expense Report</h1>
          <div className="flex items-center gap-2">
            <SaveReportButton
              reportKey="expenses"
              route="/admin/reports/expenses"
              params={{ branchId: filterBranchId || undefined, from, to, groupBy }}
              defaultName="Expense Report"
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
              <label className="block text-sm font-medium text-gray-300 mb-1">Group By</label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value)}
                className="bg-white/5 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm"
              >
                {GROUP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
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
        {error && <Error message="Failed to load expense report" onRetry={() => refetch()} />}

        {data && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                <p className="text-sm text-red-200">Total Expenses</p>
                <p className="text-2xl font-bold text-red-400">{format(data.summary.totalExpenses)}</p>
              </div>
              <div className="bg-orange-500/10 p-4 rounded-xl border border-orange-500/20">
                <p className="text-sm text-orange-200">Transactions</p>
                <p className="text-2xl font-bold text-orange-400">{data.summary.totalCount}</p>
              </div>
              <div className="bg-yellow-500/10 p-4 rounded-xl border border-yellow-500/20">
                <p className="text-sm text-yellow-200">Average Expense</p>
                <p className="text-2xl font-bold text-yellow-400">{format(data.summary.averageExpense)}</p>
              </div>
            </div>

            {/* Category Breakdown Chart */}
            {data.byCategory && data.byCategory.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5 p-6">
                  <h2 className="text-lg font-semibold text-white mb-4">Expenses by Category</h2>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={data.byCategory}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ category, percentage }: any) =>
                          `${(category || '').replace(/_/g, ' ').toLowerCase()} (${(percentage ?? 0).toFixed(0)}%)`
                        }
                        outerRadius={100}
                        dataKey="total"
                        nameKey="category"
                      >
                        {data.byCategory.map((_, index) => (
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

                <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5 p-6">
                  <h2 className="text-lg font-semibold text-white mb-4">Expenses by Period</h2>
                  {data.byPeriod && data.byPeriod.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={data.byPeriod}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="period" stroke="#9ca3af" tick={{ fontSize: 11 }} />
                        <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                          formatter={(value: any) => [format(Number(value) || 0), 'Total']}
                        />
                        <Bar dataKey="total" fill="#ef4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-gray-400 text-center py-12">No period data available</p>
                  )}
                </div>
              </div>
            )}

            {/* Tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {data.byCategory && data.byCategory.length > 0 && (
                <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5">
                  <div className="px-6 py-4 border-b border-white/5">
                    <h2 className="text-lg font-semibold text-white">By Category</h2>
                  </div>
                  <Table data={data.byCategory} columns={categoryColumns} />
                </div>
              )}

              {groupBy !== 'category' && data.byPeriod && data.byPeriod.length > 0 && (
                <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5">
                  <div className="px-6 py-4 border-b border-white/5">
                    <h2 className="text-lg font-semibold text-white">By Period</h2>
                  </div>
                  <Table data={data.byPeriod} columns={periodColumns} />
                </div>
              )}
            </div>

            {data.topExpenses && data.topExpenses.length > 0 && (
              <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5">
                <div className="px-6 py-4 border-b border-white/5">
                  <h2 className="text-lg font-semibold text-white">Top 10 Expenses</h2>
                </div>
                <Table data={data.topExpenses} columns={topColumns} />
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

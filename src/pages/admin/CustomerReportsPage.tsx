import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api-client';
import { unwrapResponse } from '../../lib/unwrap-response';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { useCurrency } from '../../hooks/useCurrency';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { SaveReportButton } from '../../components/finance/SaveReportButton';
import { useAuthStore } from '../../stores/auth-store';
import { getBranchId, useBranchStore } from '../../stores/branch-store';

interface CustomerReportData {
  totalCustomers: number;
  activeCustomers: number;
  newCustomers: number;
  totalLoyaltyPoints: number;
  topCustomers: Array<{
    customerId: string;
    customerName: string;
    totalPurchases: number;
    purchaseCount: number;
    loyaltyPoints: number;
  }>;
  byPeriod: Array<{
    date: string;
    newCustomers: number;
    totalPurchases: number;
  }>;
  segmentation: {
    highValue: number;
    medium: number;
    low: number;
    inactive: number;
  };
}

export const CustomerReportsPage = () => {
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const { format } = useCurrency();
  const user = useAuthStore((state) => state.user);
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const isSuperAdmin = user?.role === 'super_admin';
  const effectiveBranchId = isSuperAdmin ? undefined : getBranchId(selectedBranch) || user?.branchId;

  // Fetch customer reports
  const { data: reportData, isLoading, error } = useQuery({
    queryKey: queryKeys.reports.customer({
      branchId: effectiveBranchId,
      startDate: dateFrom,
      endDate: dateTo,
      groupBy,
    }),
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl('/reports/customers', {
        branchId: effectiveBranchId,
        from: dateFrom,
        to: dateTo,
        groupBy,
      }));
      return unwrapResponse(response.data, {} as CustomerReportData);
    },
    enabled: !!dateFrom && !!dateTo && (isSuperAdmin || !!effectiveBranchId),
  });

  const handleExport = async () => {
    try {
      const response = await apiClient.get(buildApiUrl('/reports/customers/export', {
        from: dateFrom,
        to: dateTo,
        groupBy,
        format: 'csv',
        branchId: effectiveBranchId,
      }), {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `customer-report-${dateFrom}-${dateTo}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  if (isLoading) return <AdminLayout><Loading /></AdminLayout>;
  if (error) return <AdminLayout><Error message="Failed to load customer reports" /></AdminLayout>;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Customer Reports</h1>
          <div className="flex items-center gap-2">
            <SaveReportButton
              reportKey="customers"
              route="/admin/reports/customers"
              params={{ branchId: effectiveBranchId, dateFrom, dateTo }}
              defaultName="Customer Report"
            />
            <Button onClick={handleExport}>
              Export to CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-primary-dark/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="From Date"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
            <Input
              label="To Date"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
            <Select
              label="Group By"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as 'day' | 'week' | 'month')}
            >
              <option value="day" className="bg-primary-dark text-white">Daily</option>
              <option value="week" className="bg-primary-dark text-white">Weekly</option>
              <option value="month" className="bg-primary-dark text-white">Monthly</option>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        {reportData && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-primary-dark/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/5">
                <p className="text-sm text-gray-500">Total Customers</p>
                <p className="text-3xl font-bold text-white">{reportData.totalCustomers}</p>
              </div>
              <div className="bg-primary-dark/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/5">
                <p className="text-sm text-gray-500">Active Customers</p>
                <p className="text-3xl font-bold text-green-600">{reportData.activeCustomers}</p>
              </div>
              <div className="bg-primary-dark/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/5">
                <p className="text-sm text-gray-500">New Customers</p>
                <p className="text-3xl font-bold text-blue-600">{reportData.newCustomers}</p>
              </div>
              <div className="bg-primary-dark/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/5">
                <p className="text-sm text-gray-500">Total Loyalty Points</p>
                <p className="text-3xl font-bold text-purple-600">{reportData.totalLoyaltyPoints}</p>
              </div>
            </div>

            {/* Customer Segmentation */}
            <div className="bg-primary-dark/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/5">
              <h2 className="text-xl font-bold text-white mb-4">Customer Segmentation</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                  <p className="text-sm text-green-100">High Value</p>
                  <p className="text-2xl font-bold text-green-600">{reportData.segmentation.highValue}</p>
                  <p className="text-xs text-gray-400">{'>'} 10 purchases</p>
                </div>
                <div className="text-center p-4 bg-blue-500/10 rounded-lg border border-blue-500/20">
                  <p className="text-sm text-blue-100">Medium</p>
                  <p className="text-2xl font-bold text-blue-600">{reportData.segmentation.medium}</p>
                  <p className="text-xs text-gray-400">5-10 purchases</p>
                </div>
                <div className="text-center p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                  <p className="text-sm text-yellow-100">Low</p>
                  <p className="text-2xl font-bold text-yellow-600">{reportData.segmentation.low}</p>
                  <p className="text-xs text-gray-400">1-4 purchases</p>
                </div>
                <div className="text-center p-4 bg-white/5 rounded-lg border border-white/10">
                  <p className="text-sm text-gray-300">Inactive</p>
                  <p className="text-2xl font-bold text-gray-600">{reportData.segmentation.inactive}</p>
                  <p className="text-xs text-gray-400">No recent activity</p>
                </div>
              </div>
            </div>

            {/* Top Customers */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-white tracking-tight">Top Customers</h2>
              <Table
                data={reportData.topCustomers}
                columns={[
                  { key: 'customerName', header: 'Customer', mobilePrimary: true, render: (c) => <span className="font-semibold text-white">{c.customerName}</span> },
                  { key: 'totalPurchases', header: 'Total Purchases', align: 'right', render: (c) => <span className="font-mono text-emerald-400 font-medium">{format(c.totalPurchases)}</span> },
                  { key: 'purchaseCount', header: 'Purchase Count', align: 'center', render: (c) => <span className="text-slate-300 font-mono">{c.purchaseCount}</span> },
                  { key: 'loyaltyPoints', header: 'Loyalty Points', align: 'right', render: (c) => <span className="text-purple-400 font-mono font-semibold">{c.loyaltyPoints}</span> },
                ]}
                emptyMessage="No top customer data available"
              />
            </div>

            {/* Customer Growth Trend */}
            <div className="space-y-3">
              <h2 className="text-lg font-bold text-white tracking-tight">Customer Growth Trend</h2>
              <Table
                data={reportData.byPeriod}
                columns={[
                  { key: 'date', header: 'Date', mobilePrimary: true, render: (p) => <span className="text-slate-200">{new Date(p.date).toLocaleDateString()}</span> },
                  { key: 'newCustomers', header: 'New Customers', align: 'center', render: (p) => <span className="text-slate-300 font-mono">{p.newCustomers}</span> },
                  { key: 'totalPurchases', header: 'Total Purchases', align: 'right', render: (p) => <span className="font-mono text-emerald-400 font-medium">{format(p.totalPurchases)}</span> },
                ]}
                emptyMessage="No growth trend data available"
              />
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

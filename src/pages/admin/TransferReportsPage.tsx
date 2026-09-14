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
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAuthStore } from '../../stores/auth-store';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { SaveReportButton } from '../../components/finance/SaveReportButton';

interface TransferReportData {
  summary: {
    totalTransfers: number;
    pendingTransfers: number;
    approvedTransfers: number;
    rejectedTransfers: number;
    completedTransfers: number;
  };
  transfers: Array<{
    transferId: string;
    sourceBranchId: string;
    sourceBranchName?: string;
    destinationBranchId: string;
    destinationBranchName?: string;
    productId: string;
    productName?: string;
    quantity: number;
    status: 'pending' | 'approved' | 'rejected' | 'completed';
    requestedBy: string;
    requestedByName?: string;
    approvedBy?: string;
    approvedByName?: string;
    createdAt: string;
    approvedAt?: string;
    completedAt?: string;
    reason: string;
  }>;
}

export const TransferReportsPage = () => {
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const user = useAuthStore((state) => state.user);
  const branchId = getBranchId(selectedBranch);
  const isSuperAdmin = user?.role === 'super_admin';
  const effectiveBranchId = isSuperAdmin ? undefined : branchId;

  // Fetch transfer reports
  const { data: reportData, isLoading, error } = useQuery({
    queryKey: queryKeys.reports.transfer({
      branchId: effectiveBranchId,
      startDate: dateFrom,
      endDate: dateTo,
      status: statusFilter,
    }),
    queryFn: async () => {
      const response = await apiClient.get(buildApiUrl('/reports/transfers', {
        startDate: dateFrom,
        endDate: dateTo,
        branchId: effectiveBranchId,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      }));
      return unwrapResponse(response.data, {} as TransferReportData);
    },
    enabled: !!dateFrom && !!dateTo && (isSuperAdmin || !!branchId),
  });

  const handleExport = async () => {
    try {
      const response = await apiClient.get(buildApiUrl('/reports/transfers', {
        startDate: dateFrom,
        endDate: dateTo,
        export: 'excel',
        branchId: effectiveBranchId,
        status: statusFilter !== 'all' ? statusFilter : undefined,
      }), {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `transfer-report-${dateFrom}-${dateTo}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  if (!isSuperAdmin && !branchId) {
    return (
      <AdminLayout>
        <div className="rounded-2xl border border-white/10 bg-primary-dark/60 p-8 text-center">
          <h2 className="text-xl font-semibold text-white">Select a Branch First</h2>
          <p className="mt-2 text-gray-400">
            Transfer reports use your assigned branch. Choose a branch to continue.
          </p>
        </div>
      </AdminLayout>
    );
  }

  if (isLoading) return <AdminLayout><Loading /></AdminLayout>;
  if (error) return <AdminLayout><Error message="Failed to load transfer reports" /></AdminLayout>;

  const tableColumns = [
    {
      key: 'createdAt',
      header: 'Date',
      render: (row: TransferReportData['transfers'][number]) =>
        new Date(row.createdAt).toLocaleDateString(),
    },
    { key: 'sourceBranchName', header: 'From' },
    { key: 'destinationBranchName', header: 'To' },
    { key: 'productName', header: 'Product' },
    { key: 'quantity', header: 'Quantity' },
    {
      key: 'status',
      header: 'Status',
      render: (row: TransferReportData['transfers'][number]) => (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-white/10 text-white">
          {row.status.toUpperCase()}
        </span>
      ),
    },
    { key: 'requestedByName', header: 'Requested By' },
  ];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Transfer Reports</h1>
          <div className="flex items-center gap-2">
            <SaveReportButton
              reportKey="transfers"
              route="/admin/reports/transfers"
              params={{ branchId: effectiveBranchId, dateFrom, dateTo }}
              defaultName="Transfer Report"
            />
            <Button onClick={handleExport}>
              Export to Excel
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
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all" className="bg-primary-dark text-white">All Status</option>
              <option value="pending" className="bg-primary-dark text-white">Pending</option>
              <option value="approved" className="bg-primary-dark text-white">Approved</option>
              <option value="completed" className="bg-primary-dark text-white">Completed</option>
              <option value="rejected" className="bg-primary-dark text-white">Rejected</option>
            </Select>
          </div>
        </div>

        {/* Summary Cards */}
        {reportData && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-primary-dark/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/5">
                <p className="text-sm text-gray-400">Total Transfers</p>
                <p className="text-3xl font-bold text-white">{reportData.summary.totalTransfers}</p>
              </div>
              <div className="bg-primary-dark/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/5">
                <p className="text-sm text-gray-400">Pending</p>
                <p className="text-3xl font-bold text-yellow-400">{reportData.summary.pendingTransfers}</p>
              </div>
              <div className="bg-primary-dark/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/5">
                <p className="text-sm text-gray-400">Approved</p>
                <p className="text-3xl font-bold text-blue-400">{reportData.summary.approvedTransfers}</p>
              </div>
              <div className="bg-primary-dark/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/5">
                <p className="text-sm text-gray-400">Completed</p>
                <p className="text-3xl font-bold text-green-400">{reportData.summary.completedTransfers}</p>
              </div>
            </div>

            {/* Transfer List */}
            <div className="bg-primary-dark/50 backdrop-blur-sm p-6 rounded-2xl shadow-xl border border-white/5">
              <h2 className="text-xl font-bold text-white mb-4">Transfer Activity</h2>
              <Table data={reportData.transfers || []} columns={tableColumns} />
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
};

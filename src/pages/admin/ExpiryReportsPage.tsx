import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import apiClient from '../../lib/api-client';
import { unwrapArray } from '../../lib/unwrap-response';
import { AdminLayout } from '../../components/AdminLayout';
import { Button } from '../../components/ui/Button';
import { Table } from '../../components/ui/Table';
import { Select } from '../../components/ui/Select';
import { Loading } from '../../components/ui/Loading';
import { Error } from '../../components/ui/Error';
import { useCurrency } from '../../hooks/useCurrency';
import { useBranchStore, getBranchId } from '../../stores/branch-store';
import { useAuthStore } from '../../stores/auth-store';
import { queryKeys } from '../../lib/query-keys';
import { buildApiUrl } from '../../lib/api-utils';
import { SaveReportButton } from '../../components/finance/SaveReportButton';

interface Branch {
  _id: string;
  name: string;
}

interface ExpiryReportItem {
  productId: string;
  productName: string;
  branchId: string;
  branchName: string;
  expiryDate: string;
  quantity: number;
  purchasePrice: number;
  sellingPrice: number;
  potentialLoss: number;
  daysUntilExpiry: number;
}

const QUICK_FILTERS = [
  { label: 'Already Expired', value: 0, color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  { label: '30 Days', value: 30, color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  { label: '60 Days', value: 60, color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  { label: '90 Days', value: 90, color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
];

export const ExpiryReportsPage = () => {
  const { format } = useCurrency();
  const selectedBranch = useBranchStore((state) => state.selectedBranch);
  const user = useAuthStore((state) => state.user);
  const isSuperAdmin = user?.role === 'super_admin';
  const selectedBranchId = getBranchId(selectedBranch);
  const [filterBranchId, setFilterBranchId] = useState('');
  const effectiveBranchId = isSuperAdmin ? filterBranchId : selectedBranchId;
  const [daysUntilExpiry, setDaysUntilExpiry] = useState(30);

  // Auto-fetch on mount and when filters change
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.reports.expiry({ branchId: effectiveBranchId, daysUntilExpiry }),
    queryFn: async () => {
      const response = await apiClient.get(
        buildApiUrl('/reports/expiry', {
          branchId: effectiveBranchId || undefined,
          daysUntilExpiry,
        }),
      );
      return (response.data?.expiringBatches || []) as ExpiryReportItem[];
    },
    enabled: isSuperAdmin || !!selectedBranchId,
  });

  // Fetch branches
  const { data: branches } = useQuery({
    queryKey: queryKeys.branches.list(),
    queryFn: async () => {
      const response = await apiClient.get('/branches');
      return unwrapArray<Branch>(response.data);
    },
    enabled: isSuperAdmin,
  });

  const handleExport = async (format: 'pdf' | 'excel') => {
    try {
      const response = await apiClient.get(buildApiUrl('/reports/expiry', {
        branchId: effectiveBranchId || undefined,
        daysUntilExpiry,
        export: format,
      }), {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `expiry-report-${daysUntilExpiry}d-${new Date().toISOString().split('T')[0]}.${format === 'pdf' ? 'pdf' : 'xlsx'}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const getExpiryStatus = (days: number) => {
    if (days <= 0) return { label: 'EXPIRED', color: 'bg-red-500/20 text-red-300' };
    if (days <= 30) return { label: 'CRITICAL', color: 'bg-red-500/20 text-red-300' };
    if (days <= 60) return { label: 'WARNING', color: 'bg-orange-500/20 text-orange-300' };
    return { label: 'ATTENTION', color: 'bg-yellow-500/20 text-yellow-300' };
  };

  const columns = [
    { key: 'productName', header: 'Product' },
    { key: 'branchName', header: 'Branch' },
    {
      key: 'expiryDate',
      header: 'Expiry Date',
      render: (item: ExpiryReportItem) => new Date(item.expiryDate).toLocaleDateString()
    },
    {
      key: 'daysUntilExpiry',
      header: 'Status',
      render: (item: ExpiryReportItem) => {
        const status = getExpiryStatus(item.daysUntilExpiry);
        return (
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${status.color}`}>
              {status.label}
            </span>
            <span className="text-gray-400">{item.daysUntilExpiry}d</span>
          </div>
        );
      }
    },
    { key: 'quantity', header: 'Qty' },
    {
      key: 'potentialLoss',
      header: 'Potential Loss',
      render: (item: ExpiryReportItem) => (
        <span className="text-red-400 font-semibold">{format(item.potentialLoss)}</span>
      )
    },
  ];

  const totals = data?.reduce(
    (acc: { totalQuantity: number; totalPotentialLoss: number; expiredCount: number; criticalCount: number }, item: ExpiryReportItem) => ({
      totalQuantity: acc.totalQuantity + item.quantity,
      totalPotentialLoss: acc.totalPotentialLoss + item.potentialLoss,
      expiredCount: acc.expiredCount + (item.daysUntilExpiry <= 0 ? 1 : 0),
      criticalCount: acc.criticalCount + (item.daysUntilExpiry > 0 && item.daysUntilExpiry <= 30 ? 1 : 0),
    }),
    { totalQuantity: 0, totalPotentialLoss: 0, expiredCount: 0, criticalCount: 0 }
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Expiry Reports</h1>
          {data && data.length > 0 && (
            <div className="flex items-center space-x-2">
              <SaveReportButton
                reportKey="expiry"
                route="/admin/reports/expiry"
                params={{ branchId: effectiveBranchId, daysUntilExpiry }}
                defaultName="Expiry Report"
              />
              <Button variant="secondary" size="sm" onClick={() => handleExport('pdf')}>
                Export PDF
              </Button>
              <Button variant="secondary" size="sm" onClick={() => handleExport('excel')}>
                Export Excel
              </Button>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5 p-6">
          <div className="flex flex-col md:flex-row md:items-end gap-4">
            {isSuperAdmin && (
              <div className="flex-1">
                <Select
                  label="Branch"
                  value={filterBranchId}
                  onChange={(e) => setFilterBranchId(e.target.value)}
                >
                  <option value="">All Branches</option>
                  {branches?.map(branch => (
                    <option key={branch._id} value={branch._id}>{branch.name}</option>
                  ))}
                </Select>
              </div>
            )}
          </div>

          {/* Quick Filter Buttons */}
          <div className="mt-4">
            <p className="text-sm text-gray-400 mb-2">Show products expiring within:</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  onClick={() => setDaysUntilExpiry(filter.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                    daysUntilExpiry === filter.value
                      ? `${filter.color} ring-2 ring-white/20`
                      : 'bg-white/5 text-gray-400 border-gray-600 hover:border-gray-500 hover:text-white'
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        {isLoading && (
          <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5 p-6">
            <Loading />
          </div>
        )}

        {error && (
          <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5 p-6">
            <Error message="Failed to load expiry report. Please try again." onRetry={() => refetch()} />
          </div>
        )}

        {data && data.length > 0 && (
          <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5">
            {/* Summary */}
            {totals && (
              <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-white/5">
                <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
                  <p className="text-sm text-blue-200">Total Products</p>
                  <p className="text-2xl font-bold text-blue-400">{data.length}</p>
                </div>
                <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                  <p className="text-sm text-red-200">Expired</p>
                  <p className="text-2xl font-bold text-red-400">{totals.expiredCount}</p>
                </div>
                <div className="bg-orange-500/10 p-4 rounded-xl border border-orange-500/20">
                  <p className="text-sm text-orange-200">Critical (within 30d)</p>
                  <p className="text-2xl font-bold text-orange-400">{totals.criticalCount}</p>
                </div>
                <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                  <p className="text-sm text-red-200">Potential Loss</p>
                  <p className="text-2xl font-bold text-red-400">{format(totals.totalPotentialLoss)}</p>
                </div>
              </div>
            )}

            <Table data={data} columns={columns} />
          </div>
        )}

        {data && data.length === 0 && (
          <div className="bg-primary-dark/50 backdrop-blur-sm rounded-2xl shadow-xl border border-white/5 p-12 text-center">
            <p className="text-gray-400 text-lg">No products expiring within {daysUntilExpiry} days.</p>
            <p className="text-gray-500 text-sm mt-1">Try selecting a longer timeframe or different branch.</p>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}


